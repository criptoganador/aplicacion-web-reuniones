import * as meetingsService from '../services/meetingsService.js';

/**
 * Create a new meeting
 */
export async function createMeeting(req, res) {
  try {
    const { title, meetingType, scheduledTime, link } = req.body;
    
    const meeting = await meetingsService.createMeeting({
      hostId: req.user.userId,
      title,
      meetingType,
      scheduledTime,
      organizationId: req.user.organizationId,
      link,
    });
    
    res.status(201).json({
      success: true,
      meeting,
    });
  } catch (error) {
    console.error('❌ Error al crear reunión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear reunión',
    });
  }
}

/**
 * Get meeting history
 */
export async function getMeetingHistory(req, res) {
  try {
    const meetings = await meetingsService.getMeetingHistory(
      req.user.userId,
      req.user.organizationId
    );
    
    res.json({
      success: true,
      meetings,
    });
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial',
    });
  }
}

/**
 * Validate meeting link
 */
export async function validateMeeting(req, res) {
  try {
    const { link } = req.params;
    
    const meeting = await meetingsService.validateMeeting(link);
    
    res.json({
      success: true,
      meeting,
    });
  } catch (error) {
    console.error('❌ Error al validar reunión:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'Reunión no encontrada',
    });
  }
}

/**
 * Get active meetings
 */
export async function getActiveMeetings(req, res) {
  try {
    const meetings = await meetingsService.getActiveMeetings(req.user.organizationId);
    
    res.json({
      success: true,
      meetings,
    });
  } catch (error) {
    console.error('❌ Error al obtener reuniones activas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reuniones activas',
    });
  }
}

/**
 * Get meeting details
 */
export async function getMeetingDetails(req, res) {
  try {
    const { link } = req.params;
    
    const meeting = await meetingsService.getMeetingDetails(link);
    
    res.json({
      success: true,
      meeting,
    });
  } catch (error) {
    console.error('❌ Error al obtener detalles:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * End meeting
 */
export async function endMeeting(req, res) {
  try {
    const { link } = req.body;
    
    await meetingsService.endMeeting(link, req.user.userId);
    
    res.json({
      success: true,
      message: 'Reunión finalizada',
    });
  } catch (error) {
    console.error('❌ Error al finalizar reunión:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Generate LiveKit token
 */
export async function getLiveKitToken(req, res) {
  try {
    console.log(`🎟️ Token Request Body:`, JSON.stringify(req.body));
    const { meetingLink, userName, roomName, participantName, email, avatarUrl } = req.body;
    
    // Support both new and legacy parameter names from frontend
    const finalMeetingLink = meetingLink || roomName;
    const finalUserName = userName || participantName;
    const userId = req.user?.userId || 'guest';
    
    if (!finalMeetingLink) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la sala (meetingLink o roomName) es requerido',
      });
    }
    
    const token = await meetingsService.generateLiveKitToken({
      meetingLink: finalMeetingLink,
      userName: finalUserName || 'Invitado',
      userId,
      email,
      avatarUrl,
    });
    
    res.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error('❌ Error al generar token LiveKit:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar token',
    });
  }
}

/**
 * Join meeting
 */
export async function joinMeeting(req, res) {
  try {
    const { meetingLink, meeting_id } = req.body;
    const finalMeetingLink = meetingLink || meeting_id;
    const userId = req.user?.userId;
    
    if (!finalMeetingLink) {
      return res.status(400).json({
        success: false,
        error: 'El identificador de la reunión (meetingLink o meeting_id) es requerido',
      });
    }

    // Validate meeting exists
    const meeting = await meetingsService.validateMeeting(finalMeetingLink);
    
    // Add participant if user is authenticated
    if (userId) {
      await meetingsService.addParticipant(meeting.id, userId);
    }
    
    res.json({
      success: true,
      meeting,
    });
  } catch (error) {
    console.error('❌ Error al unirse a reunión:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
