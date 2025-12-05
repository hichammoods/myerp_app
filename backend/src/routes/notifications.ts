import express, { Request, Response } from 'express';
import { db } from '../database/connection';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all notifications for current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, unread_only = 'false' } = req.query;

    let query = `
      SELECT
        n.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM notifications n
      LEFT JOIN users u ON u.id::text = (n.message::json->>'created_by')
      WHERE n.user_id = $1
    `;

    const params: any[] = [userId];

    if (unread_only === 'true') {
      query += ` AND n.is_read = FALSE`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $2`;
    params.push(parseInt(limit as string));

    const result = await db.query(query, params);

    res.json({
      success: true,
      notifications: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    await db.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all as read'
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// Helper function to create notification (exported for use in other routes)
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.userId,
        params.type,
        params.title,
        params.message,
        params.relatedEntityType || null,
        params.relatedEntityId || null
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Helper function to notify all users
export async function notifyAllUsers(params: {
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  excludeUserId?: string;
}) {
  try {
    // Get all users (status column doesn't exist in production)
    let query = `SELECT id FROM users WHERE 1=1`;
    const queryParams: any[] = [];

    if (params.excludeUserId) {
      query += ` AND id != $1`;
      queryParams.push(params.excludeUserId);
    }

    const usersResult = await db.query(query, queryParams);

    // Create notification for each user
    const notifications = [];
    for (const user of usersResult.rows) {
      const notification = await createNotification({
        userId: user.id,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId
      });
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Error notifying all users:', error);
    throw error;
  }
}

export default router;
