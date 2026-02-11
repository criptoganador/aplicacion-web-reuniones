import crypto from 'crypto';
import { AccessToken } from 'livekit-server-sdk';
import { pool } from '../db.js';
import { config } from '../config/index.js';

/**
 * Create a new meeting
 */
export async function createMeeting({ hostId, title, meetingType, scheduledTime, organizationId, link: requestedLink }) {
  // Check if meeting with this link already exists
  if (requestedLink) {
    console.log(`🔍 Buscando reunión existente con link: ${requestedLink}`);
    const existingResult = await pool.query(
      'SELECT id, host_id FROM meetings WHERE link = $1',
      [requestedLink]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      // If user is host, reactivate it
      if (existing.host_id === hostId) {
        console.log(`🔄 Reactivando reunión existente: ${existing.id}`);
        await pool.query(
          'UPDATE meetings SET is_active = TRUE, title = COALESCE($1, title) WHERE id = $2',
          [title || null, existing.id]
        );
        return await getMeetingDetails(existing.id);
      } else {
        console.warn(`❌ Intento de reactivación fallido: Usuario ${hostId} no es host de ${existing.id}`);
        throw new Error('Ya existe una reunión con ese enlace y no eres el anfitrión');
      }
    }
  }

  const link = requestedLink || crypto.randomBytes(16).toString('hex');
  console.log(`🆕 Creando nueva reunión: ${link} para host ${hostId}`);
  
  const result = await pool.query(
    `INSERT INTO meetings (host_id, link, title, meeting_type, scheduled_time, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, link, title, meeting_type, scheduled_time, created_at`,
    [hostId, link, title || 'Reunión Instantánea', meetingType || 'instant', scheduledTime, organizationId]
  );
  
  return result.rows[0];
}

/**
 * Get meeting history for user
 */
export async function getMeetingHistory(userId, organizationId) {
  const result = await pool.query(
    `SELECT m.id, m.link, m.title, m.meeting_type, m.scheduled_time, m.created_at, m.is_active,
            u.name as host_name
     FROM meetings m
     JOIN users u ON m.host_id = u.id
     WHERE m.organization_id = $1
       AND (m.host_id = $2 OR EXISTS (
         SELECT 1 FROM participants p WHERE p.meeting_id = m.id AND p.user_id = $2
       ))
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [organizationId, userId]
  );
  
  return result.rows;
}

/**
 * Validate meeting link
 */
export async function validateMeeting(linkOrId) {
  const isId = !isNaN(parseInt(linkOrId)) && /^\d+$/.test(linkOrId.toString());
  
  console.log(`🔍 Validando reunión: ${linkOrId} (Búsqueda por ${isId ? 'ID' : 'Link'})`);

  const query = `
    SELECT m.id, m.link, m.title, m.is_active, m.meeting_type, m.scheduled_time,
           u.name as host_name, u.email as host_email,
           o.name as organization_name
    FROM meetings m
    JOIN users u ON m.host_id = u.id
    LEFT JOIN organizations o ON m.organization_id = o.id
    WHERE ${isId ? 'm.id = $1' : 'm.link = $1'}
  `;
  
  const result = await pool.query(query, [linkOrId]);
  
  if (result.rows.length === 0) {
    console.warn(`⚠️ Reunión no encontrada: ${linkOrId}`);
    throw new Error('Reunión no encontrada');
  }
  
  return result.rows[0];
}

/**
 * Get active meetings for organization
 */
export async function getActiveMeetings(organizationId) {
  const result = await pool.query(
    `SELECT m.id, m.link, m.title, m.created_at,
            u.name as host_name,
            COUNT(p.id) as participant_count
     FROM meetings m
     JOIN users u ON m.host_id = u.id
     LEFT JOIN participants p ON m.id = p.meeting_id
     WHERE m.organization_id = $1 AND m.is_active = TRUE
     GROUP BY m.id, u.name
     ORDER BY m.created_at DESC`,
    [organizationId]
  );
  
  return result.rows;
}

/**
 * Get meeting details
 */
export async function getMeetingDetails(linkOrId) {
  const isId = !isNaN(parseInt(linkOrId)) && /^\d+$/.test(linkOrId.toString());
  
  console.log(`🔍 Obteniendo detalles de reunión: ${linkOrId} (Búsqueda por ${isId ? 'ID' : 'Link'})`);

  const query = `
    SELECT m.*, u.name as host_name, u.email as host_email,
            o.name as organization_name
     FROM meetings m
     LEFT JOIN users u ON m.host_id = u.id
     LEFT JOIN organizations o ON m.organization_id = o.id
     WHERE ${isId ? 'm.id = $1' : 'm.link = $1'}
  `;

  const result = await pool.query(query, [linkOrId]);
  
  if (result.rows.length === 0) {
    console.warn(`⚠️ Detalles de reunión no encontrados: ${linkOrId}`);
    throw new Error('Reunión no encontrada');
  }
  
  return result.rows[0];
}

/**
 * End a meeting
 */
export async function endMeeting(link, userId) {
  // Get meeting
  const meetingResult = await pool.query(
    'SELECT id, host_id FROM meetings WHERE link = $1',
    [link]
  );
  
  if (meetingResult.rows.length === 0) {
    throw new Error('Reunión no encontrada');
  }
  
  const meeting = meetingResult.rows[0];
  
  // Verify user is host
  if (meeting.host_id !== userId) {
    throw new Error('Solo el anfitrión puede finalizar la reunión');
  }
  
  // Mark as inactive
  await pool.query(
    'UPDATE meetings SET is_active = FALSE WHERE id = $1',
    [meeting.id]
  );
  
  return { success: true };
}

/**
 * Generate LiveKit token
 */
export async function generateLiveKitToken(params) {
  const { meetingLink, userName, userId, email, avatarUrl } = params;
  
  // Ensure unique identity for guests
  const identity = userId === 'guest' 
    ? `guest-${Math.random().toString(36).substring(7)}` 
    : `user-${userId}`;

  console.log(`🎟️ Generando token LiveKit: Identity=${identity}, Room=${meetingLink}`);
  
  const at = new AccessToken(
    config.livekit.apiKey,
    config.livekit.apiSecret,
    {
      identity,
      name: userName || 'Invitado',
      metadata: JSON.stringify({ 
        userId, 
        meetingLink, 
        email: email || '', 
        avatarUrl: avatarUrl || '' 
      }),
    }
  );
  
  at.addGrant({
    roomJoin: true,
    room: meetingLink,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  
  return at.toJwt();
}

/**
 * Add participant to meeting
 */
export async function addParticipant(meetingId, userId) {
  await pool.query(
    'INSERT INTO participants (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [meetingId, userId]
  );
}

/**
 * Get meeting participants
 */
export async function getMeetingParticipants(meetingId) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url, p.joined_at
     FROM participants p
     JOIN users u ON p.user_id = u.id
     WHERE p.meeting_id = $1
     ORDER BY p.joined_at DESC`,
    [meetingId]
  );
  
  return result.rows;
}
