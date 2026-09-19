/**
 * Aegis Automated Data Lifecycle Test
 * Automates the full end-to-end message lifecycle:
 * Create message -> Client Encrypt -> Relay to Server -> Temporary Ciphertext Store ->
 * Deliver to Recipient -> Client Decrypt -> Acknowledge -> Expire/Sweep ->
 * Permanent Deletion -> Verify Completely Unavailable.
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  generateECDHKeyPair,
  importPublicKey,
  importPrivateKey,
  computeDH,
  hkdfDerive
} from '../../apps/web/src/crypto/webcrypto.js';
import { DoubleRatchetSession } from '../../apps/web/src/crypto/ratchet.js';
import { db } from '../../apps/backend/src/db/database.js';
import { MessagesService } from '../../apps/backend/src/modules/messages/messages.service.js';
import { RetentionJanitor } from '../../apps/backend/src/modules/retention/retention.service.js';

if (typeof window === 'undefined') {
  global.window = { crypto: crypto.webcrypto };
}

async function runDataLifecycleTest() {
  console.log('🧪 [TEST SUITE 5/5] Full End-to-End Data Lifecycle Automation');

  const now = Date.now();
  const aliceUserId = 'user-alice-' + crypto.randomUUID();
  const bobUserId = 'user-bob-' + crypto.randomUUID();
  const aliceDeviceId = 'dev-alice-' + crypto.randomUUID();
  const bobDeviceId = 'dev-bob-' + crypto.randomUUID();

  const phoneAlice = `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;
  const phoneBob = `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;

  // 1. Setup participants on server
  db.run('INSERT INTO users (id, phone, auth_provider, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [aliceUserId, phoneAlice, 'phone', 'Alice', now, now]);
  db.run('INSERT INTO users (id, phone, auth_provider, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [bobUserId, phoneBob, 'phone', 'Bob', now, now]);
  db.run('INSERT INTO devices (id, user_id, device_name, platform, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [aliceDeviceId, aliceUserId, 'Alice Device', 'web', now, now]);
  db.run('INSERT INTO devices (id, user_id, device_name, platform, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [bobDeviceId, bobUserId, 'Bob Device', 'web', now, now]);

  // 2. Client-Side Cryptographic Session Setup
  console.log('  Step 1: Establishing cryptographic ratchet sessions...');
  const masterSecret = crypto.randomBytes(32);
  const bobDHKeyPair = await generateECDHKeyPair();

  const aliceSession = await DoubleRatchetSession.initAlice(masterSecret, bobDHKeyPair.publicKeyBase64, {
    peerUserId: bobUserId,
    peerDeviceId: bobDeviceId
  });

  const bobSession = await DoubleRatchetSession.initBob(masterSecret, bobDHKeyPair, {
    peerUserId: aliceUserId,
    peerDeviceId: aliceDeviceId
  });

  // 3. Create Message & Encrypt on Client
  console.log('  Step 2: Client creates & encrypts message...');
  const secretMessage = {
    id: crypto.randomUUID(),
    text: 'Meet me at the secure safehouse at 0900.',
    timestamp: Date.now()
  };

  const encryptedEnvelope = await aliceSession.encrypt(secretMessage);
  assert.ok(encryptedEnvelope.ciphertext, 'Ciphertext must be generated');

  // 4. Send Message to Server Relay
  console.log('  Step 3: Transmitting ciphertext to zero-knowledge relay...');
  const relayResult = MessagesService.relayEnvelopes(aliceUserId, aliceDeviceId, [{
    id: secretMessage.id,
    recipientUserId: bobUserId,
    recipientDeviceId: bobDeviceId,
    envelopeType: 2,
    encryptedEnvelope: JSON.stringify(encryptedEnvelope)
  }]);

  assert.strictEqual(relayResult.success, true);
  assert.strictEqual(relayResult.count, 1);

  // 5. Verify Server Stores ONLY Temporary Ciphertext
  console.log('  Step 4: Verifying server temporary ciphertext storage...');
  const storedInDb = db.get('SELECT * FROM temporary_messages WHERE id = ?', [secretMessage.id]);
  assert.ok(storedInDb, 'Message envelope must be queued in temporary_messages');
  assert.strictEqual(storedInDb.delivered_at, null, 'Message should initially be undelivered (offline queue)');
  assert.ok(storedInDb.expires_at > now, 'Expiration timestamp must be in the future');
  assert.ok(!storedInDb.encrypted_envelope.includes(secretMessage.text), 'Server must NOT store plaintext');

  // 6. Deliver to Recipient (Bob comes online and fetches pending messages)
  console.log('  Step 5: Recipient connects & fetches offline encrypted envelope...');
  const pendingMessages = MessagesService.fetchPendingEnvelopes(bobDeviceId);
  assert.strictEqual(pendingMessages.length, 1);
  assert.strictEqual(pendingMessages[0].id, secretMessage.id);

  // 7. Client Decrypts Message
  console.log('  Step 6: Recipient decrypts message with Double Ratchet...');
  const decrypted = await bobSession.decrypt(pendingMessages[0].encryptedEnvelope);
  assert.strictEqual(decrypted.text, secretMessage.text, 'Decrypted plaintext must match original exactly');

  // 8. Recipient Acknowledges Delivery
  console.log('  Step 7: Recipient client sends delivery acknowledgment...');
  const ackResult = MessagesService.acknowledgeReceipt(bobDeviceId, [secretMessage.id]);
  assert.strictEqual(ackResult.acknowledged, 1);

  // 9. Verify Server Deletes Delivered Message Immediately Upon Acknowledgment
  console.log('  Step 8: Verifying server immediately purges acknowledged message...');
  const checkAcked = db.get('SELECT * FROM temporary_messages WHERE id = ?', [secretMessage.id]);
  assert.strictEqual(checkAcked, undefined, 'Server MUST immediately shred acknowledged envelope');

  // 10. Lifecycle of Expired Undelivered Message (7-Day Janitor)
  console.log('  Step 9: Verifying Janitor cleanup of expired unacknowledged message...');
  const unackedExpiredId = crypto.randomUUID();
  db.run(
    `INSERT INTO temporary_messages 
      (id, sender_device_id, sender_user_id, recipient_device_id, recipient_user_id, 
       envelope_type, encrypted_envelope, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 2, '{"ciphertext":"enc"}', ?, ?)`,
    [unackedExpiredId, aliceDeviceId, aliceUserId, bobDeviceId, bobUserId, now - 800000000, now - 5000]
  );

  // Run janitor sweep
  RetentionJanitor.runCleanupSweep();

  // 11. Final Verification: Unavailable
  console.log('  Step 10: Confirming record is permanently unavailable...');
  const checkExpired = db.get('SELECT * FROM temporary_messages WHERE id = ?', [unackedExpiredId]);
  assert.strictEqual(checkExpired, undefined, 'Expired message MUST be permanently unavailable');

  console.log('  ✅ Full Data Lifecycle verified: Create -> Encrypt -> Send -> Store -> Deliver -> Decrypt -> Expire -> Delete -> Unavailable');
  console.log('✨ All Data Lifecycle tests passed!\n');
}

runDataLifecycleTest().catch(err => {
  console.error('❌ Data Lifecycle Failure:', err);
  process.exit(1);
});
