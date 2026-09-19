/**
 * Aegis Automated Security & Retention Tests
 * Tests 7-Day Server Retention Policy, Janitor Deletion, and File Shredding
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../../apps/backend/src/db/database.js';
import { RetentionJanitor } from '../../apps/backend/src/modules/retention/retention.service.js';
import { CONFIG } from '../../apps/backend/src/config/config.js';

async function runRetentionTests() {
  console.log('🧪 [TEST SUITE 3/5] 7-Day Server Retention & Janitor Engine Tests');

  const now = Date.now();
  const pastExpiry = now - 1000; // Expired 1 second ago
  const futureExpiry = now + CONFIG.RETENTION.MAX_MESSAGE_RETENTION_MS; // 7 days in future

  // Setup mock user & devices with unique phones
  const user1 = crypto.randomUUID();
  const user2 = crypto.randomUUID();
  const dev1 = crypto.randomUUID();
  const dev2 = crypto.randomUUID();
  const phone1 = `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;
  const phone2 = `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;

  db.run('INSERT INTO users (id, phone, auth_provider, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [user1, phone1, 'phone', 'Sender', now, now]);
  db.run('INSERT INTO users (id, phone, auth_provider, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [user2, phone2, 'phone', 'Recipient', now, now]);
  db.run('INSERT INTO devices (id, user_id, device_name, platform, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [dev1, user1, 'Dev1', 'web', now, now]);
  db.run('INSERT INTO devices (id, user_id, device_name, platform, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [dev2, user2, 'Dev2', 'web', now, now]);

  // Test 1: Insert 1 Expired Temporary Message and 1 Active Temporary Message
  console.log('  Testing Temporary Ciphertext Envelope Expiration Sweep...');
  const expiredMsgId = 'msg-expired-' + crypto.randomUUID();
  const activeMsgId = 'msg-active-' + crypto.randomUUID();

  db.run(
    `INSERT INTO temporary_messages 
      (id, sender_device_id, sender_user_id, recipient_device_id, recipient_user_id, 
       envelope_type, encrypted_envelope, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, '{"ciphertext":"enc1"}', ?, ?)`,
    [expiredMsgId, dev1, user1, dev2, user2, now - 800000000, pastExpiry]
  );

  db.run(
    `INSERT INTO temporary_messages 
      (id, sender_device_id, sender_user_id, recipient_device_id, recipient_user_id, 
       envelope_type, encrypted_envelope, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, '{"ciphertext":"enc2"}', ?, ?)`,
    [activeMsgId, dev1, user1, dev2, user2, now, futureExpiry]
  );

  // Test 2: Insert 1 Expired Temporary Attachment with physical disk file
  console.log('  Testing Temporary Attachment Janitor & Physical File Shredding...');
  if (!fs.existsSync(CONFIG.MEDIA_DIR)) {
    fs.mkdirSync(CONFIG.MEDIA_DIR, { recursive: true });
  }

  const expiredAttId = crypto.randomUUID();
  const expiredFilePath = path.join(CONFIG.MEDIA_DIR, `${expiredAttId}.enc`);
  fs.writeFileSync(expiredFilePath, Buffer.from('MOCK_ENCRYPTED_FILE_CONTENT'));

  db.run(
    `INSERT INTO temporary_attachments 
      (id, uploader_device_id, storage_path, file_size, mime_type, sha256_checksum, created_at, expires_at)
     VALUES (?, ?, ?, 27, 'application/octet-stream', 'mock-sha', ?, ?)`,
    [expiredAttId, dev1, expiredFilePath, now - 800000000, pastExpiry]
  );

  // Verify file exists before sweep
  assert.ok(fs.existsSync(expiredFilePath), 'Expired attachment file must exist before sweep');

  // Trigger Janitor Sweep
  console.log('  Triggering Automated Janitor Sweep...');
  const stats = RetentionJanitor.runCleanupSweep();

  // Assertions
  assert.ok(stats.expiredMessagesPurged >= 1, 'Janitor must report at least 1 message purged');
  assert.ok(stats.expiredAttachmentsPurged >= 1, 'Janitor must report at least 1 attachment purged');
  assert.ok(stats.physicalFilesShredded >= 1, 'Janitor must report physical file shredded');

  // Verify expired message is gone from database
  const checkExpiredMsg = db.get('SELECT id FROM temporary_messages WHERE id = ?', [expiredMsgId]);
  assert.strictEqual(checkExpiredMsg, undefined, 'Expired message MUST NOT exist in database');

  // Verify active message is preserved
  const checkActiveMsg = db.get('SELECT id FROM temporary_messages WHERE id = ?', [activeMsgId]);
  assert.ok(checkActiveMsg, 'Active message within 7 days MUST be retained');

  // Verify physical file was shredded from disk
  assert.strictEqual(fs.existsSync(expiredFilePath), false, 'Expired media file MUST be unlinked from disk');

  console.log('  ✅ 7-Day Server Retention Janitor & File Shredding verified');
  console.log('✨ All Retention & Expiration tests passed!\n');
}

runRetentionTests().catch(err => {
  console.error('❌ Retention Test Failure:', err);
  process.exit(1);
});
