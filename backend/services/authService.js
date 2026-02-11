import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db.js';
import { config } from '../config/index.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { logAction } from '../utils/logger.js';

const client = new OAuth2Client(config.google.clientId);

/**
 * Register a new user
 */
export async function registerUser({ name, email, password, organizationName }) {
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Create organization
  const userUUID = crypto.randomUUID();
  const orgName = organizationName || `Organización de ${name}`;
  const orgSlug = `org-${userUUID.slice(0, 8)}`;
  const joinCode = Math.random().toString(36).substring(7).toUpperCase();
  
  const orgResult = await pool.query(
    'INSERT INTO organizations (name, slug, join_code) VALUES ($1, $2, $3) RETURNING id',
    [orgName, orgSlug, joinCode]
  );
  const organizationId = orgResult.rows[0].id;
  
  // Create user
  const userResult = await pool.query(
    `INSERT INTO users (name, email, password, organization_id, is_verified, verification_token)
     VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id, name, email, organization_id`,
    [name, email, hashedPassword, organizationId, verificationToken]
  );
  const user = userResult.rows[0];
  
  // Add user to organization with admin role
  await pool.query(
    'INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)',
    [user.id, organizationId, 'admin']
  );
  
  // Set owner
  await pool.query(
    'UPDATE organizations SET owner_id = $1 WHERE id = $2',
    [user.id, organizationId]
  );
  
  // Send verification email
  await sendVerificationEmail(email, verificationToken);
  
  return { user, organizationId, joinCode };
}

/**
 * Login user
 */
export async function loginUser(email, password) {
  // Find user (case-insensitive)
  const userResult = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  
  if (userResult.rows.length === 0) {
    console.warn(`🔒 Login fallido: Usuario no encontrado (${email})`);
    throw new Error('Credenciales inválidas');
  }
  
  const user = userResult.rows[0];
  
  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    console.warn(`🔒 Login fallido: Contraseña incorrecta para (${email})`);
    throw new Error('Credenciales inválidas');
  }
  
  // Check if verified
  if (!user.is_verified) {
    throw new Error('Por favor verifica tu email antes de iniciar sesión');
  }
  
  // Get user's role in their organization
  const roleResult = await pool.query(
    'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [user.id, user.organization_id]
  );
  
  const role = roleResult.rows[0]?.role || 'user';
  
  // Get full user data
  const fullUserResult = await pool.query(
    `SELECT u.id, u.name, u.email, u.organization_id, u.avatar_url, u.is_verified,
            o.name as organization_name, o.logo_url as organization_logo_url,
            uo.role
     FROM users u
     LEFT JOIN organizations o ON u.organization_id = o.id
     LEFT JOIN user_organizations uo ON u.id = uo.user_id AND (u.organization_id = uo.organization_id OR u.organization_id IS NULL)
     WHERE u.id = $1
     LIMIT 1`,
    [user.id]
  );
  
  if (fullUserResult.rows.length === 0) {
    console.error(`❌ Error crítico: No se pudo recuperar data completa para usuario ${user.id} tras login`);
    throw new Error('Error al iniciar sesión: datos de perfil no encontrados');
  }
  
  const fullUser = fullUserResult.rows[0];
  
  // Generate tokens
  const userForToken = {
    id: fullUser.id,
    email: fullUser.email,
    role: fullUser.role,
    organization_id: fullUser.organization_id,
  };
  
  const accessToken = generateAccessToken(userForToken);
  const refreshToken = generateRefreshToken(userForToken);
  
  return {
    user: fullUser,
    accessToken,
    refreshToken,
  };
}

/**
 * Verify email
 */
export async function verifyEmail(token) {
  const result = await pool.query(
    'SELECT id, email FROM users WHERE verification_token = $1',
    [token]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Token de verificación inválido o expirado');
  }
  
  const user = result.rows[0];
  
  await pool.query(
    'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1',
    [user.id]
  );
  
  return user;
}

/**
 * Resend verification email
 */
export async function resendVerification(email) {
  const result = await pool.query(
    'SELECT id, is_verified FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }
  
  const user = result.rows[0];
  
  if (user.is_verified) {
    throw new Error('Este email ya está verificado');
  }
  
  const newToken = crypto.randomBytes(32).toString('hex');
  
  await pool.query(
    'UPDATE users SET verification_token = $1 WHERE id = $2',
    [newToken, user.id]
  );
  
  await sendVerificationEmail(email, newToken);
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email) {
  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return;
  }
  
  const user = result.rows[0];
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = Date.now() + 3600000; // 1 hour
  
  await pool.query(
    'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
    [resetToken, resetTokenExpiry, user.id]
  );
  
  await sendPasswordResetEmail(email, resetToken);
}

/**
 * Reset password
 */
export async function resetPassword(token, newPassword) {
  const result = await pool.query(
    'SELECT id, reset_token_expiry FROM users WHERE reset_token = $1',
    [token]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Token de restablecimiento inválido o expirado');
  }
  
  const user = result.rows[0];
  
  if (Date.now() > user.reset_token_expiry) {
    throw new Error('El token ha expirado');
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await pool.query(
    'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
    [hashedPassword, user.id]
  );
}

/**
 * Refresh user session with full data
 */
export async function refreshUserSession(userId) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.organization_id, u.avatar_url, u.is_verified, 
            o.name as organization_name, o.logo_url as organization_logo_url,
            uo.role
     FROM users u
     JOIN organizations o ON u.organization_id = o.id
     JOIN user_organizations uo ON u.id = uo.user_id AND u.organization_id = uo.organization_id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found or not linked to organization');
  }

  const user = result.rows[0];

  const userForToken = {
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
  };

  const accessToken = generateAccessToken(userForToken);
  const refreshToken = generateRefreshToken(userForToken);

  return {
    user,
    accessToken,
    refreshToken,
  };
}

/**
 * Get user memberships
 */
export async function getUserMemberships(userId) {
  const result = await pool.query(
    `SELECT o.id, o.name, o.slug, o.logo_url, uo.role
     FROM user_organizations uo
     JOIN organizations o ON uo.organization_id = o.id
     WHERE uo.user_id = $1
     ORDER BY o.name`,
    [userId]
  );
  
  return result.rows;
}

/**
 * Switch organization
 */
export async function switchOrganization(userId, organizationId) {
  // Verify user belongs to organization
  const result = await pool.query(
    `SELECT uo.role, o.name, o.logo_url
     FROM user_organizations uo
     JOIN organizations o ON uo.organization_id = o.id
     WHERE uo.user_id = $1 AND uo.organization_id = $2`,
    [userId, organizationId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('No tienes acceso a esta organización');
  }
  
  const { role, name, logo_url } = result.rows[0];
  
  // Update user's current organization
  await pool.query(
    'UPDATE users SET organization_id = $1 WHERE id = $2',
    [organizationId, userId]
  );
  
  // Get user data
  const userResult = await pool.query(
    'SELECT id, name, email, avatar_url FROM users WHERE id = $1',
    [userId]
  );
  
  const user = userResult.rows[0];
  
  // Generate new token with new org
  const userForToken = {
    id: user.id,
    email: user.email,
    role,
    organization_id: organizationId,
  };
  
  const accessToken = generateAccessToken(userForToken);
  const refreshToken = generateRefreshToken(userForToken);
  
  return {
    user: {
      ...user,
      organization_id: organizationId,
      organization_name: name,
      organization_logo_url: logo_url,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Handle Google OAuth login/register
 */
export async function googleAuth(token, req) {
  // 1. Verify token with Google
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  const { email, sub: googleId, name, picture } = payload;

    // Check if user already exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
  let user = userResult.rows[0];

  // 3. If user doesn't exist, create it
  if (!user) {
    const userUUID = crypto.randomUUID();
    const orgName = `Organización de ${name}`;
    const orgSlug = `org-${userUUID.slice(0, 8)}`;
    const joinCode = Math.random().toString(36).substring(7).toUpperCase();

    // Create organization
    const orgResult = await pool.query(
      'INSERT INTO organizations (name, slug, join_code) VALUES ($1, $2, $3) RETURNING id',
      [orgName, orgSlug, joinCode]
    );
    const organizationId = orgResult.rows[0].id;

    // Create user
    const newUserResult = await pool.query(
      `INSERT INTO users (name, email, organization_id, google_id, auth_provider, avatar_url, is_verified)
       VALUES ($1, $2, $3, $4, 'google', $5, TRUE) RETURNING *`,
      [name, email, organizationId, googleId, picture]
    );
    user = newUserResult.rows[0];

    // Link in user_organizations with admin role
    await pool.query(
      "INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, 'admin')",
      [user.id, organizationId]
    );

    // Set as owner
    await pool.query("UPDATE organizations SET owner_id = $1 WHERE id = $2", [
      user.id,
      organizationId,
    ]);

    // Audit Log
    await logAction(organizationId, user.id, "USER_CREATED_GOOGLE", { email }, req);
  } else {
    // 4. If user exists but not linked to Google
    if (!user.google_id) {
      await pool.query(
        "UPDATE users SET google_id = $1, auth_provider = 'google_linked', is_verified = TRUE WHERE id = $2",
        [googleId, user.id]
      );
    }
  }

  // 5. Get refreshed user and role
  const roleResult = await pool.query(
    'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [user.id, user.organization_id]
  );
  const role = roleResult.rows[0]?.role || 'user';

  // 6. Generate tokens using the utility (standardized payload)
  const userForToken = {
    id: user.id,
    email: user.email,
    role,
    organization_id: user.organization_id,
  };

  const accessToken = generateAccessToken(userForToken);
  const refreshToken = generateRefreshToken(userForToken);

  // 7. Get full user data for response
  const fullUserResult = await pool.query(
    `SELECT u.id, u.name, u.email, u.organization_id, u.avatar_url,
            o.name as organization_name, o.logo_url as organization_logo_url
     FROM users u
     LEFT JOIN organizations o ON u.organization_id = o.id
     WHERE u.id = $1`,
    [user.id]
  );

  return {
    user: fullUserResult.rows[0],
    accessToken,
    refreshToken,
  };
}
