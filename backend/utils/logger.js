import { pool } from "../db.js";

/**
 * Registra una acción en la tabla audit_logs
 * @param {number} organizationId - ID de la organización
 * @param {number} userId - ID del usuario que realiza la acción
 * @param {string} action - Nombre de la acción
 * @param {object} details - Detalles adicionales en formato JSON
 * @param {object} req - Objeto de la solicitud Express (para extraer IP)
 */
export async function logAction(organizationId, userId, action, details, req) {
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
}
