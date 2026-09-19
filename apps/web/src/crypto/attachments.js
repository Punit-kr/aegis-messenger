/**
 * Aegis Client Cryptographic Engine - Client-Side Encrypted Attachments
 * Encrypts images, audio, video, and documents before transmission.
 * Server stores and relays only ciphertext.
 */

import {
  encryptAESGCM,
  decryptAESGCM,
  sha256,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from './webcrypto.js';

export class EncryptedAttachmentManager {
  /**
   * Encrypt a local File or Blob with a random single-use AES-256-GCM key
   *
   * @param {File|Blob} file
   * @returns {Promise<{ ciphertextBlob: Blob, keyBase64: string, ivBase64: string, sha256Hex: string, mimeType: string, fileSize: number, fileName: string }>}
   */
  static async encryptFile(file) {
    const rawBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    // Generate random 256-bit AES key
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
    
    // Encrypt file content
    const { ciphertextBase64, ivBase64 } = await encryptAESGCM(rawKey, rawBytes);
    const ciphertextBytes = base64ToArrayBuffer(ciphertextBase64);
    
    // Calculate transport integrity hash of ciphertext
    const sha256Hex = await sha256(ciphertextBytes);

    const ciphertextBlob = new Blob([ciphertextBytes], { type: 'application/octet-stream' });

    return {
      ciphertextBlob,
      keyBase64: arrayBufferToBase64(rawKey),
      ivBase64,
      sha256Hex,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileName: file.name || 'attachment.dat'
    };
  }

  /**
   * Decrypt a downloaded ciphertext blob using the key and IV received in E2EE envelope
   *
   * @param {ArrayBuffer} ciphertextBuffer
   * @param {string} keyBase64
   * @param {string} ivBase64
   * @param {string} expectedSha256
   * @param {string} mimeType
   * @returns {Promise<{ decryptedBlob: Blob, objectUrl: string }>}
   */
  static async decryptFile(ciphertextBuffer, keyBase64, ivBase64, expectedSha256, mimeType = 'application/octet-stream') {
    const ciphertextBytes = new Uint8Array(ciphertextBuffer);

    // Verify SHA-256 checksum
    if (expectedSha256) {
      const computedHash = await sha256(ciphertextBytes);
      if (computedHash.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error('Integrity verification failed: Ciphertext hash mismatch');
      }
    }

    const rawKey = base64ToArrayBuffer(keyBase64);
    const ciphertextBase64 = arrayBufferToBase64(ciphertextBytes);

    const decryptedBytes = await decryptAESGCM(rawKey, ciphertextBase64, ivBase64);
    const decryptedBlob = new Blob([decryptedBytes], { type: mimeType });
    const objectUrl = URL.createObjectURL(decryptedBlob);

    return {
      decryptedBlob,
      objectUrl
    };
  }
}
