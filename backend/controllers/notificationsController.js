import { pool } from '../db.js';

/**
 * Get user notifications
 */
export async function getNotifications(req, res) {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
    
    // Count unread
    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    
    res.json({
      success: true,
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count)
    });
  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    res.status(500).json({ success: false, error: 'Error al obtener notificaciones' });
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar notificación' });
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(req, res) {
  try {
    const userId = req.user.userId;
    
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar notificaciones' });
  }
}
