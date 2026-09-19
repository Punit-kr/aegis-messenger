/**
 * Aegis Protocol - Deterministic Safety Number Calculation
 * Compatible with Signal-style 60-digit verification codes.
 */

/**
 * Derives a deterministic 60-digit safety number between two participant identity keys.
 * Sorts the identity keys lexicographically so the calculated code is identical
 * regardless of who initiated or views the verification screen.
 *
 * @param {string} identityKeyA - Base64 or Hex public identity key
 * @param {string} identityKeyB - Base64 or Hex public identity key
 * @param {string} userIdA - Canonical User ID / Phone A
 * @param {string} userIdB - Canonical User ID / Phone B
 * @returns {Promise<{ formatted: string, rawDigits: string, qrPayload: string }>}
 */
export async function computeSafetyNumber(identityKeyA, identityKeyB, userIdA = '', userIdB = '') {
  // Lexicographical sorting ensures peer symmetry: SN(A, B) === SN(B, A)
  let firstKey = identityKeyA;
  let secondKey = identityKeyB;
  let firstId = userIdA;
  let secondId = userIdB;

  if (identityKeyA.localeCompare(identityKeyB) > 0) {
    firstKey = identityKeyB;
    secondKey = identityKeyA;
    firstId = userIdB;
    secondId = userIdA;
  }

  const encoder = new TextEncoder();
  const inputData = encoder.encode(
    `AEGIS-SAFETY-NUMBER-V1:${firstId}:${firstKey}:${secondId}:${secondKey}`
  );

  // Use WebCrypto SubtleCrypto or Node crypto depending on environment
  let hashBuffer;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    hashBuffer = await crypto.subtle.digest('SHA-512', inputData);
  } else {
    const nodeCrypto = await import('crypto');
    hashBuffer = nodeCrypto.createHash('sha512').update(inputData).digest();
  }

  const bytes = new Uint8Array(hashBuffer);

  // Extract 12 chunks of 5 digits from the 64-byte SHA-512 digest
  // Each 5-digit number is derived from a 16-bit integer modulo 100000 (padded with leading zeros)
  const chunks = [];
  for (let i = 0; i < 12; i++) {
    const offset = i * 2;
    const value = ((bytes[offset] << 8) | bytes[offset + 1]) % 100000;
    chunks.push(value.toString().padStart(5, '0'));
  }

  const rawDigits = chunks.join('');
  const formatted = chunks.join(' ');
  const qrPayload = JSON.stringify({
    v: 1,
    sn: rawDigits,
    k1: firstKey.substring(0, 16),
    k2: secondKey.substring(0, 16)
  });

  return {
    formatted,
    rawDigits,
    qrPayload
  };
}
