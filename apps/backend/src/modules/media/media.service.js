/**
 * Aegis Backend - Encrypted Attachments Relay Service
 * Pure ciphertext storage. The server has no keys to decrypt media.
 * Enforces strict 7-Day Server Retention.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../../db/database.js';
import { CONFIG } from '../../config/config.js';

if (!fs.existsSync(CONFIG.MEDIA_DIR)) {
  fs.mkdirSync(CONFIG.MEDIA_DIR, { recursive: true });
}

export class MediaService {
  /**
   * Save uploaded encrypted media blob and register 7-day expiration
   */
  static saveAttachment(uploaderDeviceId, file) {
    if (!file) {
      throw new Error('No attachment file provided');
    }

    const attachmentId = crypto.randomUUID();
    const storageFileName = `${attachmentId}.enc`;
    const targetPath = path.join(CONFIG.MEDIA_DIR, storageFileName);

    // Compute SHA-256 of encrypted blob for transport integrity verification
    const fileBuffer = fs.readFileSync(file.path);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Move to permanent media storage
    fs.copyFileSync(file.path, targetPath);
    try { fs.unlinkSync(file.path); } catch (e) {}

    const now = Date.now();
    const expiresAt = now + CONFIG.RETENTION.MAX_ATTACHMENT_RETENTION_MS; // Max 7 Days

    db.run(
      `INSERT INTO temporary_attachments 
        (id, uploader_device_id, storage_path, file_size, mime_type, sha256_checksum, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [attachmentId, uploaderDeviceId, targetPath, fileBuffer.length, file.mimetype || 'application/octet-stream', sha256, now, expiresAt]
    );

    return {
      attachmentId,
      fileSize: fileBuffer.length,
      sha256,
      expiresAt
    };
  }

  /**
   * Retrieve an encrypted media blob by ID if not expired
   */
  static getAttachment(attachmentId) {
    const now = Date.now();
    const record = db.get(
      'SELECT * FROM temporary_attachments WHERE id = ? AND expires_at > ?',
      [attachmentId, now]
    );

    if (!record) {
      throw new Error('Attachment not found or has expired under the 7-day retention policy');
    }

    if (!fs.existsSync(record.storage_path)) {
      throw new Error('Attachment blob file is missing or deleted');
    }

    return {
      filePath: record.storage_path,
      mimeType: 'application/octet-stream', // Served as raw ciphertext stream
      fileSize: record.file_size,
      sha256: record.sha256_checksum
    };
  }
}
