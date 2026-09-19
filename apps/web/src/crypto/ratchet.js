/**
 * Aegis Client Cryptographic Engine - Signal Double Ratchet Implementation
 * Combines KDF Symmetric Ratchet with Asymmetric DH Ratchet for Forward Secrecy
 * and Post-Compromise Security.
 */

import {
  generateECDHKeyPair,
  importPublicKey,
  importPrivateKey,
  computeDH,
  hkdfDerive,
  encryptAESGCM,
  decryptAESGCM
} from './webcrypto.js';

const ROOT_KDF_INFO = 'Aegis-Double-Ratchet-Root-KDF-V1';
const SYMMETRIC_KDF_INFO = 'Aegis-Double-Ratchet-Symmetric-KDF-V1';

export class DoubleRatchetSession {
  constructor(options = {}) {
    this.sessionId = options.sessionId;
    this.peerUserId = options.peerUserId;
    this.peerDeviceId = options.peerDeviceId;
    
    // Ratchet state
    this.rootKey = options.rootKey || null; // Uint8Array(32)
    this.sendingChainKey = options.sendingChainKey || null; // Uint8Array(32)
    this.receivingChainKey = options.receivingChainKey || null; // Uint8Array(32)
    this.ourDHKeyPair = options.ourDHKeyPair || null; // { publicKeyBase64, privateKeyJwk }
    this.peerDHPublicKey = options.peerDHPublicKey || null; // Base64
    
    this.sendMessageNumber = options.sendMessageNumber || 0;
    this.receiveMessageNumber = options.receiveMessageNumber || 0;
    this.previousSendingChainLength = options.previousSendingChainLength || 0;
    
    // Skipped message keys for out-of-order delivery
    this.skippedMessageKeys = options.skippedMessageKeys || {}; // `${peerDH}:${nr}` -> base64Key
  }

  /**
   * Initialize ratchet as Alice (session initiator)
   */
  static async initAlice(masterSecret, peerDHPublicKeyBase64, options = {}) {
    const ourDHKeyPair = await generateECDHKeyPair();
    const session = new DoubleRatchetSession({
      ...options,
      ourDHKeyPair,
      peerDHPublicKey: peerDHPublicKeyBase64
    });

    const ourPrivDH = await importPrivateKey(ourDHKeyPair.privateKeyJwk);
    const peerPubDH = await importPublicKey(peerDHPublicKeyBase64);

    // Initial DH ratchet step
    const dhSecret = await computeDH(ourPrivDH, peerPubDH);
    
    // Derive initial Root Key and Alice's Sending Chain Key
    const derived = await hkdfDerive(dhSecret, masterSecret, ROOT_KDF_INFO, 64);
    session.rootKey = derived.slice(0, 32);
    session.sendingChainKey = derived.slice(32, 64);
    session.receivingChainKey = null;

    return session;
  }

  /**
   * Initialize ratchet as Bob (session receiver)
   */
  static async initBob(masterSecret, ourInitialDHKeyPair, options = {}) {
    const session = new DoubleRatchetSession({
      ...options,
      rootKey: masterSecret,
      ourDHKeyPair: ourInitialDHKeyPair,
      sendingChainKey: null,
      receivingChainKey: null
    });

    return session;
  }

  /**
   * Encrypt a message payload using current ratchet state
   */
  async encrypt(payloadObj) {
    if (!this.sendingChainKey) {
      throw new Error('Sending chain key not initialized');
    }

    // Advance symmetric sending chain: KDF(CKs) -> (CKs_next, MK)
    const { nextChainKey, messageKey } = await this.symmetricStep(this.sendingChainKey);
    this.sendingChainKey = nextChainKey;

    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
    const { ciphertextBase64, ivBase64 } = await encryptAESGCM(messageKey, plaintextBytes);

    const header = {
      dhPublicKey: this.ourDHKeyPair.publicKeyBase64,
      sequenceNumber: this.sendMessageNumber,
      previousChainLength: this.previousSendingChainLength
    };

    this.sendMessageNumber++;

    return {
      header,
      ciphertext: ciphertextBase64,
      iv: ivBase64
    };
  }

  /**
   * Decrypt an incoming ratchet message
   */
  async decrypt(envelope) {
    const { header, ciphertext, iv } = envelope;
    const peerDHPublicKey = header.dhPublicKey;

    // Check if new DH ratchet step is needed
    if (!this.peerDHPublicKey || this.peerDHPublicKey !== peerDHPublicKey) {
      await this.dhRatchetStep(peerDHPublicKey);
    }

    // Advance symmetric receiving chain to message sequence number
    let messageKey = null;
    while (this.receiveMessageNumber <= header.sequenceNumber) {
      const { nextChainKey, messageKey: mk } = await this.symmetricStep(this.receivingChainKey);
      this.receivingChainKey = nextChainKey;
      
      if (this.receiveMessageNumber === header.sequenceNumber) {
        messageKey = mk;
      } else {
        // Store skipped key for out-of-order handling
        this.skippedMessageKeys[`${peerDHPublicKey}:${this.receiveMessageNumber}`] = mk;
      }
      this.receiveMessageNumber++;
    }

    if (!messageKey) {
      throw new Error('Failed to derive message key for sequence number');
    }

    // Decrypt payload with AES-256-GCM
    const decryptedBytes = await decryptAESGCM(messageKey, ciphertext, iv);
    const plaintext = new TextDecoder().decode(decryptedBytes);
    
    return JSON.parse(plaintext);
  }

  /**
   * Execute an Asymmetric DH Ratchet step
   */
  async dhRatchetStep(newPeerDHPublicKey) {
    this.previousSendingChainLength = this.sendMessageNumber;
    this.sendMessageNumber = 0;
    this.receiveMessageNumber = 0;
    this.peerDHPublicKey = newPeerDHPublicKey;

    // Step 1: Compute DH with our current DH private key and peer's new public key
    const ourCurrentPrivDH = await importPrivateKey(this.ourDHKeyPair.privateKeyJwk);
    const peerNewPubDH = await importPublicKey(newPeerDHPublicKey);
    const dh1 = await computeDH(ourCurrentPrivDH, peerNewPubDH);

    // Derive new Root Key and Receiving Chain Key (matches peer's sending chain)
    const derived1 = await hkdfDerive(dh1, this.rootKey, ROOT_KDF_INFO, 64);
    this.rootKey = derived1.slice(0, 32);
    this.receivingChainKey = derived1.slice(32, 64);

    // Step 2: Generate a fresh DH keypair for ourselves for post-compromise security
    this.ourDHKeyPair = await generateECDHKeyPair();
    const ourNewPrivDH = await importPrivateKey(this.ourDHKeyPair.privateKeyJwk);
    const dh2 = await computeDH(ourNewPrivDH, peerNewPubDH);

    // Derive new Root Key and our new Sending Chain Key
    const derived2 = await hkdfDerive(dh2, this.rootKey, ROOT_KDF_INFO, 64);
    this.rootKey = derived2.slice(0, 32);
    this.sendingChainKey = derived2.slice(32, 64);
  }

  /**
   * KDF Symmetric Ratchet step: advances chain key and derives single-use message key
   */
  async symmetricStep(chainKey) {
    const derived = await hkdfDerive(chainKey, new Uint8Array(32), SYMMETRIC_KDF_INFO, 64);
    return {
      nextChainKey: derived.slice(0, 32),
      messageKey: derived.slice(32, 64)
    };
  }

  /**
   * Serialize session state for secure encrypted local storage
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      peerUserId: this.peerUserId,
      peerDeviceId: this.peerDeviceId,
      rootKey: this.rootKey ? Array.from(this.rootKey) : null,
      sendingChainKey: this.sendingChainKey ? Array.from(this.sendingChainKey) : null,
      receivingChainKey: this.receivingChainKey ? Array.from(this.receivingChainKey) : null,
      ourDHKeyPair: this.ourDHKeyPair,
      peerDHPublicKey: this.peerDHPublicKey,
      sendMessageNumber: this.sendMessageNumber,
      receiveMessageNumber: this.receiveMessageNumber,
      previousSendingChainLength: this.previousSendingChainLength
    };
  }

  /**
   * Restore ratchet session from secure local storage
   */
  static fromJSON(data) {
    const session = new DoubleRatchetSession({
      ...data,
      rootKey: data.rootKey ? new Uint8Array(data.rootKey) : null,
      sendingChainKey: data.sendingChainKey ? new Uint8Array(data.sendingChainKey) : null,
      receivingChainKey: data.receivingChainKey ? new Uint8Array(data.receivingChainKey) : null
    });
    return session;
  }
}
