/**
 * Aegis Automated Security & Cryptography Unit Tests
 * Tests X3DH, Double Ratchet, Tamper Detection, and Safety Numbers
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  generateECDHKeyPair,
  importPublicKey,
  importPrivateKey,
  computeDH,
  hkdfDerive,
  encryptAESGCM,
  decryptAESGCM
} from '../../apps/web/src/crypto/webcrypto.js';
import { X3DH } from '../../apps/web/src/crypto/x3dh.js';
import { DoubleRatchetSession } from '../../apps/web/src/crypto/ratchet.js';
import { computeSafetyNumber } from '../../packages/protocol/fingerprint.js';

// Polyfill window.crypto for Node test environment if needed
if (typeof window === 'undefined') {
  global.window = { crypto: crypto.webcrypto };
}

async function runCryptoTests() {
  console.log('🧪 [TEST SUITE 1/5] Cryptographic Primitives & Signal Protocol Tests');

  // Test 1: ECDH Keypair Generation & DH Agreement
  console.log('  Testing ECDH Key Generation & Shared Secret Agreement...');
  const aliceKeyPair = await generateECDHKeyPair();
  const bobKeyPair = await generateECDHKeyPair();

  assert.ok(aliceKeyPair.publicKeyBase64, 'Alice public key must exist');
  assert.ok(aliceKeyPair.privateKeyJwk, 'Alice private key JWK must exist');
  assert.ok(bobKeyPair.publicKeyBase64, 'Bob public key must exist');

  const alicePriv = await importPrivateKey(aliceKeyPair.privateKeyJwk);
  const alicePub = await importPublicKey(aliceKeyPair.publicKeyBase64);
  const bobPriv = await importPrivateKey(bobKeyPair.privateKeyJwk);
  const bobPub = await importPublicKey(bobKeyPair.publicKeyBase64);

  const secretAlice = await computeDH(alicePriv, bobPub);
  const secretBob = await computeDH(bobPriv, alicePub);

  assert.deepStrictEqual(secretAlice, secretBob, 'Diffie-Hellman shared secrets must be identical');
  console.log('  ✅ ECDH P-256 Agreement verified');

  // Test 2: X3DH Protocol Handshake
  console.log('  Testing X3DH (Extended Triple Diffie-Hellman) Session Agreement...');
  const bobBundle = {
    registrationId: 1001,
    identityKey: bobKeyPair.publicKeyBase64,
    signedPrekey: bobKeyPair.publicKeyBase64,
    signedPrekeyId: 1,
    signedPrekeySig: 'SIG',
    oneTimePrekey: null
  };

  const x3dhInit = await X3DH.initiateSession(aliceKeyPair, bobBundle);
  assert.strictEqual(x3dhInit.sharedMasterKey.length, 32, 'Master secret must be 32 bytes');

  const bobDerivedMaster = await X3DH.receiveSession(
    {
      identityKeyPair: bobKeyPair,
      signedPrekeyPair: bobKeyPair,
      oneTimePrekeysMap: {}
    },
    aliceKeyPair.publicKeyBase64,
    x3dhInit.ephemeralPublicKeyBase64,
    null
  );

  assert.deepStrictEqual(
    x3dhInit.sharedMasterKey,
    bobDerivedMaster,
    'X3DH Alice and Bob must derive identical 32-byte master key'
  );
  console.log('  ✅ X3DH Key Agreement verified');

  // Test 3: Signal Double Ratchet Encryption & Decryption
  console.log('  Testing Signal Double Ratchet Forward Secrecy & Bidirectional Communication...');
  const aliceRatchet = await DoubleRatchetSession.initAlice(
    x3dhInit.sharedMasterKey,
    bobKeyPair.publicKeyBase64,
    { peerUserId: 'bob', peerDeviceId: 'bob-dev-1' }
  );

  const bobRatchet = await DoubleRatchetSession.initBob(
    bobDerivedMaster,
    bobKeyPair,
    { peerUserId: 'alice', peerDeviceId: 'alice-dev-1' }
  );

  // Alice sends message 1
  const plainMsg1 = { text: 'Hello Bob! This is top secret.', timestamp: Date.now() };
  const encrypted1 = await aliceRatchet.encrypt(plainMsg1);
  assert.ok(encrypted1.ciphertext, 'Ciphertext must be generated');

  // Bob decrypts message 1
  const decrypted1 = await bobRatchet.decrypt(encrypted1);
  assert.strictEqual(decrypted1.text, plainMsg1.text, 'Decrypted message must match original');

  // Bob replies to Alice (triggers asymmetric DH ratchet step)
  const plainMsg2 = { text: 'Hello Alice! I can decrypt you with forward secrecy.', timestamp: Date.now() };
  const encrypted2 = await bobRatchet.encrypt(plainMsg2);
  const decrypted2 = await aliceRatchet.decrypt(encrypted2);
  assert.strictEqual(decrypted2.text, plainMsg2.text, 'Alice must decrypt Bob reply after ratchet advance');
  console.log('  ✅ Double Ratchet bidirectional messaging verified');

  // Test 4: Tamper Detection (AEAD Authentication Tag Check)
  console.log('  Testing Ciphertext Tamper Detection & AEAD Integrity...');
  let tamperCaught = false;
  try {
    const tamperedEncrypted = {
      ...encrypted1,
      // Alter one character of the base64 ciphertext
      ciphertext: encrypted1.ciphertext.substring(0, encrypted1.ciphertext.length - 2) + 'AA'
    };
    await bobRatchet.decrypt(tamperedEncrypted);
  } catch (err) {
    tamperCaught = true;
  }
  assert.ok(tamperCaught, 'Tampered ciphertext must be rejected by AES-GCM AEAD check');
  console.log('  ✅ AEAD Tamper detection verified');

  // Test 5: Safety Number Derivation & Symmetry
  console.log('  Testing 60-Digit Safety Number Symmetry & Determinism...');
  const snAlice = await computeSafetyNumber(aliceKeyPair.publicKeyBase64, bobKeyPair.publicKeyBase64, 'alice', 'bob');
  const snBob = await computeSafetyNumber(bobKeyPair.publicKeyBase64, aliceKeyPair.publicKeyBase64, 'bob', 'alice');

  assert.strictEqual(snAlice.formatted.length, 71, 'Formatted safety number must have 60 digits + 11 spaces');
  assert.strictEqual(snAlice.rawDigits.length, 60, 'Raw safety number must have exactly 60 digits');
  assert.strictEqual(snAlice.formatted, snBob.formatted, 'Safety numbers viewed by Alice and Bob MUST be identical');
  console.log('  ✅ Safety Number symmetry verified:', snAlice.formatted);

  console.log('✨ All Cryptography & Signal Protocol tests passed!\n');
}

runCryptoTests().catch(err => {
  console.error('❌ Crypto Test Failure:', err);
  process.exit(1);
});
