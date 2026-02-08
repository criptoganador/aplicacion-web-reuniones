import jwt from "jsonwebtoken";

/**
 * Genera un Access Token (corta duración: 15 minutos)
 * @param {Object} user - Objeto del usuario con id, email, role
 * @returns {string} JWT token
 */
export function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRATION || "15m",
  });
}

/**
 * Genera un Refresh Token (larga duración: 7 días)
 * @param {Object} user - Objeto del usuario con id
 * @returns {string} JWT token
 */
export function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRATION || "7d",
  });
}

/**
 * Verifica y decodifica un Access Token
 * @param {string} token - JWT token
 * @returns {Object} Payload decodificado
 * @throws {Error} Si el token es inválido o expirado
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    throw new Error("Token inválido o expirado");
  }
}

/**
 * Verifica y decodifica un Refresh Token
 * @param {string} token - JWT token
 * @returns {Object} Payload decodificado
 * @throws {Error} Si el token es inválido o expirado
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error("Refresh token inválido o expirado");
  }
}
