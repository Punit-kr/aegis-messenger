/**
 * Aegis Backend - Encrypted Message Relay Service
 * Pure Zero-Knowledge Relay. Server NEVER possesses or parses plaintext messages.
 * Strict 7-Day Server Retention Enforced.
 */

import crypto from 'node:crypto';
import { db } from '../../db/database.js';
import { CONFIG } from '../../config/config.js';
import { wsRelay } from '../../websocket/relay.js';

export class MessagesService {
  /**
   * Relay encrypted envelopes to recipient device(s)
   * If recipient is online, push via WebSocket. If offline, store temporary ciphertext <= 7 days.
   */
  static relayEnvelopes(senderUserId, senderDeviceId, envelopes = []) {
    if (!Array.isArray(envelopes) || envelopes.length === 0) {
      throw new Error('No message envelopes provided');
    }

    const now = Date.now();
    const expiresAt = now + CONFIG.RETENTION.MAX_MESSAGE_RETENTION_MS; // Max 7 Days
    const dispatched = [];

    for (const env of envelopes) {
      const { recipientUserId, recipientDeviceId, envelopeType, encryptedEnvelope } = env;

      if (!recipientDeviceId || !recipientUserId || !encryptedEnvelope) {
        continue;
      }

      // Verify recipient is not blocking sender
      const isBlocked = db.get(
        'SELECT 1 FROM blocked_users WHERE blocker_user_id = ? AND blocked_user_id = ?',
        [recipientUserId, senderUserId]
      );
      if (isBlocked) {
        continue; // Silently drop to prevent leak of blocking status
      }

      const messageId = env.id || crypto.randomUUID();
      const stringifiedEnvelope = typeof encryptedEnvelope === 'string' 
        ? encryptedEnvelope 
        : JSON.stringify(encryptedEnvelope);

      // Verify server never receives unencrypted plaintext
      if (stringifiedEnvelope.includes('"text":') || stringifiedEnvelope.includes('"message":')) {
        // Safety guard: reject accidental client plaintext leakage
        throw new Error('Cryptographic violation: Server refuses unencrypted payload structures');
      }

      // Persist temporary ciphertext queue object
      db.run(
        `INSERT INTO temporary_messages 
          (id, sender_device_id, sender_user_id, recipient_device_id, recipient_user_id, 
           envelope_type, encrypted_envelope, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [messageId, senderDeviceId, senderUserId, recipientDeviceId, recipientUserId, envelopeType || 1, stringifiedEnvelope, now, expiresAt]
      );

      // Try instant real-time delivery via WebSocket
      const deliveredOnline = wsRelay.pushEnvelope(recipientDeviceId, {
        id: messageId,
        senderUserId,
        senderDeviceId,
        envelopeType,
        encryptedEnvelope: JSON.parse(stringifiedEnvelope),
        timestamp: now
      });

      if (deliveredOnline) {
        db.run('UPDATE temporary_messages SET delivered_at = ? WHERE id = ?', [now, messageId]);
      }

      dispatched.push({
        id: messageId,
        recipientDeviceId,
        deliveredOnline,
        expiresAt
      });
    }

    return { success: true, count: dispatched.length, dispatched };
  }

  /**
   * Fetch queued offline encrypted envelopes for an authenticated device
   */
  static fetchPendingEnvelopes(deviceId) {
    const now = Date.now();
    
    // Select undelivered envelopes that have NOT expired
    const messages = db.query(
      `SELECT id, sender_user_id, sender_device_id, envelope_type, encrypted_envelope, created_at 
       FROM temporary_messages 
       WHERE recipient_device_id = ? 
         AND delivered_at IS NULL 
         AND expires_at > ?
       ORDER BY created_at ASC`,
      [deviceId, now]
    );

    // Mark as delivered
    if (messages.length > 0) {
      const ids = messages.map(m => m.id);
      const placeholders = ids.map(() => '?').join(',');
      db.run(`UPDATE temporary_messages SET delivered_at = ? WHERE id IN (${placeholders})`, [now, ...ids]);
    }

    return messages.map(m => ({
      id: m.id,
      senderUserId: m.sender_user_id,
      senderDeviceId: m.sender_device_id,
      envelopeType: m.envelope_type,
      encryptedEnvelope: JSON.parse(m.encrypted_envelope),
      timestamp: m.created_at
    }));
  }

  /**
   * Acknowledge receipt and client-side processing of envelopes
   */
  static acknowledgeReceipt(deviceId, messageIds = []) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) return { acknowledged: 0 };

    const now = Date.now();
    const placeholders = messageIds.map(() => '?').join(',');
    
    // Update receipt timestamp and purge delivered messages if configured
    db.run(
      `UPDATE temporary_messages 
       SET receipt_acknowledged_at = ? 
       WHERE recipient_device_id = ? AND id IN (${placeholders})`,
      [now, deviceId, ...messageIds]
    );

    // Once acknowledged by client, the relay message object can be removed immediately
    db.run(
      `DELETE FROM temporary_messages 
       WHERE recipient_device_id = ? AND id IN (${placeholders})`,
      [deviceId, ...messageIds]
    );

    return { acknowledged: messageIds.length };
  }
}
