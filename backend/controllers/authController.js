import * as authService from '../services/authService.js';
import { verifyRefreshToken } from '../utils/jwt.js';
import { config } from '../config/index.js';

/**
 * Register new user
 */
export async function register(req, res) {
  try {
    const { name, email, password, organizationName, role, joinCode } = req.body;
    
    const { user, organizationId, joinCode: orgJoinCode } = await authService.registerUser({
      name,
      email,
      password,
      organizationName,
      role,
      joinCode,
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado. Por favor verifica tu email.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organization_id: organizationId,
      },
      joinCode,
    });
  } catch (error) {
    // Log full stack for easier debugging after DB reset
    console.error('❌ Error en registro:', error.stack || error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error al registrar usuario',
    });
  }
}

/**
 * Login user
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);
    
    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.json({
      success: true,
      user,
      accessToken,
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Error al iniciar sesión',
    });
  }
}

/**
 * Handle Google OAuth login
 */
export async function googleLogin(req, res) {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token de Google no proporcionado',
      });
    }

    const { user, accessToken, refreshToken } = await authService.googleAuth(token, req);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax', // Correct sameSite for cross-domain prod
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      user,
      accessToken,
    });
  } catch (error) {
    console.error('❌ Error en Google Login:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Error al iniciar sesión con Google',
    });
  }
}

/**
 * Verify email
 */
export async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    
    await authService.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verificado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en verificación:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error al verificar email',
    });
  }
}

/**
 * Resend verification email
 */
export async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    
    await authService.resendVerification(email);
    
    res.json({
      success: true,
      message: 'Email de verificación reenviado',
    });
  } catch (error) {
    console.error('❌ Error al reenviar verificación:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Request password reset
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    
    await authService.requestPasswordReset(email);
    
    res.json({
      success: true,
      message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña',
    });
  } catch (error) {
    console.error('❌ Error en forgot password:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar solicitud',
    });
  }
}

/**
 * Reset password
 */
export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    
    await authService.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en reset password:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token no proporcionado',
      });
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    
    // Refresh user session and get new tokens (with full data)
    const { user, accessToken: newAccessToken, refreshToken: newRefreshToken } = 
      await authService.refreshUserSession(decoded.userId);
    
    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.json({
      success: true,
      user,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('❌ Error en refresh token:', error);
    res.status(401).json({
      success: false,
      error: 'Refresh token inválido',
    });
  }
}

/**
 * Logout user
 */
export async function logout(req, res) {
  res.clearCookie('refreshToken');
  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente',
  });
}

/**
 * Get user memberships
 */
export async function getMemberships(req, res) {
  try {
    const memberships = await authService.getUserMemberships(req.user.userId);
    
    res.json({
      success: true,
      memberships,
    });
  } catch (error) {
    console.error('❌ Error al obtener membresías:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener membresías',
    });
  }
}

/**
 * Switch organization
 */
export async function switchOrganization(req, res) {
  try {
    const { organizationId } = req.body;
    
    const { user, accessToken, refreshToken } = await authService.switchOrganization(
      req.user.userId,
      organizationId
    );
    
    // Set new refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.json({
      success: true,
      user,
      accessToken,
    });
  } catch (error) {
    console.error('❌ Error al cambiar organización:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
