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
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "./utils/jwt.js";
import { authenticateToken, isAdmin } from "./middleware/auth.js";
import Joi from "joi";
import admin from "firebase-admin";

// --- INICIALIZACIÓN FIREBASE ADMIN (Opcional) ---
let bucket;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: "video-confrerncia.appspot.com",
    });
  }
  bucket = admin.storage().bucket();
  console.log("✅ Firebase Admin inicializado correctamente.");
} catch (error) {
  console.warn(
    "⚠️ No se pudo inicializar Firebase Admin. Se usará almacenamiento local para subidas.",
  );
  bucket = null;
}

dotenv.config();

// Configuración de CORS dinámica
const allowedOrigins = [
  "http://localhost:5173",
  "https://video-confrerncia.web.app",
  "https://video-confrerncia.firebaseapp.com",
  process.env.FRONTEND_URL, // ✨ Render Frontend URL
].filter(Boolean); // Eliminar valores nulos/undefined

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como apps móviles o curl)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      process.env.NODE_ENV !== "production"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

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

const { Pool } = pg;
const app = express();

// Usamos el puerto del .env o el 4000 por defecto
const PORT = process.env.PORT || 10000;

// ---------------------------
// Configuración Neon (SEGURA)
// ---------------------------
export const pool = new Pool({
  // Ahora lee la URL desde el archivo .env
  connectionString: process.env.DATABASE_URL,
});

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
// Inicialización de Tablas (Solo si no existen)
// ---------------------------
const initDb = async () => {
  try {
    // 1. ✨ CREACIÓN DE TABLAS INDIVIDUAL (Más robusto)

    // Organizaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        join_code TEXT UNIQUE,
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expiry BIGINT,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Reuniones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        link TEXT UNIQUE NOT NULL,
        meeting_type TEXT DEFAULT 'instant',
        title TEXT,
        scheduled_time TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Participantes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mensajes de Chat (Asegurar meeting_id)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Archivos de Reunión
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meeting_files (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. ✨ MIGRACIONES Y REFUERZOS (DO BLOCK)
    await pool.query(`
      DO $$
      BEGIN
        -- Asegurar organization por defecto
        IF NOT EXISTS (SELECT 1 FROM organizations LIMIT 1) THEN
          INSERT INTO organizations (name, slug, join_code) VALUES ('ASICME Global', 'asicme-global', 'GLOBAL');
        END IF;

        -- Migrar registros nulos a la primera organización disponible
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id') THEN
          UPDATE users SET organization_id = (SELECT id FROM organizations ORDER BY id ASC LIMIT 1) WHERE organization_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='organization_id') THEN
          UPDATE meetings SET organization_id = (SELECT id FROM organizations ORDER BY id ASC LIMIT 1) WHERE organization_id IS NULL;
        END IF;

        -- Reforzar Constraints de CASCADE
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'meetings_host_id_fkey') THEN
          ALTER TABLE meetings DROP CONSTRAINT meetings_host_id_fkey;
        END IF;
        ALTER TABLE meetings ADD CONSTRAINT meetings_host_id_fkey FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'participants_user_id_fkey') THEN
          ALTER TABLE participants DROP CONSTRAINT participants_user_id_fkey;
        END IF;
        ALTER TABLE participants ADD CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'participants_meeting_id_fkey') THEN
          ALTER TABLE participants DROP CONSTRAINT participants_meeting_id_fkey;
        END IF;
        ALTER TABLE participants ADD CONSTRAINT participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_messages_sender_id_fkey') THEN
          ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_sender_id_fkey;
        END IF;
        ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

      END $$;
    `);

    console.log("✅ Base de Datos inicializada correctamente.");
  } catch (err) {
    console.error("❌ Error inicializando la Base de Datos:", err.stack);
  }
};
initDb();

// ---------------------------
// Middleware
// ---------------------------
app.use(
  cors({
    origin: "http://localhost:5173", // Frontend URL
    credentials: true, // Permitir cookies
  }),
);
app.use(express.json());

// LOGGING MIDDLEWARE (Debug)
app.use((req, res, next) => {
  console.log(`📡 Request received: ${req.method} ${req.path}`);
  next();
});

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
app.use("/uploads", express.static(uploadDir));

// ENDPOINT DE SUBIDA (Híbrido: Firebase o Local)
app.post("/upload", upload.single("file"), async (req, res) => {
  console.log(`📂 Upload endpoint hit! Mode: ${bucket ? "Firebase" : "Local"}`);

  if (!req.file) {
    return res.status(400).json({ error: "No se envió ningún archivo" });
  }

  const { meeting_id } = req.body;
  const fileName = `${Date.now()}-${req.file.originalname}`;

  // --- MODO FIREBASE ---
  if (bucket) {
    const file = bucket.file(fileName);
    try {
      const blobStream = file.createWriteStream({
        metadata: { contentType: req.file.mimetype },
      });

      blobStream.on("error", (err) => {
        console.error("❌ Error uploading to Storage:", err);
        if (!res.headersSent)
          res.status(500).json({ error: "Error al subir a la nube" });
      });

      blobStream.on("finish", async () => {
        try {
          await file.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
          console.log("✅ File saved to Cloud:", publicUrl);

          if (meeting_id) {
            await saveFileReference(
              meeting_id,
              publicUrl,
              req.file.originalname,
            );
          }

          res.json({
            secure_url: publicUrl,
            name: req.file.originalname,
            filename: fileName,
          });
        } catch (innerErr) {
          console.error("❌ Error completing upload:", innerErr);
          if (!res.headersSent)
            res.status(500).json({ error: "Fallo al procesar archivo" });
        }
      });

      blobStream.end(req.file.buffer);
    } catch (err) {
      console.error("❌ Error general en upload:", err);
      if (!res.headersSent)
        res.status(500).json({ error: "Fallo crítico en subida" });
    }
  }
  // --- MODO LOCAL ---
  else {
    try {
      // Guardar archivo en disco
      const localFilePath = path.join(uploadDir, fileName);
      fs.writeFileSync(localFilePath, req.file.buffer);

      // Generar URL local
      // Asegurar que FRONTEND pueda acceder a esta URL (servida estáticamente)
      const protocol = req.protocol;
      const host = req.get("host");
      const publicUrl = `${protocol}://${host}/uploads/${fileName}`;

      console.log("✅ File saved Locally:", publicUrl);

      if (meeting_id) {
        await saveFileReference(meeting_id, publicUrl, req.file.originalname);
      }

      res.json({
        secure_url: publicUrl,
        name: req.file.originalname,
        filename: fileName,
      });
    } catch (err) {
      console.error("❌ Error saving file locally:", err);
      res
        .status(500)
        .json({ error: "No se pudo guardar el archivo localmente." });
    }
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

// ENDPOINT DE DESCARGA FORZADA (Cloud)
app.get("/download/:filename", async (req, res) => {
  const filename = req.params.filename;
  try {
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }
    const cleanName = filename.split("-").slice(1).join("-");
    res.setHeader("Content-disposition", `attachment; filename=${cleanName}`);
    file.createReadStream().pipe(res);
  } catch (err) {
    console.error("❌ Error en descarga:", err);
    res.status(500).json({ error: "No se pudo descargar" });
  }
});

app.use(cookieParser()); // Para leer cookies HTTP-only

// ---------------------------
// Root (health check)
// ---------------------------
app.get("/", (req, res) => {
  res.send(`ASICME Meet backend OK en puerto ${PORT} 🚀`);
});

// ===========================
// MEETINGS
// ===========================

// 🔹 Crear reunión instantánea (PROTEGIDO)
app.post("/meetings/start", authenticateToken, async (req, res) => {
  try {
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
       RETURNING id, link, is_active, meeting_type, title, scheduled_time, organized_by, organization_id`,
      [
        host_id || null,
        link,
        meeting_type || "instant",
        title || null,
        scheduled_time || null,
        organized_by || null,
        req.user.organizationId, // 🏢 De la sesión del usuario
      ],
    );

    const meeting = result.rows[0];

    // Host como participante (si existe)
    if (host_id) {
      await pool.query(
        "INSERT INTO participants (meeting_id, user_id) VALUES ($1, $2)",
        [meeting.id, host_id],
      );
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
    // 1. Recibimos el meeting_id, name y email del frontend
    const { meeting_id, name, email } = req.body;

    if (!meeting_id || !name || !email) {
      return res
        .status(400)
        .json({ error: "Faltan datos: ID, nombre o email" });
    }

    console.log(
      `📧 Procesando ingreso para: ${email} en reunión: ${meeting_id}`,
    );

    let userId;

    // 2. VERIFICAR SI EL USUARIO YA EXISTE
    const userCheck = await pool.query(
      "SELECT id, organization_id FROM users WHERE email = $1",
      [email],
    );

    // Obtener la organización de la reunión
    const meetingRes = await pool.query(
      "SELECT organization_id FROM meetings WHERE id = $1",
      [meeting_id],
    );
    const meetingOrgId = meetingRes.rows[0]?.organization_id;

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
      [meeting_id, userId],
    );

    if (participantCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO participants (meeting_id, user_id) VALUES ($1, $2)",
        [meeting_id, userId],
      );
      console.log(`🔗 Usuario ${userId} unido a la reunión ${meeting_id}`);
    } else {
      console.log(`⚠️ El usuario ${userId} ya estaba en la reunión.`);
    }

    res.json({ success: true, user_id: userId });
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

    const { name, email, password, role, orgName, joinCode } = value;

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

    // 11. Respuesta Exitosa
    if (finalVerified) {
      // 🚀 AUTO-LOGIN para usuarios auto-verificados (como el primer admin)
      const userRecord = {
        id: resultInsert.rows[0].id,
        name,
        email,
        role: finalRole,
        organization_id: finalOrgId,
      };

      const accessToken = generateAccessToken(userRecord);
      const refreshToken = generateRefreshToken(userRecord);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
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

    // 3. Log en consola
    console.log("------------------------------------------");
    console.log(`🔄 NUEVO CÓDIGO REENVIADO PARA ${email}: [ ${newOTP} ]`);
    console.log("------------------------------------------");

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

    const { email, password } = value;

    // 2. Buscar usuario
    const result = await pool.query(
      "SELECT id, name, email, password, role, avatar_url, is_verified, organization_id FROM users WHERE email = $1",
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
      sameSite: "strict",
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
  try {
    // 1. Obtener refresh token de la cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.json({
        success: false,
        error: "No hay sesión activa",
      });
    }

    // 2. Verificar refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // 3. Buscar usuario en BD
    const result = await pool.query(
      "SELECT id, name, email, role, avatar_url, organization_id FROM users WHERE id = $1",
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
    console.error("Error en refresh:", err.message);
    res.json({
      success: false,
      error: "Sesión expirada o inválida",
    });
  }
});

// 🔹 Logout
app.post("/auth/logout", (req, res) => {
  // Eliminar cookie de refresh token
  res.clearCookie("refreshToken");

  res.json({
    success: true,
    message: "Sesión cerrada exitosamente",
  });
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
    const hashedBtn = await bcrypt.hash(newPassword, salt);

    // 4. Actualizar en BD
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedBtn,
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
app.post("/auth/forgot-password", async (req, res) => {
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

    // 🔑 Obtener el join_code de la organización del admin
    const orgResult = await pool.query(
      "SELECT join_code FROM organizations WHERE id = $1",
      [orgId],
    );
    const joinCode = orgResult.rows[0]?.join_code || "N/A";

    res.json({
      success: true,
      stats: {
        total_users: parseInt(usersCount.rows[0].count),
        total_meetings: parseInt(meetingsCount.rows[0].count),
        active_meetings: parseInt(activeMeetingsCount.rows[0].count),
        join_code: joinCode,
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

      if (orgId !== 1) {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para ver todas las organizaciones",
        });
      }

      const result = await pool.query(
        "SELECT * FROM organizations ORDER BY created_at DESC",
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

// 🔹 Panel Admin: Crear nueva organización (Solo Súper Admin)
app.post(
  "/admin/organizations",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const orgId = req.user.organizationId;

      if (orgId !== 1) {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para crear organizaciones",
        });
      }

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

      res.status(201).json({ success: true, organization: result.rows[0] });
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

// ---------------------------------------------------------
// 🧹 AGENTE DE LIMPIEZA AUTOMÁTICO (GARBAGE COLLECTOR)
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
      // Instantáneas: 5 min | Para después (later): 120 min (2 horas)
      // Programadas (scheduled): No se borran hasta 24 horas después de su hora
      let gracePeriod = 5;

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

// Solo arrancar el servidor si estamos en desarrollo local
if (process.env.NODE_ENV !== "production" && !process.env.FUNCTIONS_EMULATOR) {
  app.listen(PORT, () => {
    console.log(`🔥 Backend listo en http://localhost:${PORT}`);
  });
}

// Exportar para Firebase Functions
export default app;
export { app };
