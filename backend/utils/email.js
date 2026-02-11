import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

/**
 * Send verification email
 */
export async function sendVerificationEmail(email, token) {
  const verificationUrl = `${config.frontendUrl}/verify-email/${token}`;
  
  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: '✅ Verifica tu cuenta en ASICME Meet',
    html: `
      <h2>¡Bienvenido a ASICME Meet!</h2>
      <p>Por favor, verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
        Verificar Email
      </a>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p>${verificationUrl}</p>
      <p>Este enlace expirará en 24 horas.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${config.frontendUrl}/reset-password/${token}`;
  
  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: '🔐 Restablece tu contraseña - ASICME Meet',
    html: `
      <h2>Restablecimiento de Contraseña</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
        Restablecer Contraseña
      </a>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p>${resetUrl}</p>
      <p>Este enlace expirará en 1 hora.</p>
      <p>Si no solicitaste este cambio, ignora este correo.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}
