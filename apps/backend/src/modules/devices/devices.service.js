/**
 * Aegis Backend - Device & Cryptographic Prekey Bundle Service
 * Operates strictly with public keys. Private keys NEVER touch the server.
 */

import { db } from '../../db/database.js';

export class DevicesService {
  /**
   * Upload or rotate public prekey bundle for the authenticated device
   */
  static uploadPrekeys(deviceId, bundle) {
    const { registrationId, identityKey, signedPrekey, signedPrekeyId, signedPrekeySig, oneTimePrekeys } = bundle;

    if (!registrationId || !identityKey || !signedPrekey || !signedPrekeySig) {
      throw new Error('Incomplete prekey bundle provided');
    }

    const now = Date.now();

    // Upsert device keys record
    db.run(
      `INSERT INTO device_keys 
        (device_id, registration_id, identity_key, signed_prekey, signed_prekey_id, signed_prekey_sig, created_at, rotated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         registration_id = excluded.registration_id,
         identity_key = excluded.identity_key,
         signed_prekey = excluded.signed_prekey,
         signed_prekey_id = excluded.signed_prekey_id,
         signed_prekey_sig = excluded.signed_prekey_sig,
         rotated_at = excluded.rotated_at`,
      [deviceId, registrationId, identityKey, signedPrekey, signedPrekeyId || 1, signedPrekeySig, now, now]
    );

    // Insert one-time prekeys pool if provided
    if (Array.isArray(oneTimePrekeys) && oneTimePrekeys.length > 0) {
      for (const opk of oneTimePrekeys) {
        db.run(
          `INSERT INTO one_time_prekeys (device_id, key_id, public_key, created_at)
           VALUES (?, ?, ?, ?)`,
          [deviceId, opk.keyId, opk.publicKey, now]
        );
      }
    }

    return { success: true, opkCount: Array.isArray(oneTimePrekeys) ? oneTimePrekeys.length : 0 };
  }

  /**
   * Fetch prekey bundle for all active devices belonging to a recipient user
   * Atomically claims an unconsumed one-time prekey if available.
   */
  static getPrekeyBundlesForUser(recipientUserId) {
    const activeDevices = db.query(
      `SELECT d.id as device_id, d.device_name, d.platform, dk.registration_id, 
              dk.identity_key, dk.signed_prekey, dk.signed_prekey_id, dk.signed_prekey_sig
       FROM devices d
       JOIN device_keys dk ON d.id = dk.device_id
       WHERE d.user_id = ? AND d.revoked_at IS NULL`,
      [recipientUserId]
    );

    const bundles = [];

    for (const dev of activeDevices) {
      // Find an available OPK
      const opk = db.get(
        `SELECT id, key_id, public_key 
         FROM one_time_prekeys 
         WHERE device_id = ? AND consumed_at IS NULL 
         ORDER BY id ASC LIMIT 1`,
        [dev.device_id]
      );

      if (opk) {
        // Mark OPK as consumed atomically
        db.run('UPDATE one_time_prekeys SET consumed_at = ? WHERE id = ?', [Date.now(), opk.id]);
      }

      bundles.push({
        deviceId: dev.device_id,
        deviceName: dev.device_name,
        platform: dev.platform,
        registrationId: dev.registration_id,
        identityKey: dev.identity_key,
        signedPrekey: dev.signed_prekey,
        signedPrekeyId: dev.signed_prekey_id,
        signedPrekeySig: dev.signed_prekey_sig,
        oneTimePrekey: opk ? { keyId: opk.key_id, publicKey: opk.public_key } : null
      });
    }

    return bundles;
  }

  /**
   * List all linked devices for the calling user
   */
  static getLinkedDevices(userId) {
    return db.query(
      `SELECT id, device_name, platform, is_primary, created_at, last_seen_at, revoked_at
       FROM devices 
       WHERE user_id = ? 
       ORDER BY is_primary DESC, last_seen_at DESC`,
      [userId]
    );
  }

  /**
   * Revoke a specific device
   */
  static revokeDevice(userId, deviceId) {
    const device = db.get('SELECT * FROM devices WHERE id = ? AND user_id = ?', [deviceId, userId]);
    if (!device) {
      throw new Error('Device not found or not owned by user');
    }

    const now = Date.now();
    db.run('UPDATE devices SET revoked_at = ? WHERE id = ?', [now, deviceId]);
    db.run('UPDATE sessions SET revoked_at = ? WHERE device_id = ?', [now, deviceId]);
    db.run('DELETE FROM one_time_prekeys WHERE device_id = ?', [deviceId]);

    return { success: true, revokedDeviceId: deviceId };
  }
}
