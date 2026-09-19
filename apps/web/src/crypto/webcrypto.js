/**
 * Aegis Client Cryptographic Engine - Web Crypto Primitives
 * Standard: W3C Web Cryptography API (SubtleCrypto)
 * Universal execution across modern Browsers and Node.js runtime.
 */

const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
  throw new Error('WebCrypto API is not available in this environment');
};

// Generate ECDH P-256 Keypair for Identity, Signed Prekey, and Ephemeral Keys
export async function generateECDHKeyPair() {
  const cryptoObj = getCrypto();
  const keyPair = await cryptoObj.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const pubRaw = await cryptoObj.subtle.exportKey('raw', keyPair.publicKey);
  const privJwk = await cryptoObj.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    keyPair,
    publicKeyBase64: arrayBufferToBase64(pubRaw),
    privateKeyJwk: privJwk
  };
}

// Import public ECDH key from Base64
export async function importPublicKey(base64Str) {
  const cryptoObj = getCrypto();
  const rawBytes = base64ToArrayBuffer(base64Str);
  return cryptoObj.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Import private ECDH key from JWK
export async function importPrivateKey(jwk) {
  const cryptoObj = getCrypto();
  return cryptoObj.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Compute Diffie-Hellman Shared Secret (ECDH)
export async function computeDH(privateKey, publicKey) {
  const cryptoObj = getCrypto();
  const bits = await cryptoObj.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey
    },
    privateKey,
    256 // 256 bits output
  );
  return new Uint8Array(bits);
}

// HKDF (RFC 5869) Key Derivation Function using HMAC-SHA-256
export async function hkdfDerive(ikmBytes, saltBytes, infoStr, outputLengthBytes = 32) {
  const cryptoObj = getCrypto();
  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    ikmBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const encoder = new TextEncoder();
  const infoBytes = encoder.encode(infoStr);
  const salt = saltBytes && saltBytes.length > 0 ? saltBytes : new Uint8Array(32);

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: infoBytes
    },
    baseKey,
    outputLengthBytes * 8
  );

  return new Uint8Array(derivedBits);
}

// AES-256-GCM Authenticated Encryption
export async function encryptAESGCM(keyBytes, plaintextBytes, associatedData = null) {
  const cryptoObj = getCrypto();
  const key = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // 96-bit random Initialization Vector (IV)
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));

  const encryptParams = {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128
  };

  if (associatedData) {
    encryptParams.additionalData = typeof associatedData === 'string' 
      ? new TextEncoder().encode(associatedData) 
      : associatedData;
  }

  const ciphertextWithTag = await cryptoObj.subtle.encrypt(
    encryptParams,
    key,
    plaintextBytes
  );

  return {
    ciphertextBase64: arrayBufferToBase64(ciphertextWithTag),
    ivBase64: arrayBufferToBase64(iv)
  };
}

// AES-256-GCM Authenticated Decryption
export async function decryptAESGCM(keyBytes, ciphertextBase64, ivBase64, associatedData = null) {
  const cryptoObj = getCrypto();
  const key = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const ciphertextWithTag = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decryptParams = {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128
  };

  if (associatedData) {
    decryptParams.additionalData = typeof associatedData === 'string' 
      ? new TextEncoder().encode(associatedData) 
      : associatedData;
  }

  const plaintextBuffer = await cryptoObj.subtle.decrypt(
    decryptParams,
    key,
    ciphertextWithTag
  );

  return new Uint8Array(plaintextBuffer);
}

// SHA-256 Digest
export async function sha256(data) {
  const cryptoObj = getCrypto();
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Binary / Base64 Helpers (Universal Browser & Node.js)
export function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
