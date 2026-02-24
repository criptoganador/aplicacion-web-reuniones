import express from "express";
import pg from "pg";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv"; // 1. Importamos dotenv
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path"; // Import path
import multer from "multer"; // Import multer
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "./utils/jwt.js";
import { authenticateToken, isAdmin } from "./middleware/auth.js";
import Joi from "joi";
import notificationsRoutes from "./routes/notifications.js";

dotenv.config();

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración de CORS dinámica
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
  // 🟢 Render permite usar comodines o URLs dinámicas aquí
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Log para depuración
    console.log(
      `🔍 CORS attempt from: ${origin || "no-origin"} | Allowed: ${JSON.stringify(allowedOrigins)}`,
    );

    if (
      !origin ||
      allowedOrigins.indexOf(origin) !== -1 ||
      process.env.NODE_ENV !== "production"
    ) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS bloqueado para: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// ---------------------------------------------------------
// 💳 SAAS & STRIPE CONFIGURATION
// ---------------------------------------------------------
import Stripe from "stripe";
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

const PLAN_LIMITS = {
  free: { users: 5 },
  pro: { users: 50 },
  enterprise: { users: 999999 },
};

// Helper function
async function checkPlanLimits(orgId, resource) {
  const orgResult = await pool.query(
    "SELECT plan FROM organizations WHERE id = $1",
    [orgId],
  );
  const plan = orgResult.rows[0]?.plan || "free";
  const limits = PLAN_LIMITS[plan];

  if (resource === "users") {
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM user_organizations WHERE organization_id = $1",
      [orgId],
    );
    const count = parseInt(countResult.rows[0].count);
    if (count >= limits.users) {
      throw new Error(
        `Límite de usuarios alcanzado para el plan ${plan.toUpperCase()} (${count}/${limits.users}). Actualiza tu plan.`,
      );
    }
  }
  return true;
}

// --- ESQUEMAS DE VALIDACIÓN ---
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid("user", "admin").default("user"),
  orgName: Joi.string()
    .min(2)
    .max(100)
    .when("role", {
      is: "admin",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    }),
  joinCode: Joi.string().when("role", {
    is: "user",
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ""),
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const meetingSchema = Joi.object({
  host_id: Joi.number().optional().allow(null),
  link: Joi.string().required(),
  meeting_type: Joi.string()
    .valid("instant", "later", "scheduled")
    .default("instant"),
  title: Joi.string().max(100).optional().allow(null, ""),
  scheduled_time: Joi.date().iso().optional().allow(null),
  organized_by: Joi.string().max(50).optional().allow(null, ""),
});

const joinSchema = Joi.object({
  meeting_id: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
});

const app = express();
app.set("trust proxy", 1);

// 1. Inicializar Base de Datos
import { pool, initDB } from "./db.js";
initDB();

// 2. Puerto dinámico
const PORT = Number(process.env.PORT) || 10000;

// ---------------------------
// Configuración Nodemailer (Email)
// ---------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ---------------------------
// Rate Limiters (Security)
// ---------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana
  message: {
    error: "Demasiados intentos de login. Intenta de nuevo en 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por hora desde la misma IP
  message: {
    error: "Demasiados intentos de registro. Intenta de nuevo más tarde.",
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 solicitudes por hora
  message: {
    error:
      "Demasiadas solicitudes de recuperación. Intenta de nuevo más tarde.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 archivos por ventana
  message: {
    error: "Demasiadas subidas de archivos. Intenta de nuevo más tarde.",
  },
});

// ---------------------------
// Middlewares Globales
// ---------------------------
app.use(cors(corsOptions)); // ✨ Usa la configuración dinámica con logs

// 🔹 Stripe Webhook (Debe ir ANTES de express.json() porque necesita body en raw)
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`, err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        if (session.metadata && session.metadata.organizationId) {
          await pool.query(
            "UPDATE organizations SET plan = 'pro', subscription_status = 'active', stripe_subscription_id = $1 WHERE id = $2",
            [session.subscription, session.metadata.organizationId],
          );
        }
        break;
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        await pool.query(
          "UPDATE organizations SET plan = 'free', subscription_status = 'canceled', stripe_subscription_id = NULL WHERE stripe_subscription_id = $1",
          [subscription.id],
        );
        break;
    }

    response.send();
  },
);

app.use(express.json());
app.use(cookieParser());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "blob:",
          "https://*.livekit.cloud",
        ],
        "worker-src": ["'self'", "blob:"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "http://localhost:4000",
          "https://*.livekit.cloud",
          "https://raw.githubusercontent.com",
          "https://res.cloudinary.com",
        ],
        "connect-src": [
          "'self'",
          "http://localhost:4000",
          "http://127.0.0.1:4000",
          "wss://*.livekit.cloud",
          "https://*.livekit.cloud",
        ],
        "frame-src": ["'self'", "https://*.livekit.cloud"],
        "media-src": ["'self'", "blob:", "data:"],
      },
    },
  }),
);

// LOGGING MIDDLEWARE (Debug)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`📡 Request received: ${req.method} ${req.path}`);
  }
  next();
});

app.use("/api/notifications", notificationsRoutes);

// CONFIGURACIÓN MULTER (Subida Local)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Servir la carpeta 'uploads'
console.log(`📂 Serving static files from: ${uploadDir}`);
app.use(
  "/uploads",
  (req, res, next) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`📸 Static request: ${req.url}`);
    }
    next();
  },
  express.static(uploadDir),
);

// ENDPOINT DE SUBIDA (Híbrido: Cloudinary con Fallback Local)
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se envió ningún archivo" });
  }

  const { meeting_id } = req.body;
  const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  try {
    let publicUrl = "";

    if (isCloudinaryConfigured) {
      console.log("📂 Uploading to Cloudinary...");
      const uploadToCloudinary = () => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "asicme_meet_uploads",
              resource_type: "auto",
              public_id: `${Date.now()}-${req.file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_")}`,
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );
          stream.end(req.file.buffer);
        });
      };

      const result = await uploadToCloudinary();
      publicUrl = result.secure_url;
      console.log("✅ File uploaded to Cloudinary:", publicUrl);
    } else {
      console.log(
        "📂 Cloudinary not configured. Falling back to Local Storage...",
      );
      const filename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
      const filePath = path.join(uploadDir, filename);

      // Save buffer to file
      fs.writeFileSync(filePath, req.file.buffer);

      // Construct local URL
      const protocol = req.protocol;
      const host = req.get("host");
      publicUrl = `${protocol}://${host}/uploads/${filename}`;
      console.log("✅ File saved locally:", publicUrl);
    }

    if (meeting_id) {
      await saveFileReference(meeting_id, publicUrl, req.file.originalname);
    }

    res.json({
      secure_url: publicUrl,
      name: req.file.originalname,
    });
  } catch (error) {
    console.error("❌ Error in upload endpoint:", error);
    res.status(500).json({
      error: "No se pudo procesar la subida del archivo.",
      message: error.message,
      stack: error.stack,
    });
  }
});

// Helper para guardar referencia en BD (DRY)
async function saveFileReference(meeting_id, fileUrl, originalName) {
  try {
    const meetingResult = await pool.query(
      "SELECT id FROM meetings WHERE link = $1",
      [meeting_id],
    );

    if (meetingResult.rows.length > 0) {
      const realId = meetingResult.rows[0].id;
      await pool.query(
        "INSERT INTO meeting_files (meeting_id, file_path, filename) VALUES ($1, $2, $3)",
        [realId, fileUrl, originalName],
      );
    }
  } catch (dbErr) {
    console.error("⚠️ Error guardando referencia en BD:", dbErr);
  }
}

// ---------------------------
// Root (health check)
// ---------------------------
app.get("/", (req, res) => {
  res.send(`ASICME Meet backend OK (Local) en puerto ${PORT} 🚀`);
});

// ===========================
// MEETINGS
// ===========================

// 🔹 Crear reunión instantánea (PROTEGIDO)
app.post("/meetings/start", authenticateToken, async (req, res) => {
  try {
    // Debug logs: imprimir usuario y payload para diagnosticar 500 después de limpieza de BD
    console.log("➡️ /meetings/start payload:", JSON.stringify(req.body));
    console.log("➡️ /meetings/start req.user:", JSON.stringify(req.user));
    // 1. Validar entrada
    const { error, value } = meetingSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, error: error.details[0].message });
    }

    const { host_id, link, meeting_type, title, scheduled_time, organized_by } =
      value;

    const result = await pool.query(
      `INSERT INTO meetings (host_id, link, is_active, meeting_type, title, scheduled_time, organized_by, organization_id)
       VALUES ($1, $2, true, $3, $4, $5, $6, $7)
       ON CONFLICT (link) 
       DO UPDATE SET 
          is_active = true, 
          created_at = CURRENT_TIMESTAMP,
          host_id = EXCLUDED.host_id
       RETURNING id, link, is_active, meeting_type, title, scheduled_time, organized_by, organization_id`,
      [
        host_id || null,
        link,
        meeting_type || "instant",
        title || null,
        scheduled_time || null,
        organized_by || null,
        req.user.organizationId,
      ],
    );

    const meeting = result.rows[0];

    // Host como participante (si existe) - Evitar duplicados
    if (host_id) {
      await pool.query(
        "INSERT INTO participants (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [meeting.id, host_id],
      );
    }

    // 🔔 NOTIFICAR A MIEMBROS DE LA ORGANIZACIÓN
    const inviterName = organized_by || "un compañero";
    const meetingTitle = title || "Reunión Instantánea";
    const notificationMessage = `Te han invitado a la reunión: ${meetingTitle} por ${inviterName}`;
    const notificationLink = `/pre-lobby/${link}`;

    // Insertar notificaciones para todos los miembros de la org (menos el host)
    // Usamos INSERT INTO ... SELECT para eficiencia
    // Insertar notificaciones con referencia a la reunión (Smart Cleanup)
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, link, meeting_id)
       SELECT id, 'meeting_invite', $1, $2, $3
       FROM users
       WHERE organization_id = $4 AND id != $5`,
      [
        notificationMessage,
        notificationLink,
        meeting.id, // 🔔 ID de la reunión para borrado en cascada
        req.user.organizationId,
        host_id || req.user.userId,
      ],
    );

    res.json({
      success: true,
      meeting,
    });
  } catch (err) {
    // Print stack for easier debugging
    console.error("❌ Error en /meetings/start:", err.stack || err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 HISTORIAL de reuniones (filtradas por organización)
app.get("/meetings/history", authenticateToken, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT m.*, u.name as host_name, u.email as host_email 
       FROM meetings m
       LEFT JOIN users u ON m.host_id = u.id
       WHERE m.organization_id = $1
       ORDER BY m.created_at DESC`,
      [organizationId],
    );

    res.json({
      success: true,
      history: result.rows,
    });
  } catch (err) {
    console.error("Error fetching meetings:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 VALIDAR reunión
app.get("/meetings/validate/:link", async (req, res) => {
  try {
    const { link } = req.params;
    console.log(`🔍 Validando reunión: ${link}`);

    const result = await pool.query(
      `SELECT id, is_active
       FROM meetings
       WHERE link = $1 AND is_active = true`,
      [link],
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      meeting_id: result.rows[0].id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ exists: false, error: err.message });
  }
});

// 🔹 Listar todas las reuniones ACTIVAS en LiveKit (Monitor en Vivo - FILTRADO POR ORG)
app.get("/meetings/list", authenticateToken, async (req, res) => {
  try {
    // 1. Obtener lista de salas activas desde LiveKit
    const svc = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );

    const liveRooms = await svc.listRooms();

    if (liveRooms.length === 0) {
      return res.json({
        success: true,
        meetings: [],
      });
    }

    // 2. Obtener detalles de la BD para esas salas específicas
    const activeLinks = liveRooms.map((r) => r.name);
    const result = await pool.query(
      `SELECT id, link, created_at, meeting_type, title, scheduled_time, organized_by 
       FROM meetings 
       WHERE link = ANY($1) AND is_active = true AND organization_id = $2
       ORDER BY created_at DESC`,
      [activeLinks, req.user.organizationId],
    );

    // 3. Cruzar datos para incluir el número de participantes
    const meetingsWithStats = result.rows.map((meeting) => {
      const liveData = liveRooms.find((r) => r.name === meeting.link);
      return {
        ...meeting,
        participant_count: liveData ? liveData.numParticipants : 0,
      };
    });

    res.json({
      success: true,
      meetings: meetingsWithStats,
    });
  } catch (err) {
    console.error("Error fetching live meetings:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// 🔹 Unirse a reunión (CON EMAIL REAL - Login o Registro Automático)
app.post("/meetings/join", async (req, res) => {
  try {
    // 1. Validar con Joi
    const { error, value } = joinSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, error: error.details[0].message });
    }

    const { meeting_id, name, email } = value;

    console.log(
      `📧 Procesando ingreso para: ${email} en reunión: ${meeting_id}`,
    );

    let userId;

    // 2. VERIFICAR SI EL USUARIO YA EXISTE
    const userCheck = await pool.query(
      "SELECT id, organization_id FROM users WHERE email = $1",
      [email],
    );

    // Obtener la organización de la reunión y su ID real
    const isNumericId = !isNaN(meeting_id);
    const meetingRes = await pool.query(
      isNumericId
        ? "SELECT id, organization_id FROM meetings WHERE id = $1"
        : "SELECT id, organization_id FROM meetings WHERE link = $1",
      [meeting_id],
    );

    if (meetingRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Reunión no encontrada" });
    }

    const realMeetingId = meetingRes.rows[0].id;
    const meetingOrgId = meetingRes.rows[0].organization_id;

    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      console.log(`✅ Usuario encontrado (ID: ${userId}). Reutilizando.`);
    } else {
      // CASO B: Usuario nuevo, lo creamos vinculado a la organización de la reunión
      console.log("🆕 Usuario nuevo. Registrando...");
      const newUser = await pool.query(
        `INSERT INTO users (name, email, password, role, organization_id, is_verified) 
         VALUES ($1, $2, 'guest_pass', 'participant', $3, true) 
         RETURNING id`,
        [name, email, meetingOrgId || 1],
      );
      userId = newUser.rows[0].id;
    }

    // 3. UNIRLO A LA SALA (Evitando duplicados)
    const participantCheck = await pool.query(
      "SELECT * FROM participants WHERE meeting_id = $1 AND user_id = $2",
      [realMeetingId, userId],
    );

    if (participantCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO participants (meeting_id, user_id) VALUES ($1, $2)",
        [realMeetingId, userId],
      );
      console.log(`🔗 Usuario ${userId} unido a la reunión ${realMeetingId}`);
    } else {
      console.log(`⚠️ El usuario ${userId} ya estaba en la reunión.`);
    }

    res.json({ success: true, user_id: userId, meeting_id: realMeetingId });
  } catch (err) {
    console.error("❌ ERROR EN JOIN:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===========================
// AUTH
// ===========================

// 🔹 Registro CON BCRYPT Y JWT
app.post("/auth/register", async (req, res) => {
  try {
    // 1. Validar con Joi
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, error: error.details[0].message });
    }

    let { name, email, password, role, orgName, joinCode } = value;

    // Normalizar email
    email = email.trim().toLowerCase();

    // 4. Verificar si el email ya existe
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "El correo ya está registrado",
      });
    }

    // 5. Gestión de Organización
    let organizationId = null;

    if (role === "admin" && orgName) {
      // 🏗️ MODO ADMIN: Crear Organización
      const slug = orgName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");

      // Verificar si ya existe una organización con ese nombre
      const orgNameCheck = await pool.query(
        "SELECT id FROM organizations WHERE name = $1",
        [orgName],
      );
      if (orgNameCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "Ya existe una organización con este nombre. Elige otro o únete con un código.",
        });
      }
      const joinCodeGenerated = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const slugCheck = await pool.query(
        "SELECT id FROM organizations WHERE slug = $1",
        [slug],
      );
      let finalSlug = slug;
      if (slugCheck.rows.length > 0) {
        finalSlug = `${slug}-${Date.now().toString().slice(-4)}`;
      }

      const orgResult = await pool.query(
        "INSERT INTO organizations (name, slug, join_code) VALUES ($1, $2, $3) RETURNING id",
        [orgName, finalSlug, joinCodeGenerated],
      );
      organizationId = orgResult.rows[0].id;
    } else if (role === "user" && joinCode) {
      // 🤝 MODO USUARIO: Unirse con código
      const orgResult = await pool.query(
        "SELECT id FROM organizations WHERE join_code = $1",
        [joinCode.toUpperCase()],
      );

      if (orgResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "El código de organización no es válido",
        });
      }
      organizationId = orgResult.rows[0].id;

      // 🔒 VERIFICAR LÍMITE DEL PLAN
      try {
        await checkPlanLimits(organizationId, "users");
      } catch (limitErr) {
        return res
          .status(403)
          .json({ success: false, error: limitErr.message });
      }
    } else {
      // Intentamos buscar la primera organización como fallback absoluto
      const fallbackOrg = await pool.query(
        "SELECT id FROM organizations ORDER BY id ASC LIMIT 1",
      );
      organizationId =
        fallbackOrg.rows.length > 0 ? fallbackOrg.rows[0].id : null;
    }

    // 6. ✨ ENCRIPTAR CONTRASEÑA con bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 7. bootstrap: El primer usuario siempre es ADMIN
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;

    const finalRole = isFirstUser ? "admin" : role;
    const finalVerified = true; // ✨ Verificación deshabilitada por petición del usuario

    // 🏢 Determinamos la organización final:
    // Si creamos una (admin) o encontramos una (user), usamos esa.
    // De lo contrario, intentamos usar la organización #1 como fallback.
    let finalOrgId = organizationId;
    if (!finalOrgId) {
      const defaultOrg = await pool.query(
        "SELECT id FROM organizations ORDER BY id ASC LIMIT 1",
      );
      if (defaultOrg.rows.length === 0) {
        // ERROR CRÍTICO: No hay organizaciones
        return res.status(500).json({
          success: false,
          error:
            "Error del sistema: No existe ninguna organización base configurada.",
        });
      }
      finalOrgId = defaultOrg.rows[0].id;
    }

    // 9. Insertar usuario en BD
    const resultInsert = await pool.query(
      `INSERT INTO users (name, email, password, role, is_verified, verification_token, organization_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        name,
        email,
        hashedPassword,
        finalRole,
        finalVerified,
        null, // No necesitamos token de verificación
        finalOrgId,
      ],
    );

    const userId = resultInsert.rows[0].id;

    // 🔗 Vincular en la tabla relacional user_organizations
    await pool.query(
      "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)",
      [userId, finalOrgId, finalRole],
    );

    // 📝 AUDIT LOG
    // logAction signature: (organizationId, userId, action, details, req)
    await logAction(
      finalOrgId,
      userId,
      "USER_CREATED",
      { email, name, role: finalRole, via: "register" },
      req,
    );

    console.log(`✅ Nuevo usuario creado: ${email} en ${finalOrgId}`);

    // 11. Respuesta Exitosa
    if (finalVerified) {
      // 🚀 AUTO-LOGIN para usuarios auto-verificados (como el primer admin)
      // 🚀 Obtener detalles de la organización para el registro exitoso
      const orgDetails = await pool.query(
        "SELECT name, logo_url FROM organizations WHERE id = $1",
        [finalOrgId],
      );

      const userRecord = {
        id: resultInsert.rows[0].id,
        name,
        email,
        role: finalRole,
        organization_id: finalOrgId,
        organization_name: orgDetails.rows[0]?.name,
        organization_logo_url: orgDetails.rows[0]?.logo_url,
      };

      const accessToken = generateAccessToken(userRecord);
      const refreshToken = generateRefreshToken(userRecord);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // ✨ Render requiere secure: true para SameSite: None
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        message: "Registro y acceso exitoso.",
        user: userRecord,
        accessToken,
      });
    }

    res.status(201).json({
      success: true,
      message:
        "Registro exitoso. Por favor, verifica tu correo para activar tu cuenta.",
    });
  } catch (err) {
    console.error("❌ ERROR CRÍTICO EN REGISTRO:", err);
    console.error("🔍 Request Body:", req.body);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// 🔹 Verificar Email con Token
app.get("/auth/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Buscar usuario por token
    const result = await pool.query(
      "SELECT id FROM users WHERE verification_token = $1",
      [token],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "El enlace de verificación es inválido o ya ha sido usado.",
      });
    }

    const userId = result.rows[0].id;

    // 2. Marcar como verificado y limpiar token
    await pool.query(
      "UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1",
      [userId],
    );

    res.json({
      success: true,
      message: "¡Cuenta verificada con éxito! Ya puedes iniciar sesión.",
    });
  } catch (err) {
    console.error("❌ ERROR EN VERIFY-EMAIL:", err);
    res.status(500).json({
      success: false,
      error: "Error al verificar la cuenta",
      details: err.message,
    });
  }
});

// 🔹 Reenviar código de verificación
app.post("/auth/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, error: "El email es obligatorio" });

    // 1. Buscar usuario
    const result = await pool.query(
      "SELECT id, name, is_verified FROM users WHERE email = $1",
      [email],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res
        .status(400)
        .json({ success: false, error: "Esta cuenta ya está verificada" });
    }

    // 2. Generar nuevo OTP
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query("UPDATE users SET verification_token = $1 WHERE id = $2", [
      newOTP,
      user.id,
    ]);

    // 3. Log en consola (sin datos sensibles)
    if (process.env.NODE_ENV === "development") {
      console.log(`🔄 Código de verificación reenviado para: ${email}`);
    }

    // 4. Intentar enviar email
    try {
      const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email/${newOTP}`;
      await transporter.sendMail({
        from: `"ASICME Meet" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Nuevo código de verificación - ASICME Meet",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Tu nuevo código de verificación</h2>
            <div style="font-size: 32px; font-weight: bold; color: #34a853;">${newOTP}</div>
            <p>Usa este código para activar tu cuenta.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Mail simple resend failed, code is in console.");
    }

    res.json({ success: true, message: "Nuevo código enviado." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Error al reenviar código" });
  }
});

// ----------------------------------------------------------------------
// 🔹 AUTENTICACIÓN GOOGLE (SSO)
// ----------------------------------------------------------------------
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post("/auth/google", async (req, res) => {
  try {
    const { token } = req.body;

    // 1. Verificar token con Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, sub: googleId, name, picture } = payload;

    // 2. Buscar usuario existente
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    let user = userResult.rows[0];

    // 3. Si no existe, crear usuario
    if (!user) {
      // Crear nueva organización personal por defecto
      const userUUID = crypto.randomUUID();
      const newOrgResult = await pool.query(
        "INSERT INTO organizations (name, slug, join_code) VALUES ($1, $2, $3) RETURNING id",
        [
          `Organización de ${name}`,
          `org-${userUUID.slice(0, 8)}`,
          Math.random().toString(36).substring(7).toUpperCase(),
        ],
      );
      const newOrgId = newOrgResult.rows[0].id;

      // Insertar usuario
      const newUserResult = await pool.query(
        `INSERT INTO users (name, email, organization_id, google_id, auth_provider, avatar_url) 
         VALUES ($1, $2, $3, $4, 'google', $5) RETURNING *`,
        [name, email, newOrgId, googleId, picture],
      );
      user = newUserResult.rows[0];

      // Vincular en user_organizations
      await pool.query(
        "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, 'admin')",
        [user.id, newOrgId],
      );

      // Asignar owner_id a la org creada
      await pool.query("UPDATE organizations SET owner_id = $1 WHERE id = $2", [
        user.id,
        newOrgId,
      ]);

      // Log auditoría
      logAction(newOrgId, user.id, "USER_CREATED_GOOGLE", { email }, req);
    } else {
      // 4. Si existe, verificar vinculación
      if (!user.google_id) {
        // Antes de vincular (o si fuera nuevo miembro de org existente), deberíamos chequear si eso implica añadirlo a la org...
        // Pero en este flujo simple, si YA existe, el usuario ya tiene org.
        // Si estuviéramos añadiéndolo a una NUEVA org mediante invite, ahí chequearíamos.
        // Por ahora, solo vinculamos.
        await pool.query(
          "UPDATE users SET google_id = $1, auth_provider = 'google_linked' WHERE id = $2",
          [googleId, user.id],
        );
      }
    }

    // 5. Generar JWT
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        organizationId: user.organization_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 5. Generar JWT con datos frescos
    const fullUserRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.organization_id, u.avatar_url,
              o.name as organization_name, o.logo_url as organization_logo_url
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [user.id],
    );
    const fullUser = fullUserRes.rows[0];

    res.json({
      success: true,
      user: fullUser,
      accessToken,
    });
  } catch (error) {
    console.error("❌ ERROR GOOGLE AUTH:", error);
    res.status(401).json({ success: false, error: "Token de Google inválido" });
  }
});

// 🔹 Login CON BCRYPT Y JWT
app.post("/auth/login", async (req, res) => {
  try {
    // 1. Validar con Joi
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, error: error.details[0].message });
    }

    let { email, password } = value;

    // Normalizar email
    email = email.trim().toLowerCase();

    // 2. Buscar usuario con datos de su organización actual
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.role, u.avatar_url, u.is_verified, u.organization_id,
              o.name as organization_name, o.logo_url as organization_logo_url
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "Credenciales inválidas" });
    }

    const userRecord = result.rows[0];

    // 3. Verificar contraseña
    const isMatch = await bcrypt.compare(password, userRecord.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Credenciales inválidas" });
    }

    // 4. Generar Tokens
    const accessToken = generateAccessToken(userRecord);
    const refreshToken = generateRefreshToken(userRecord);

    // 5. Guardar Refresh Token en Cookie segura
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    res.json({ success: true, accessToken, user: userRecord });
  } catch (err) {
    console.error("❌ ERROR CRÍTICO EN LOGIN:", err);
    res.status(500).json({
      success: false,
      error: "Error en el servidor",
      details: err.message,
    });
  }
});

// 🔹 Renovar Access Token
app.post("/auth/refresh", async (req, res) => {
  console.log("🔄 [AUTH] Refresh token requested");
  try {
    // 1. Obtener refresh token de la cookie
    const refreshToken = req.cookies.refreshToken;
    console.log("🍪 [AUTH] Refresh token cookie present:", !!refreshToken);

    if (!refreshToken) {
      console.warn("⚠️ [AUTH] No refresh token found in cookies");
      return res.json({
        success: false,
        error: "No hay sesión activa",
      });
    }

    // 2. Verificar refresh token
    console.log("🔍 [AUTH] Verifying refresh token...");
    const decoded = verifyRefreshToken(refreshToken);
    console.log("✅ [AUTH] Refresh token valid for user:", decoded.userId);

    // 3. Buscar usuario en BD con datos de organización
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, u.organization_id,
              o.name as organization_name, o.logo_url as organization_logo_url
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const user = result.rows[0];

    // 4. Generar nuevo access token
    const newAccessToken = generateAccessToken(user);

    // 5. Enviar nuevo token
    res.json({
      success: true,
      accessToken: newAccessToken,
      user,
    });
  } catch (err) {
    console.error("❌ [AUTH] Error en refresh:", err);
    res.json({
      success: false,
      error: "Sesión expirada o inválida",
      details: err.message,
    });
  }
});

// 🔹 Logout
app.post("/auth/logout", (req, res) => {
  // Eliminar cookie de refresh token
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.json({
    success: true,
    message: "Sesión cerrada exitosamente",
  });
});

// 🔹 Listar Organizaciones del Usuario (Memberships)
app.get("/auth/memberships", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, o.logo_url, o.join_code, uo.role, uo.created_at
       FROM organizations o
       JOIN user_organizations uo ON o.id = uo.organization_id
       WHERE uo.user_id = $1
       ORDER BY uo.created_at ASC`,
      [userId],
    );
    res.json({ success: true, memberships: result.rows });
  } catch (err) {
    console.error("Error fetching memberships:", err);
    res
      .status(500)
      .json({ success: false, error: "Error al obtener membresías" });
  }
});

// 🔹 Cambiar Organización Activa
app.post("/auth/switch-org", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { organizationId } = req.body;

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, error: "ID de organización requerido" });
    }

    // 1. Verificar que el usuario pertenece a la organización
    const membership = await pool.query(
      "SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
      [userId, organizationId],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No tienes acceso a esta organización",
      });
    }

    const role = membership.rows[0].role;

    // 2. Obtener datos completos del usuario y de la nueva organización
    const userRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.is_verified,
              o.name as organization_name, o.logo_url as organization_logo_url
       FROM users u
       CROSS JOIN organizations o
       WHERE u.id = $1 AND o.id = $2`,
      [userId, organizationId],
    );

    if (userRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Usuario no encontrado" });
    }

    const userRecord = {
      ...userRes.rows[0],
      role: role,
      organization_id: organizationId,
    };

    // 3. Generar nuevo Access Token con la nueva Org
    const accessToken = generateAccessToken(userRecord);

    // 4. (Opcional) Actualizar la organización por defecto en la tabla 'users'
    await pool.query("UPDATE users SET organization_id = $1 WHERE id = $2", [
      organizationId,
      userId,
    ]);

    res.json({
      success: true,
      message: "Organización cambiada con éxito",
      accessToken,
      user: userRecord,
      organizationId,
    });
  } catch (err) {
    console.error("Error switching org:", err);
    res
      .status(500)
      .json({ success: false, error: "Error al cambiar de organización" });
  }
});

// 🔹 Eliminar Cuenta de Usuario
app.delete("/auth/account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orgId = req.user.organizationId;

    console.log(
      `⚠️ Solicitud de eliminación de cuenta para usuario ID: ${userId}`,
    );

    // 1. SEGURIDAD: Si es admin, verificar que no sea el último de su organización
    if (req.user.role === "admin") {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = 'admin'",
        [orgId],
      );
      const adminCount = parseInt(adminCountRes.rows[0].count);

      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          error:
            "No puedes eliminar tu cuenta porque eres el único administrador de tu organización. Promueve a otro usuario primero.",
        });
      }
    }

    // ¡MAGIA! Gracias a ON DELETE CASCADE...
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    // Limpiar cookies de sesión
    res.clearCookie("refreshToken");

    console.log(`✅ Cuenta de usuario ${userId} eliminada exitosamente.`);
    res.json({
      success: true,
      message: "Tu cuenta y todos tus datos han sido eliminados correctamente.",
    });
  } catch (err) {
    console.error("❌ Error al eliminar cuenta:", err.message);
    res.status(500).json({
      success: false,
      error: "Error interno al intentar eliminar la cuenta",
      details: err.message,
    });
  }
});

// 🔹 Actualizar Perfil de Usuario (Nombre y Avatar)
app.put("/auth/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, avatarUrl } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "El nombre es obligatorio" });
    }

    await pool.query(
      "UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3",
      [name, avatarUrl, userId],
    );

    res.json({
      success: true,
      message: "Perfil actualizado correctamente",
      user: { id: userId, name, avatar_url: avatarUrl },
    });
  } catch (err) {
    console.error("Error al actualizar perfil:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Error al actualizar perfil" });
  }
});

// 🔹 Cambiar Contraseña
app.put("/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // 1. Obtener contraseña actual
    const result = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId],
    );
    const user = result.rows[0];

    // 2. Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "La contraseña actual es incorrecta" });
    }

    // 3. Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Actualizar en BD
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);

    res.json({ success: true, message: "Contraseña actualizada exitosamente" });
  } catch (err) {
    console.error("Error al cambiar contraseña:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Error al cambiar contraseña" });
  }
});

// 🔹 Historial de Reuniones
app.get("/meetings/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Reuniones donde es Host o Participante (FILTRADO POR ORG)
    const result = await pool.query(
      `
      SELECT DISTINCT m.id, m.link, m.title, m.meeting_type, m.scheduled_time, m.created_at,
             (m.host_id = $1) as is_host
      FROM meetings m
      LEFT JOIN participants p ON m.id = p.meeting_id
      WHERE (m.host_id = $1 OR p.user_id = $1) AND m.organization_id = $2
      ORDER BY m.created_at DESC
      LIMIT 50
    `,
      [userId, req.user.organizationId],
    );

    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error("Error al obtener historial:", err.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener historial de reuniones",
    });
  }
});

// 🔹 Solicitar recuperación de contraseña
app.post("/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "El email es obligatorio" });
    }

    // 1. Verificar si el usuario existe
    const result = await pool.query(
      "SELECT id, name FROM users WHERE email = $1",
      [email],
    );
    if (result.rows.length === 0) {
      // Por seguridad, no decimos si el email existe o no
      return res.json({
        success: true,
        message:
          "Si el correo está registrado, recibirás un enlace de recuperación.",
      });
    }

    const user = result.rows[0];

    // 2. Generar Token Seguro
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000); // 1 hora de validez

    // 3. Guardar en BD
    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3",
      [token, expiry, user.id],
    );

    // 4. Enviar Email
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"ASICME Meet" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Recuperación de Contraseña - ASICME Meet",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #1a73e8; text-align: center;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para continuar:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer Contraseña</a>
          </div>
          <p style="font-size: 12px; color: #666;">Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 10px; color: #999; text-align: center;">ASICME Meet © 2026 - Videoconferencias Profesionales</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message:
        "Si el correo está registrado, recibirás un enlace de recuperación.",
    });
  } catch (err) {
    console.error("Error en forgot-password:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Error al procesar la solicitud" });
  }
});

// 🔹 Restablecer contraseña con el token
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ success: false, error: "Datos incompletos" });
    }

    // 1. Buscar usuario por token y verificar expiración
    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()",
      [token],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "El enlace es inválido o ha expirado" });
    }

    const userId = result.rows[0].id;

    // 2. Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Actualizar contraseña y limpiar token en una sola operación
    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
      [hashedPassword, userId],
    );

    res.json({
      success: true,
      message: "¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.",
    });
  } catch (err) {
    console.error("Error en reset-password:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Error al restablecer la contraseña" });
  }
});

// 🔹 Reuniones activas (admin/debug)
app.get("/meetings/active", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, link FROM meetings WHERE is_active = true",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Obtener datos de la reunión
app.get("/meetings/:link", async (req, res) => {
  try {
    const { link } = req.params;
    console.log(`📥 Solicitud de datos para reunión: ${link}`);

    const result = await pool.query(
      `SELECT id, link, is_active
       FROM meetings
       WHERE link = $1`,
      [link],
    );

    if (result.rows.length === 0) {
      console.log(`❌ Reunión no encontrada: ${link}`);
      return res
        .status(404)
        .json({ success: false, error: "Reunión no encontrada" });
    }

    const meeting = result.rows[0];

    // 2. 🛡️ BLOQUEO ESTRICTO: Si el anfitrión ya la cerró (is_active = false)
    if (!meeting.is_active) {
      return res.status(410).json({
        // 410 significa "Gone" (Ya no existe)
        success: false,
        error: "Esta reunión ha finalizado y ya no está disponible.",
      });
    }

    res.json({
      success: true,
      meeting,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 Finalizar reunión (Cambiar estado a inactivo)
app.post("/meetings/end", async (req, res) => {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ error: "Falta el link de la reunión" });
    }

    console.log(`🛑 Finalizando reunión: ${link}`);

    // 1. Actualizar en la base de datos
    const result = await pool.query(
      "UPDATE meetings SET is_active = false WHERE link = $1 RETURNING id",
      [link],
    );

    // 2. 🟢 NUEVO: Borrar de LiveKit para expulsar a todos
    try {
      const svc = new RoomServiceClient(
        process.env.LIVEKIT_URL,
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
      );
      await svc.deleteRoom(link);
      console.log(`✅ Sala ${link} borrada de LiveKit`);
    } catch (lkErr) {
      console.log(
        `⚠️ No se pudo borrar de LiveKit (quizás ya no existía): ${lkErr.message}`,
      );
    }

    // 3. 🗑️ LIMPIEZA DE ARCHIVOS
    try {
      const filesResult = await pool.query(
        "SELECT file_path FROM meeting_files WHERE meeting_id = (SELECT id FROM meetings WHERE link = $1)",
        [link],
      );

      for (const file of filesResult.rows) {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
          console.log(`🗑️ Archivo eliminado: ${file.file_path}`);
        }
      }

      // La tabla meeting_files limpiará sus filas automáticamente por el ON DELETE CASCADE
      // cuando se borre la reunión (si se borrara) o podemos dejarlas como historial
      // pero sin el archivo físico.
      // Si queremos borrar los registros de archivos explícitamente:
      await pool.query(
        "DELETE FROM meeting_files WHERE meeting_id = (SELECT id FROM meetings WHERE link = $1)",
        [link],
      );
    } catch (fileErr) {
      console.error("❌ Error limpiando archivos:", fileErr);
    }

    res.json({ success: true, message: "Reunión finalizada" });
  } catch (err) {
    console.error("Error al finalizar reunión:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 RUTA PARA OBTENER TOKEN DE VIDEO (LIVEKIT)
app.post("/meetings/get-token", async (req, res) => {
  try {
    const { roomName, participantName, email, avatarUrl } = req.body;

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: "Faltan datos: roomName o participantName" });
    }

    // Generar Hash de Avatar (Gravatar) si hay email
    let metadataObj = {};

    // Avatar personalizado tiene prioridad
    if (avatarUrl) {
      metadataObj.avatarUrl = avatarUrl;
    }

    // Gravatar como fallback si hay email
    if (email) {
      const hash = crypto
        .createHash("md5")
        .update(email.trim().toLowerCase())
        .digest("hex");
      metadataObj.avatarHash = hash;
    }

    const metadata =
      Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : "";

    // Creamos el token usando tus credenciales del .env
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        name: participantName,
        metadata: metadata, // Guardamos el hash en los metadatos
      },
    );

    // Damos permisos para entrar, publicar video, audio, etc.
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    console.log(
      `🎟️ Token generado para ${participantName} en sala ${roomName}`,
    );
    res.json({ token });
  } catch (err) {
    console.error("Error token:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Panel Admin: Listar todos los usuarios
app.get("/admin/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    if (orgId === undefined) {
      console.warn(
        "⚠️ Usuario admin sin organizationId en el token:",
        req.user.email,
      );
      return res.status(403).json({
        success: false,
        error: "Sesión mal formada. Re-inicia sesión.",
      });
    }

    let query =
      "SELECT id, name, email, role, avatar_url, is_verified, created_at, organization_id FROM users";
    let params = [];

    // 🕵️ Lógica de Súper Admin vs Admin de Org
    if (orgId !== 1) {
      query += " WHERE organization_id = $1";
      params.push(orgId);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("❌ ERROR CRÍTICO EN ADMIN USERS:", err);
    res.status(500).json({
      success: false,
      error: "Error al listar usuarios",
      details: err.message,
    });
  }
});

// 🔹 Panel Admin: Logs de Auditoría
app.get("/admin/audit-logs", authenticateToken, isAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT al.*, u.name as user_name, u.email as user_email 
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );

    res.json({ success: true, logs: result.rows });
  } catch (err) {
    console.error("❌ ERROR FETCHING AUDIT LOGS:", err);
    res
      .status(500)
      .json({ success: false, error: "Error al obtener auditoría" });
  }
});

// 🔹 Panel Admin: Estadísticas globales
app.get("/admin/stats", authenticateToken, isAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    let usersQuery = "SELECT COUNT(*) FROM users";
    let meetingsQuery = "SELECT COUNT(*) FROM meetings";
    let activeQuery = "SELECT COUNT(*) FROM meetings WHERE is_active = TRUE";
    let params = [];

    if (orgId !== 1) {
      usersQuery += " WHERE organization_id = $1";
      meetingsQuery += " WHERE organization_id = $1";
      activeQuery += " AND organization_id = $1";
      params.push(orgId);
    }

    const usersCount = await pool.query(usersQuery, params);
    const meetingsCount = await pool.query(meetingsQuery, params);
    const activeMeetingsCount = await pool.query(activeQuery, params);

    // 🔑 Obtener el join_code de la organización y el PLAN
    const orgResult = await pool.query(
      "SELECT join_code, plan, stripe_customer_id, subscription_status FROM organizations WHERE id = $1",
      [orgId],
    );
    const orgData = orgResult.rows[0];

    res.json({
      success: true,
      stats: {
        total_users: parseInt(usersCount.rows[0].count),
        total_meetings: parseInt(meetingsCount.rows[0].count),
        active_meetings: parseInt(activeMeetingsCount.rows[0].count),
        join_code: orgData?.join_code || "N/A",
        plan: orgData?.plan || "free",
        subscription_status: orgData?.subscription_status,
        has_stripe_customer: !!orgData?.stripe_customer_id,
      },
    });
  } catch (err) {
    console.error("❌ ERROR CRÍTICO EN ADMIN STATS:", err);
    res.status(500).json({
      success: false,
      error: "Error al obtener estadísticas",
      details: err.message,
    });
  }
});

// 🔹 Panel Admin: Cambiar rol de usuario
app.put(
  "/admin/users/:id/role",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ success: false, error: "Rol no válido" });
      }

      // 1. Obtener datos del usuario objetivo
      const targetRes = await pool.query(
        "SELECT id, role, organization_id FROM users WHERE id = $1",
        [id],
      );
      if (targetRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Usuario no encontrado" });
      }
      const targetUser = targetRes.rows[0];

      // 2. Si se intenta quitar el rol de admin, verificar que no sea el último
      if (targetUser.role === "admin" && role === "user") {
        const adminCountRes = await pool.query(
          "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = 'admin'",
          [targetUser.organization_id],
        );
        const adminCount = parseInt(adminCountRes.rows[0].count);

        if (adminCount <= 1) {
          return res.status(403).json({
            success: false,
            error:
              "No puedes degradar a este usuario: debe quedar al menos un administrador en la organización.",
          });
        }
      }

      // 4. NUEVO: Límite de 3 administradores por organización
      if (role === "admin" && targetUser.role !== "admin") {
        const adminCountRes = await pool.query(
          "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = 'admin'",
          [targetUser.organization_id],
        );
        const adminCount = parseInt(adminCountRes.rows[0].count);

        if (adminCount >= 3) {
          return res.status(403).json({
            success: false,
            error:
              "Límite alcanzado: Una organización solo puede tener hasta 3 administradores.",
          });
        }
      }

      // 3. Permiso: Un admin solo puede cambiar roles de su propia organización
      // (a menos que sea Súper Admin de la Org 1)
      if (
        req.user.organizationId !== 1 &&
        req.user.organizationId !== targetUser.organization_id
      ) {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para gestionar usuarios de otra empresa.",
        });
      }

      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);

      res.json({
        success: true,
        message: `Rol de usuario ${id} actualizado a ${role}`,
      });
    } catch (err) {
      console.error("Error en admin/role:", err.message);
      res
        .status(500)
        .json({ success: false, error: "Error al actualizar rol" });
    }
  },
);

// 🔹 Panel Admin: Transferir usuario a otra organización (SOLO Súper Admin)
// Este endpoint es un "Mover" (Limpia otras membresías y asigna una nueva como primaria)
app.patch(
  "/admin/users/:id/transfer",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { targetOrganizationId } = req.body;

      if (req.user.organizationId !== 1) {
        return res.status(403).json({
          success: false,
          error:
            "Solo el administrador global puede transferir usuarios entre organizaciones.",
        });
      }

      if (!targetOrganizationId) {
        return res.status(400).json({
          success: false,
          error: "Debe especificar la organización de destino.",
        });
      }

      await client.query("BEGIN");

      // 1. Actualizar organization_id principal
      await client.query(
        "UPDATE users SET organization_id = $1 WHERE id = $2",
        [targetOrganizationId, id],
      );

      // 2. Limpiar membresías antiguas y crear la nueva única
      await client.query("DELETE FROM user_organizations WHERE user_id = $1", [
        id,
      ]);
      await client.query(
        "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, 'user')",
        [id, targetOrganizationId],
      );

      await client.query("COMMIT");
      res.json({ success: true, message: "Usuario transferido exitosamente." });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error en admin/transfer:", err.message);
      res
        .status(500)
        .json({ success: false, error: "Error al transferir usuario." });
    } finally {
      client.release();
    }
  },
);

// 🔹 Panel Admin: Obtener todas las organizaciones de un usuario
app.get(
  "/admin/users/:id/memberships",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Seguridad: Solo super admin (Org 1) puede gestionar membresías de cualquier usuario
      if (req.user.organizationId !== 1) {
        return res
          .status(403)
          .json({ success: false, error: "Permiso denegado" });
      }

      const result = await pool.query(
        `SELECT o.id, o.name, o.slug, uo.role, uo.created_at
         FROM user_organizations uo
         JOIN organizations o ON uo.organization_id = o.id
         WHERE uo.user_id = $1
         ORDER BY o.id ASC`,
        [id],
      );

      res.json({ success: true, memberships: result.rows });
    } catch (err) {
      console.error("Error al obtener membresías:", err.message);
      res
        .status(500)
        .json({ success: false, error: "Error al cargar membresías" });
    }
  },
);

// 🔹 Panel Admin: Añadir usuario a una organización
app.post(
  "/admin/users/:id/organizations",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, role = "user" } = req.body;

      if (req.user.organizationId !== 1) {
        return res
          .status(403)
          .json({ success: false, error: "Permiso denegado" });
      }

      // 1. Insertar membresía
      await pool.query(
        "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [id, organizationId, role],
      );

      // 2. Si el usuario no tiene una organización principal activa, asignar esta
      const userRes = await pool.query(
        "SELECT organization_id FROM users WHERE id = $1",
        [id],
      );
      if (userRes.rows[0] && !userRes.rows[0].organization_id) {
        await pool.query(
          "UPDATE users SET organization_id = $1 WHERE id = $2",
          [organizationId, id],
        );
      }

      res.json({ success: true, message: "Membresía añadida con éxito" });
    } catch (err) {
      console.error("Error al añadir membresía:", err.message);
      res
        .status(500)
        .json({ success: false, error: "Error al añadir membresía" });
    }
  },
);

// 🔹 Panel Admin: Eliminar usuario de una organización
app.delete(
  "/admin/users/:id/organizations/:orgId",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id, orgId } = req.params;

      if (req.user.organizationId !== 1) {
        return res
          .status(403)
          .json({ success: false, error: "Permiso denegado" });
      }

      await client.query("BEGIN");

      // 1. Eliminar membresía
      await client.query(
        "DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
        [id, orgId],
      );

      // 2. Si era su organización principal, buscar otra para asignársela
      const userRes = await client.query(
        "SELECT organization_id FROM users WHERE id = $1",
        [id],
      );
      if (
        userRes.rows[0] &&
        userRes.rows[0].organization_id === parseInt(orgId)
      ) {
        const otherOrg = await client.query(
          "SELECT organization_id FROM user_organizations WHERE user_id = $1 LIMIT 1",
          [id],
        );

        const newOrgId =
          otherOrg.rows.length > 0 ? otherOrg.rows[0].organization_id : null;
        await client.query(
          "UPDATE users SET organization_id = $1 WHERE id = $2",
          [newOrgId, id],
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "Membresía eliminada" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error al eliminar membresía:", err.message);
      res
        .status(500)
        .json({ success: false, error: "Error al eliminar membresía" });
    } finally {
      client.release();
    }
  },
);

// 🔹 Panel Admin: Eliminar/Banear usuario
app.delete("/admin/users/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener datos del usuario objetivo
    const targetRes = await pool.query(
      "SELECT id, role, organization_id FROM users WHERE id = $1",
      [id],
    );
    if (targetRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Usuario no encontrado" });
    }
    const targetUser = targetRes.rows[0];

    // 2. Nota: La comprobación de "último admin" se hace abajo, permitiendo borrarse
    // a sí mismo si hay otros admins disponibles para tomar el mando.

    // 3. SEGURIDAD ADICIONAL: Verificar si es el último admin de su organización
    if (targetUser.role === "admin") {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role = 'admin'",
        [targetUser.organization_id],
      );
      const adminCount = parseInt(adminCountRes.rows[0].count);

      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          error:
            "No puedes eliminar al único administrador de esta organización. Promueve a otro usuario primero.",
        });
      }
    }

    // 4. Permiso: Un admin solo puede borrar usuarios de su propia organización
    // (a menos que sea Súper Admin de la Org 1)
    if (
      req.user.organizationId !== 1 &&
      req.user.organizationId !== targetUser.organization_id
    ) {
      return res.status(403).json({
        success: false,
        error: "No tienes permiso para eliminar usuarios de otra empresa.",
      });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    res.json({ success: true, message: "Usuario eliminado permanentemente" });
  } catch (err) {
    console.error("Error en admin/delete:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Error al eliminar usuario" });
  }
});

// 🔹 Panel Admin: Listar todas las organizaciones (Solo Súper Admin)
app.get(
  "/admin/organizations",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const orgId = req.user.organizationId;

      // Si es Súper Admin (org 1), puede ver TODAS las organizaciones
      if (orgId === 1) {
        const result = await pool.query(
          "SELECT * FROM organizations ORDER BY created_at DESC",
        );
        return res.json({ success: true, organizations: result.rows });
      }

      // Para admins regulares, solo mostrar organizaciones de las que son miembros
      const result = await pool.query(
        `SELECT DISTINCT o.* 
         FROM organizations o
         INNER JOIN user_organizations uo ON o.id = uo.organization_id
         WHERE uo.user_id = $1
         ORDER BY o.created_at DESC`,
        [req.user.userId],
      );

      res.json({ success: true, organizations: result.rows });
    } catch (err) {
      console.error("❌ ERROR CRÍTICO EN ADMIN ORGANIZATIONS (GET):", err);
      res.status(500).json({
        success: false,
        error: "Error al obtener organizaciones",
        details: err.message,
      });
    }
  },
);

// 🔹 Panel Admin: Crear nueva organización (Administradores pueden crear adicionales)
app.post(
  "/admin/organizations",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const currentOrgId = req.user.organizationId;
      const userId = req.user.userId;

      const { name, slug, logo_url } = req.body;

      if (!name || !slug) {
        return res
          .status(400)
          .json({ success: false, error: "Nombre y slug son obligatorios" });
      }

      // Verificar si el slug ya existe
      const slugCheck = await pool.query(
        "SELECT id FROM organizations WHERE slug = $1",
        [slug],
      );
      if (slugCheck.rows.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: "El slug ya está en uso" });
      }

      const result = await pool.query(
        "INSERT INTO organizations (name, slug, logo_url) VALUES ($1, $2, $3) RETURNING *",
        [name, slug, logo_url || null],
      );

      const newOrg = result.rows[0];

      // 🔗 Vincular al administrador actual con la nueva organización
      await pool.query(
        "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)",
        [userId, newOrg.id, "admin"],
      );

      res.status(201).json({ success: true, organization: newOrg });
    } catch (err) {
      console.error("❌ ERROR CRÍTICO EN ADMIN ORGANIZATIONS (POST):", err);
      res.status(500).json({
        success: false,
        error: "Error al crear organización",
        details: err.message,
      });
    }
  },
);

// 🔹 Panel Admin: Eliminar organización
app.delete(
  "/admin/organizations/:id",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // 1. 🛡️ Seguridad: No se puede borrar la organización Global (ID 1)
      const targetOrgId = parseInt(id);

      if (targetOrgId === 1) {
        return res.status(403).json({
          success: false,
          error: "No se puede eliminar la organización global del sistema.",
        });
      }

      // 2. 🛡️ Permiso: Verificar que el usuario sea miembro admin de esta org
      // Super admin (org 1) puede eliminar cualquier org
      console.log(
        `🔍 DELETE ORG - User Org: ${req.user.organizationId}, Target Org: ${targetOrgId}, User ID: ${req.user.userId}`,
      );

      if (req.user.organizationId !== 1) {
        // Verificar si el usuario es admin de la org que intenta eliminar
        const membershipCheck = await pool.query(
          "SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
          [req.user.userId, targetOrgId],
        );

        console.log(`🔍 Membership check result:`, membershipCheck.rows);

        if (
          membershipCheck.rows.length === 0 ||
          membershipCheck.rows[0].role !== "admin"
        ) {
          console.log(`❌ Permission denied - No admin membership found`);
          return res.status(403).json({
            success: false,
            error: "No tienes permiso para eliminar esta organización.",
          });
        }
      }

      // 3. 🧹 Limpieza de Archivos
      const meetingsRes = await pool.query(
        "SELECT id FROM meetings WHERE organization_id = $1",
        [targetOrgId],
      );

      for (const meeting of meetingsRes.rows) {
        const filesRes = await pool.query(
          "SELECT file_path FROM meeting_files WHERE meeting_id = $1",
          [meeting.id],
        );
        for (const file of filesRes.rows) {
          if (fs.existsSync(file.file_path)) {
            try {
              fs.unlinkSync(file.file_path);
            } catch (e) {
              console.error(
                `Error eliminando archivo ${file.file_path}:`,
                e.message,
              );
            }
          }
        }
      }

      // 4. 🗑️ Borrado en Cascada
      const result = await pool.query(
        "DELETE FROM organizations WHERE id = $1 RETURNING name",
        [targetOrgId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Organización no encontrada.",
        });
      }

      res.json({
        success: true,
        message: `La organización "${result.rows[0].name}" ha sido eliminada.`,
      });
    } catch (err) {
      console.error("❌ ERROR AL ELIMINAR ORGANIZACIÓN:", err);
      res.status(500).json({
        success: false,
        error: "Error interno al intentar eliminar la organización",
      });
    }
  },
);

// 🔹 Panel Admin: Actualizar Perfil de Organización
app.put(
  "/admin/organizations/:id",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const targetOrgId = parseInt(id);
      const { name, description, website } = req.body;

      // 1. 🛡️ Permiso: Verificar que el usuario sea miembro admin de esta org
      // Super admin (org 1) puede modificar cualquier org
      if (req.user.organizationId !== 1) {
        // Verificar si el usuario es admin de la org que intenta modificar
        const membershipCheck = await pool.query(
          "SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
          [req.user.userId, targetOrgId],
        );

        if (
          membershipCheck.rows.length === 0 ||
          membershipCheck.rows[0].role !== "admin"
        ) {
          return res.status(403).json({
            success: false,
            error: "No tienes permiso para modificar esta organización.",
          });
        }
      }

      if (!name) {
        return res
          .status(400)
          .json({ success: false, error: "El nombre es obligatorio" });
      }

      // 2. 💾 Actualizar BD
      const result = await pool.query(
        "UPDATE organizations SET name = $1, description = $2, website = $3 WHERE id = $4 RETURNING *",
        [name, description, website, targetOrgId],
      );

      // 📝 AUDIT LOG
      logAction(
        req.user.organizationId,
        req.user.id,
        "ORG_PROFILE_UPDATED",
        { name, website },
        req,
      );

      res.json({
        success: true,
        message: "Perfil de organización actualizado",
        organization: result.rows[0],
      });
    } catch (err) {
      console.error("❌ ERROR AL ACTUALIZAR ORG:", err);
      res.status(500).json({
        success: false,
        error: "Error interno, revisa logs",
        details: err.message,
      });
    }
  },
);

// 🔹 Panel Admin: Transferir Propiedad de Organización
app.post(
  "/admin/organizations/:id/transfer-ownership",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const targetOrgId = parseInt(id);
      const { newOwnerId } = req.body;

      if (!newOwnerId) {
        return res
          .status(400)
          .json({ success: false, error: "ID del nuevo dueño es requerido" });
      }

      // 1. Obtener organización actual para verificar dueño
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE id = $1",
        [targetOrgId],
      );
      if (orgResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Organización no encontrada" });
      }
      const org = orgResult.rows[0];

      // 2. Verificar permisos: Solo el dueño actual o Súper Admin (Global) puede transferir
      const isSuperAdmin = req.user.organizationId === 1;
      const isCurrentOwner = org.owner_id === req.user.id;

      // Si no tiene owner_id asignado (migración legacy), permitimos a cualquier admin de esa org
      const isAuthorized =
        isSuperAdmin ||
        isCurrentOwner ||
        (!org.owner_id && req.user.organizationId === targetOrgId);

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: "Solo el propietario puede transferir la organización",
        });
      }

      // 3. Verificar que el nuevo dueño sea miembro
      const memberCheck = await pool.query(
        "SELECT * FROM user_organizations WHERE user_id = $1 AND organization_id = $2",
        [newOwnerId, targetOrgId],
      );

      if (memberCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "El usuario seleccionado no es miembro de esta organización",
        });
      }

      // 4. Actualizar owner_id
      await pool.query("UPDATE organizations SET owner_id = $1 WHERE id = $2", [
        newOwnerId,
        targetOrgId,
      ]);

      // 5. Asegurar que el nuevo dueño tenga rol de admin
      await pool.query(
        `INSERT INTO user_organizations (user_id, organization_id, role) 
         VALUES ($1, $2, 'admin') 
         ON CONFLICT (user_id, organization_id) 
         DO UPDATE SET role = 'admin'`,
        [newOwnerId, targetOrgId],
      );

      // 📝 AUDIT LOG
      logAction(
        targetOrgId,
        req.user.id,
        "ORG_OWNERSHIP_TRANSFERRED",
        { newOwnerId },
        req,
      );

      res.json({
        success: true,
        message: "Propiedad transferida exitosamente",
      });
    } catch (err) {
      console.error("❌ ERROR TRANSFERENCIA PROPIEDAD:", err);
      res.status(500).json({ success: false, error: "Error interno" });
    }
  },
);

// ---------------------------------------------------------
// 📝 AUDITORÍA (AUDIT LOGS)
// ---------------------------------------------------------

// Helper para registrar acciones
const logAction = async (organizationId, userId, action, details, req) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await pool.query(
      "INSERT INTO audit_logs (organization_id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)",
      [organizationId, userId, action, JSON.stringify(details), ip],
    );
  } catch (err) {
    console.error("❌ ERROR AUDIT LOG:", err);
    // No fallamos la request si falla el log, pero lo reportamos
  }
};

// 🔹 Obtener Logs de Auditoría
app.get("/admin/audit-logs", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const orgId = req.user.organizationId;

    // Si es super admin global (1), ¿ve todo?
    // Por ahora, limitemos a que vea logs de SU organización (la global) o si quiere ver de otra, tendría que cambiar de contexto.
    // Opcional: Si es org 1, podría pasar un ?org_id=X para filtrar.
    // Vamos a hacerlo simple: Ver logs del contexto actual.

    const result = await pool.query(
      `SELECT al.*, u.name as user_name, u.email as user_email 
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );

    res.json({
      success: true,
      logs: result.rows,
    });
  } catch (err) {
    console.error("❌ ERROR FETCHING AUDIT LOGS:", err);
    res
      .status(500)
      .json({ success: false, error: "Error al obtener auditoría" });
  }
});

// ---------------------------------------------------------
// 🔄 (Duplicate Stripe Block Removed)
// ---------------------------------------------------------

// 🔹 Crear Sesión de Checkout (Upgrade)
app.post(
  "/api/billing/create-checkout-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { priceId } = req.body; // e.g., price_H5ggY...
      const orgId = req.user.organizationId;

      // Buscar org y customer_id
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE id = $1",
        [orgId],
      );
      const org = orgResult.rows[0];

      let customerId = org.stripe_customer_id;

      // Si no tiene customer, crearlo
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: org.name,
          metadata: { organizationId: orgId },
        });
        customerId = customer.id;
        await pool.query(
          "UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2",
          [customerId, orgId],
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID_PRO,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=cancelled`,
        subscription_data: {
          metadata: { organizationId: orgId },
        },
      });

      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error("Stripe Checkout Error:", err);
      res.status(500).json({ success: false, error: "Error al iniciar pago." });
    }
  },
);

// 🔹 Portal de Cliente (Gestionar suscripción)
app.post(
  "/api/billing/create-portal-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const orgResult = await pool.query(
        "SELECT stripe_customer_id FROM organizations WHERE id = $1",
        [req.user.organizationId],
      );
      const customerId = orgResult.rows[0]?.stripe_customer_id;

      if (!customerId) {
        return res
          .status(400)
          .json({ success: false, error: "No hay suscripción activa." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin`,
      });

      res.json({ success: true, url: portalSession.url });
    } catch (err) {
      console.error("Stripe Portal Error:", err);
      res.status(500).json({ success: false, error: "Error al abrir portal." });
    }
  },
);

// 🔹 Webhook (Simulado o Real)
// Para localdev sin proxy, esto no se ejecutará desde fuera, pero define la estructura.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      // Si tienes CLI local: stripe listen --forward-to localhost:3000/api/webhooks/stripe
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      // En dev mode relajado, si no hay firma, confiamos en el body si viene parsed (pero con express.raw arriba hay que tener cuidado)
      // Por simplicidad, asumimos que si falla la firma en dev, ignoramos o logueamos.
      console.log(`⚠️ Webhook signature verification failed.`, err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        // Activar plan
        if (session.metadata && session.metadata.organizationId) {
          // Check metadata from subscription_data or session
          // UPDATE org SET plan = 'pro' ...
        }
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        // Actualizar status
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    response.send();
  },
);

// ---------------------------------------------------------
// 🔄 (Duplicate Stripe Block Removed - Final)
// ---------------------------------------------------------

// 🔹 Crear Sesión de Checkout (Upgrade)
app.post(
  "/api/billing/create-checkout-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { priceId } = req.body;
      const orgId = req.user.organizationId;

      // Buscar org y customer_id
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE id = $1",
        [orgId],
      );
      const org = orgResult.rows[0];

      let customerId = org.stripe_customer_id;

      // Si no tiene customer, crearlo
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: org.name,
          metadata: { organizationId: orgId },
        });
        customerId = customer.id;
        await pool.query(
          "UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2",
          [customerId, orgId],
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID_PRO,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=cancelled`,
        subscription_data: {
          metadata: { organizationId: orgId },
        },
      });

      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error("Stripe Checkout Error:", err);
      res.status(500).json({ success: false, error: "Error al iniciar pago." });
    }
  },
);

// 🔹 Portal de Cliente (Gestionar suscripción)
app.post(
  "/api/billing/create-portal-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const orgResult = await pool.query(
        "SELECT stripe_customer_id FROM organizations WHERE id = $1",
        [req.user.organizationId],
      );
      const customerId = orgResult.rows[0]?.stripe_customer_id;

      if (!customerId) {
        return res
          .status(400)
          .json({ success: false, error: "No hay suscripción activa." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin`,
      });

      res.json({ success: true, url: portalSession.url });
    } catch (err) {
      console.error("Stripe Portal Error:", err);
      res.status(500).json({ success: false, error: "Error al abrir portal." });
    }
  },
);

// 🔹 Webhook
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`, err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        if (session.metadata && session.metadata.organizationId) {
          await pool.query(
            "UPDATE organizations SET plan = 'pro', subscription_status = 'active', stripe_subscription_id = $1 WHERE id = $2",
            [session.subscription, session.metadata.organizationId],
          );
        }
        break;
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        // Buscar org por subscription id y downgradear
        await pool.query(
          "UPDATE organizations SET plan = 'free', subscription_status = 'canceled', stripe_subscription_id = NULL WHERE stripe_subscription_id = $1",
          [subscription.id],
        );
        break;
    }

    response.send();
  },
);

// ---------------------------------------------------------
// 💳 SAAS ENDPOINTS
// ---------------------------------------------------------

// 🔹 Crear Sesión de Checkout (Upgrade)
app.post(
  "/api/billing/create-checkout-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { priceId } = req.body;
      const orgId = req.user.organizationId;

      // Buscar org y customer_id
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE id = $1",
        [orgId],
      );
      const org = orgResult.rows[0];

      let customerId = org.stripe_customer_id;

      // Si no tiene customer, crearlo
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: org.name,
          metadata: { organizationId: orgId },
        });
        customerId = customer.id;
        await pool.query(
          "UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2",
          [customerId, orgId],
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID_PRO,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin?payment=cancelled`,
        subscription_data: {
          metadata: { organizationId: orgId },
        },
      });

      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error("Stripe Checkout Error:", err);
      res.status(500).json({ success: false, error: "Error al iniciar pago." });
    }
  },
);

// 🔹 Portal de Cliente (Gestionar suscripción)
app.post(
  "/api/billing/create-portal-session",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const orgResult = await pool.query(
        "SELECT stripe_customer_id FROM organizations WHERE id = $1",
        [req.user.organizationId],
      );
      const customerId = orgResult.rows[0]?.stripe_customer_id;

      if (!customerId) {
        return res
          .status(400)
          .json({ success: false, error: "No hay suscripción activa." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin`,
      });

      res.json({ success: true, url: portalSession.url });
    } catch (err) {
      console.error("Stripe Portal Error:", err);
      res.status(500).json({ success: false, error: "Error al abrir portal." });
    }
  },
);

// ---------------------------------------------------------

// ---------------------------------------------------------
// ⚙️ ENDPOINT: Configuración de Usuario (Notificaciones)
app.put("/api/users/settings", authenticateToken, async (req, res) => {
  try {
    const { notification_preferences } = req.body;

    // Merge actual preferences with new ones
    const currentResult = await pool.query(
      "SELECT notification_preferences FROM users WHERE id = $1",
      [req.user.userId],
    );

    const currentPrefs = currentResult.rows[0]?.notification_preferences || {};
    const newPrefs = { ...currentPrefs, ...notification_preferences };

    await pool.query(
      "UPDATE users SET notification_preferences = $1 WHERE id = $2",
      [JSON.stringify(newPrefs), req.user.userId],
    );

    res.json({ success: true, preferences: newPrefs });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/users/settings", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT notification_preferences FROM users WHERE id = $1",
      [req.user.userId],
    );
    res.json({
      success: true,
      preferences: result.rows[0]?.notification_preferences || {
        instant: true,
        scheduled: true,
        later: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// ⏰ NOTIFICATION SCHEDULER (Cron Logic)
// ---------------------------------------------------------
setInterval(async () => {
  try {
    const now = new Date();

    // 1. ⚡ REUNIONES INSTANTÁNEAS (Loop cada 2 min)
    // Buscamos reuniones activas e instantáneas que no hayan enviado recordatorio en > 2 min
    const instantMeetings = await pool.query(
      `SELECT * FROM meetings 
       WHERE is_active = true 
       AND meeting_type = 'instant'
       AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - INTERVAL '2 minutes')`,
    );

    for (const meeting of instantMeetings.rows) {
      // Obtener miembros de la org que NO están en la reunión
      // Y que tengan activas las notificaciones 'instant'
      const targetUsers = await pool.query(
        `SELECT u.id FROM users u
         LEFT JOIN participants p ON p.user_id = u.id AND p.meeting_id = $1
         WHERE u.organization_id = $2
         AND p.id IS NULL
         AND (u.notification_preferences->>'instant')::boolean IS NOT false`,
        [meeting.id, meeting.organization_id],
      );

      if (targetUsers.rows.length > 0) {
        // Enviar notificaciones
        const message = `🔴 Reunión en curso: ${meeting.title || "Reunión Instantánea"}. ¡Únete ahora!`;
        const link = `/pre-lobby/${meeting.link}`;

        for (const user of targetUsers.rows) {
          await pool.query(
            "INSERT INTO notifications (user_id, type, message, link, meeting_id) VALUES ($1, 'meeting_invite', $2, $3, $4)",
            [user.id, message, link, meeting.id],
          );
        }

        // Actualizar timestamp
        await pool.query(
          "UPDATE meetings SET last_reminded_at = NOW() WHERE id = $1",
          [meeting.id],
        );
        console.log(
          `📡 Recordatorio enviado para reunión instantánea ${meeting.id} a ${targetUsers.rows.length} usuarios.`,
        );
      }
    }

    // 2. 📅 REUNIONES PROGRAMADAS (Recordatorios fijos)
    // Buscamos reuniones futuras que no sean instantáneas
    const scheduledMeetings = await pool.query(
      `SELECT * FROM meetings 
       WHERE is_active = true 
       AND meeting_type IN ('scheduled', 'later')
       AND scheduled_time > NOW()`,
    );

    for (const meeting of scheduledMeetings.rows) {
      const scheduledTime = new Date(meeting.scheduled_time);
      const diffMinutes = (scheduledTime - now) / (1000 * 60);
      const remindersSent = meeting.reminders_track || []; // JSON array

      let typeToSend = null;
      let msg = "";

      // A. Un día antes (Entre 23h y 25h antes)
      if (
        diffMinutes > 1380 &&
        diffMinutes < 1500 &&
        !remindersSent.includes("1d")
      ) {
        typeToSend = "1d";
        msg = `📅 Recordatorio: Mañana tienes la reunión "${meeting.title}" a las ${scheduledTime.toLocaleTimeString()}`;
      }

      // B. Mismo día (Aprox 4 horas antes)
      if (
        diffMinutes > 240 &&
        diffMinutes < 300 &&
        !remindersSent.includes("today")
      ) {
        typeToSend = "today";
        msg = `📅 Hoy tienes: "${meeting.title}" a las ${scheduledTime.toLocaleTimeString()}`;
      }

      // C. 10 Minutos antes (Entre 8 y 12 min)
      if (
        diffMinutes > 8 &&
        diffMinutes < 12 &&
        !remindersSent.includes("10m")
      ) {
        typeToSend = "10m";
        msg = `⏰ En 10 minutos comienza: "${meeting.title}". ¡Prepárate!`;
      }

      if (typeToSend) {
        // Buscar usuarios (filtro por preferencia)
        const prefKey =
          meeting.meeting_type === "later" ? "later" : "scheduled";

        const targetUsers = await pool.query(
          `SELECT id FROM users 
           WHERE organization_id = $1
           AND (notification_preferences->>$2)::boolean IS NOT false`,
          [meeting.organization_id, prefKey],
        );

        for (const user of targetUsers.rows) {
          await pool.query(
            "INSERT INTO notifications (user_id, type, message, link, meeting_id) VALUES ($1, 'system_alert', $2, $3, $4)",
            [user.id, msg, `/pre-lobby/${meeting.link}`, meeting.id],
          );
        }

        // Marcar como enviado
        remindersSent.push(typeToSend);
        await pool.query(
          "UPDATE meetings SET reminders_track = $1 WHERE id = $2",
          [JSON.stringify(remindersSent), meeting.id],
        );
        console.log(
          `📅 Recordatorio (${typeToSend}) enviado para reunión ${meeting.id}`,
        );
      }
    }
  } catch (err) {
    console.error("Error en Notification Scheduler:", err.message);
  }
}, 60000); // Ejecutar cada minuto
// ---------------------------------------------------------
// Se ejecuta cada 60 segundos para borrar salas abandonadas
const cleanupInterval = 60 * 1000; // 60 segundos

setInterval(async () => {
  console.log("🧹 El Agente de Limpieza está revisando salas...");

  try {
    // 1. Buscamos todas las reuniones que la BD dice que están "Activas"
    const activeMeetings = await pool.query(
      "SELECT id, link, created_at, meeting_type, scheduled_time FROM meetings WHERE is_active = true",
    );

    if (activeMeetings.rows.length === 0) return;

    // Conexión con LiveKit para espiar las salas
    const svc = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );

    const now = new Date();

    for (const meeting of activeMeetings.rows) {
      const roomName = meeting.link;
      const createdTime = new Date(meeting.created_at);
      const diffMinutes = (now - createdTime) / (1000 * 60);
      const meetingType = meeting.meeting_type || "instant";
      const scheduledTime = meeting.scheduled_time
        ? new Date(meeting.scheduled_time)
        : null;

      // 🟢 NUEVO: Lógica de tiempo según el tipo
      // Instantáneas: 1 min | Para después (later): 120 min (2 horas)
      // Programadas (scheduled): No se borran hasta 24 horas después de su hora
      let gracePeriod = 10;

      if (meetingType === "later") {
        gracePeriod = 120;
      } else if (meetingType === "scheduled" && scheduledTime) {
        // Si aún no ha llegado la hora, le sumamos un tiempo infinito de gracia
        // para que diffMinutes > gracePeriod sea falso.
        // Si ya pasó, le damos 1440 min (24 horas) desde la hora programada.
        const diffFromScheduled = (now - scheduledTime) / (1000 * 60);
        if (diffFromScheduled < 0) {
          gracePeriod = 999999; // Protegida hasta el futuro
        } else {
          gracePeriod = 1440; // 24 horas después de que pasó su hora
        }

        // Ajustamos diffMinutes para que la comparación sea contra el scheduledTime
        // cuando sea una reunión programada que ya pasó
        if (diffFromScheduled >= 0) {
          // Si ya pasó la hora, verificamos si ya pasaron las 24h de gracia
          if (diffFromScheduled < 1440) continue; // Aún está en gracia
        } else {
          continue; // Aún no es la hora, no borrar
        }
      }

      try {
        // 2. Le preguntamos a LiveKit quién está conectado
        const participants = await svc.listParticipants(roomName);

        // 3. Lógica de Eliminación:
        // Si hay 0 participantes Y han pasado más de gracePeriod minutos
        if (participants.length === 0 && diffMinutes > gracePeriod) {
          console.log(
            `🗑️ Sala vacía y expirada detectada: ${roomName}. Limpiando...`,
          );

          // A. Borrar de LiveKit
          try {
            await svc.deleteRoom(roomName);
          } catch (e) {
            // Si la sala no existe en LiveKit, ignoramos el error
          }

          // B. Borrar de la Base de Datos (Limpieza completa)
          try {
            await pool.query("DELETE FROM participants WHERE meeting_id = $1", [
              meeting.id,
            ]);
            await pool.query("DELETE FROM meetings WHERE id = $1", [
              meeting.id,
            ]);
            console.log(
              `✅ Reunión ${roomName} (ID: ${meeting.id}) eliminada por inactividad.`,
            );
          } catch (dbErr) {
            console.error(
              `❌ Error al borrar reunión ${meeting.id} de la BD:`,
              dbErr.message,
            );
          }

          // C. Borrar Archivos Físicos (NUEVO)
          try {
            const filesResult = await pool.query(
              "SELECT file_path FROM meeting_files WHERE meeting_id = $1",
              [meeting.id],
            );

            for (const file of filesResult.rows) {
              if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path);
                console.log(`🗑️ (Auto) Archivo eliminado: ${file.file_path}`);
              }
            }
            // No necesitamos borrar de DB explícitamente porque borramos la reunión y hay CASCADE
          } catch (fileErr) {
            console.error("❌ Error limpiando archivos en cleanup:", fileErr);
          }
        }
      } catch (err) {
        // Si hay error al listar participantes (ej: sala no existe en LiveKit)
        // Y la reunión es vieja (> gracePeriod min), la borramos de la BD
        if (diffMinutes > gracePeriod) {
          console.log(
            `👻 Sala fantasma detectada en BD: ${roomName} (ID: ${meeting.id}). Limpiando...`,
          );
          try {
            await pool.query("DELETE FROM participants WHERE meeting_id = $1", [
              meeting.id,
            ]);
            await pool.query("DELETE FROM meetings WHERE id = $1", [
              meeting.id,
            ]);
            console.log(
              `✅ Sala fantasma ${roomName} (ID: ${meeting.id}) removida de la BD.`,
            );
          } catch (dbErr) {
            console.error(
              `❌ Error al borrar sala fantasma ${meeting.id}:`,
              dbErr.message,
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error en el Agente de Limpieza:", err.message);
  }
}, cleanupInterval);

// --- MANEJO DE SEÑALES Y ERRORES ---

process.on("uncaughtException", (err) => {
  console.error("❌ EXCEPCIÓN NO CAPTURADA:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ PROMESA NO MANEJADA:", reason);
});

// Middleware de Manejo de Errores (Catch-all)
app.use((err, req, res, next) => {
  console.error("❌ ERROR NO CONTROLADO:", err.stack);
  res.status(500).json({ success: false, error: "Error interno del servidor" });
});

// --- INICIO ROBUSTO (Para Render/Despliegues) ---
// Forzar el inicio del servidor si estamos en Render o si hay un puerto definido y no es una importación silenciosa
const PORT_TO_LIVE = process.env.PORT || 10000;

// Intentar escuchar siempre en Render para evitar "Port scan timeout"
if (process.env.RENDER || (process.env.PORT && !process.env.IS_IMPORT)) {
  app.listen(PORT_TO_LIVE, "0.0.0.0", () => {
    console.log(`🚀 [BACKEND-OK] Servidor activo en puerto: ${PORT_TO_LIVE}`);
    console.log(`📡 Entorno: ${process.env.NODE_ENV || "production"}`);
  });
}

export default app;
export { app };
