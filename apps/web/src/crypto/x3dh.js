/**
 * Aegis Client Cryptographic Engine - X3DH Protocol
 * Implementation of Extended Triple Diffie-Hellman Key Agreement (Signal compatible)
 */

import {
  generateECDHKeyPair,
  importPublicKey,
  importPrivateKey,
  computeDH,
  hkdfDerive
} from './webcrypto.js';

export class X3DH {
  /**
   * Initiator (Alice) establishes shared master secret using Bob's prekey bundle
   *
   * @param {object} myIdentityKeyPair - Alice's { publicKeyBase64, privateKeyJwk }
   * @param {object} recipientBundle - Bob's prekey bundle from server
   * @returns {Promise<{ sharedMasterKey: Uint8Array, ephemeralPublicKeyBase64: string, oneTimePreKeyId: number|null }>}
   */
  static async initiateSession(myIdentityKeyPair, recipientBundle) {
    const myPrivIK = await importPrivateKey(myIdentityKeyPair.privateKeyJwk);

    // Import Bob's public keys
    const recipientPubIK = await importPublicKey(recipientBundle.identityKey);
    const recipientPubSPK = await importPublicKey(recipientBundle.signedPrekey);
    let recipientPubOPK = null;
    if (recipientBundle.oneTimePrekey) {
      recipientPubOPK = recipientBundle.oneTimePrekey.publicKey 
        ? await importPublicKey(recipientBundle.oneTimePrekey.publicKey)
        : null;
    }

    // Generate Alice's ephemeral keypair EK_A
    const ephemeralKey = await generateECDHKeyPair();
    const myPrivEK = await importPrivateKey(ephemeralKey.privateKeyJwk);

    // Perform DH calculations:
    // DH1 = DH(IK_A, SPK_B)
    const dh1 = await computeDH(myPrivIK, recipientPubSPK);
    // DH2 = DH(EK_A, IK_B)
    const dh2 = await computeDH(myPrivEK, recipientPubIK);
    // DH3 = DH(EK_A, SPK_B)
    const dh3 = await computeDH(myPrivEK, recipientPubSPK);

    let combinedDH;
    if (recipientPubOPK) {
      // DH4 = DH(EK_A, OPK_B)
      const dh4 = await computeDH(myPrivEK, recipientPubOPK);
      combinedDH = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4.length);
      combinedDH.set(dh1, 0);
      combinedDH.set(dh2, dh1.length);
      combinedDH.set(dh3, dh1.length + dh2.length);
      combinedDH.set(dh4, dh1.length + dh2.length + dh3.length);
    } else {
      combinedDH = new Uint8Array(dh1.length + dh2.length + dh3.length);
      combinedDH.set(dh1, 0);
      combinedDH.set(dh2, dh1.length);
      combinedDH.set(dh3, dh1.length + dh2.length);
    }

    // Derive Master Secret using HKDF-SHA256
    const sharedMasterKey = await hkdfDerive(
      combinedDH,
      new Uint8Array(32), // Standard null salt for initial master key
      'Aegis-X3DH-Master-Secret-V1',
      32
    );

    return {
      sharedMasterKey,
      ephemeralPublicKeyBase64: ephemeralKey.publicKeyBase64,
      oneTimePreKeyId: recipientBundle.oneTimePrekey ? recipientBundle.oneTimePrekey.keyId : null
    };
  }

  /**
   * Recipient (Bob) establishes shared master secret from Alice's initial envelope
   *
   * @param {object} myKeys - Bob's keys { identityKey, signedPrekey, oneTimePrekeysMap }
   * @param {string} senderIdentityKeyBase64 - Alice's IK_A
   * @param {string} senderEphemeralKeyBase64 - Alice's EK_A
   * @param {number|null} oneTimePreKeyId - ID of OPK used, if any
   * @returns {Promise<Uint8Array>} sharedMasterKey
   */
  static async receiveSession(myKeys, senderIdentityKeyBase64, senderEphemeralKeyBase64, oneTimePreKeyId = null) {
    const myPrivIK = await importPrivateKey(myKeys.identityKeyPair.privateKeyJwk);
    const myPrivSPK = await importPrivateKey(myKeys.signedPrekeyPair.privateKeyJwk);

    const senderPubIK = await importPublicKey(senderIdentityKeyBase64);
    const senderPubEK = await importPublicKey(senderEphemeralKeyBase64);

    // DH1 = DH(SPK_B, IK_A)
    const dh1 = await computeDH(myPrivSPK, senderPubIK);
    // DH2 = DH(IK_B, EK_A)
    const dh2 = await computeDH(myPrivIK, senderPubEK);
    // DH3 = DH(SPK_B, EK_A)
    const dh3 = await computeDH(myPrivSPK, senderPubEK);

    let combinedDH;
    if (oneTimePreKeyId !== null && myKeys.oneTimePrekeysMap && myKeys.oneTimePrekeysMap[oneTimePreKeyId]) {
      const myPrivOPK = await importPrivateKey(myKeys.oneTimePrekeysMap[oneTimePreKeyId].privateKeyJwk);
      // DH4 = DH(OPK_B, EK_A)
      const dh4 = await computeDH(myPrivOPK, senderPubEK);

      combinedDH = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4.length);
      combinedDH.set(dh1, 0);
      combinedDH.set(dh2, dh1.length);
      combinedDH.set(dh3, dh1.length + dh2.length);
      combinedDH.set(dh4, dh1.length + dh2.length + dh3.length);
    } else {
      combinedDH = new Uint8Array(dh1.length + dh2.length + dh3.length);
      combinedDH.set(dh1, 0);
      combinedDH.set(dh2, dh1.length);
      combinedDH.set(dh3, dh1.length + dh2.length);
    }

    const sharedMasterKey = await hkdfDerive(
      combinedDH,
      new Uint8Array(32),
      'Aegis-X3DH-Master-Secret-V1',
      32
    );

    return sharedMasterKey;
  }
}
