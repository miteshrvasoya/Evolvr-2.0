import { sql } from '../../db/client.js';

export class NotificationService {
  
  async sendNotification(params: {
    userId: string;
    type: 'APPROVAL_REQUIRED' | 'WARNING' | 'ERROR' | 'INFO';
    priority: 'low' | 'medium' | 'high';
    title: string;
    message: string;
    actionUrl?: string;
  }) {
    const result = await sql`
      INSERT INTO notifications (
        user_id, type, priority, title, message, action_url, status
      ) VALUES (
        ${params.userId}, ${params.type}, ${params.priority}, ${params.title}, 
        ${params.message}, ${params.actionUrl || null}, 'unread'
      ) RETURNING *
    `;
    return result[0];
  }

  async markAsRead(notificationId: string, userId: string) {
    await sql`
      UPDATE notifications 
      SET status = 'read', read_at = NOW() 
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;
  }

  async getUnread(userId: string) {
    return await sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} AND status = 'unread' 
      ORDER BY priority DESC, created_at DESC
    `;
  }
}
