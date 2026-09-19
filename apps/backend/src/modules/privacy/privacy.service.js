/**
 * Aegis Backend - Privacy & User Control Service
 */

import crypto from 'node:crypto';
import { db } from '../../db/database.js';

export class PrivacyService {
  /**
   * Get user privacy settings
   */
  static getSettings(userId) {
    let settings = db.get('SELECT * FROM privacy_settings WHERE user_id = ?', [userId]);
    if (!settings) {
      db.run('INSERT INTO privacy_settings (user_id) VALUES (?)', [userId]);
      settings = db.get('SELECT * FROM privacy_settings WHERE user_id = ?', [userId]);
    }
    return settings;
  }

  /**
   * Update user privacy settings
   */
  static updateSettings(userId, updates = {}) {
    const current = this.getSettings(userId);
    const lastSeen = updates.last_seen_visibility || current.last_seen_visibility;
    const readReceipts = updates.read_receipts_enabled !== undefined ? (updates.read_receipts_enabled ? 1 : 0) : current.read_receipts_enabled;
    const typing = updates.typing_indicators_enabled !== undefined ? (updates.typing_indicators_enabled ? 1 : 0) : current.typing_indicators_enabled;
    const photo = updates.profile_photo_visibility || current.profile_photo_visibility;
    const disappearing = updates.disappearing_messages_default !== undefined ? Number(updates.disappearing_messages_default) : current.disappearing_messages_default;

    db.run(
      `UPDATE privacy_settings SET 
         last_seen_visibility = ?,
         read_receipts_enabled = ?,
         typing_indicators_enabled = ?,
         profile_photo_visibility = ?,
         disappearing_messages_default = ?
       WHERE user_id = ?`,
      [lastSeen, readReceipts, typing, photo, disappearing, userId]
    );

    return this.getSettings(userId);
  }

  /**
   * Block a user
   */
  static blockUser(blockerId, blockedId) {
    if (blockerId === blockedId) throw new Error('Cannot block yourself');
    
    db.run(
      `INSERT INTO blocked_users (blocker_user_id, blocked_user_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [blockerId, blockedId, Date.now()]
    );

    return { success: true, blockedUserId: blockedId };
  }

  /**
   * Unblock a user
   */
  static unblockUser(blockerId, blockedId) {
    db.run(
      'DELETE FROM blocked_users WHERE blocker_user_id = ? AND blocked_user_id = ?',
      [blockerId, blockedId]
    );
    return { success: true, unblockedUserId: blockedId };
  }

  /**
   * List blocked users
   */
  static getBlockedUsers(userId) {
    return db.query(
      `SELECT u.id, u.display_name, u.phone, u.avatar_url, b.created_at as blocked_at
       FROM blocked_users b
       JOIN users u ON b.blocked_user_id = u.id
       WHERE b.blocker_user_id = ?`,
      [userId]
    );
  }

  /**
   * Submit an abuse report
   */
  static reportUser(reporterId, reportedId, reason) {
    const reportId = crypto.randomUUID();
    db.run(
      `INSERT INTO user_reports (id, reporter_user_id, reported_user_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [reportId, reporterId, reportedId, reason, Date.now()]
    );
    return { success: true, reportId };
  }
}
