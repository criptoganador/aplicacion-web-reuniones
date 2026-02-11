import { verifyAccessToken } from "../utils/jwt.js";
import { pool } from "../db.js";

/**
 * Middleware para verificar que el usuario está autenticado
 * Lee el token del header Authorization y verifica su validez
 */
export async function authenticateToken(req, res, next) {
  console.log("➡️ authenticateToken: Verificando token de acceso...");
  // 1. Obtener token del header Authorization
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

  if (!token) {
    console.log("❌ authenticateToken: Token no proporcionado.");
    return res.status(401).json({
      success: false,
      error: "Token de acceso requerido",
    });
  }

  try {
    // 2. Verificar y decodificar token
    const decoded = verifyAccessToken(token);

    // 3. SEGURIDAD: Verificar que el usuario todavía existe y pertenece a la org especificada
    const userRes = await pool.query(
      `SELECT u.id, u.is_verified, o.name as organization_name, uo.role as org_role
       FROM users u
       JOIN user_organizations uo ON u.id = uo.user_id
       JOIN organizations o ON uo.organization_id = o.id
       WHERE u.id = $1 AND uo.organization_id = $2`,
      [decoded.userId, decoded.organizationId],
    );

    if (userRes.rows.length === 0) {
      console.log(
        `❌ authenticateToken: Usuario ${decoded.userId} no tiene acceso a la Org ${decoded.organizationId} o no existe.`,
      );
      return res.status(401).json({
        success: false,
        error: "Sesión inválida o sin permisos para esta organización",
        code: "UNAUTHORIZED_ORG",
      });
    }

    const dbUser = userRes.rows[0];

    // 4. Agregar info del usuario al request (usando datos frescos de la BD y el rol específico de la Org)
    req.user = {
      ...decoded,
      role: dbUser.org_role,
      is_verified: dbUser.is_verified,
      organizationName: dbUser.organization_name
    };

    console.log(
      "✅ authenticateToken: Token y usuario verificados:",
      decoded.userId,
    );

    // 5. Continuar al siguiente middleware/ruta
    next();
  } catch (error) {
    // Detectar si fue por expiración
    const isExpired = error.message && error.message.includes("expirado");

    return res.status(isExpired ? 401 : 403).json({
      success: false,
      error: error.message || "Token inválido",
      code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }
}

/**
 * Middleware para verificar que el usuario tiene un rol específico
 * @param {...string} allowedRoles - Roles permitidos (ej: 'admin', 'user')
 * @returns {Function} Middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "No autenticado",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "No tienes permisos para esta acción",
      });
    }

    next();
  };
}
export const isAdmin = requireRole("admin");
