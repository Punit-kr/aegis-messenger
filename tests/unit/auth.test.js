/**
 * Aegis Automated Security & Auth Unit Tests
 * Tests E.164 normalization, Phone OTP lifecycle, Brute-force lockout,
 * Google/Apple authentication, and Refresh Token Rotation.
 */

import assert from 'node:assert';
import { normalizePhoneNumber } from '../../packages/protocol/e164.js';
import { AuthService } from '../../apps/backend/src/modules/auth/auth.service.js';
import { db } from '../../apps/backend/src/db/database.js';

async function runAuthTests() {
  console.log('🧪 [TEST SUITE 2/5] Authentication & Security Boundary Tests');

  // Test 1: E.164 International Normalization
  console.log('  Testing International E.164 Normalization across multiple regions...');
  
  const testCases = [
    { input: '(415) 555-2671', defaultCode: '+1', expected: '+14155552671', desc: 'US National format' },
    { input: '+1 415 555 2671', defaultCode: '+1', expected: '+14155552671', desc: 'US International format' },
    { input: '07123 456789', defaultCode: '+44', expected: '+447123456789', desc: 'UK format with trunk 0' },
    { input: '+91 98765 43210', defaultCode: '+91', expected: '+919876543210', desc: 'India format' },
    { input: '0171 2345678', defaultCode: '+49', expected: '+491712345678', desc: 'Germany format with trunk 0' },
    { input: '090-1234-5678', defaultCode: '+81', expected: '+819012345678', desc: 'Japan mobile format' }
  ];

  for (const tc of testCases) {
    const res = normalizePhoneNumber(tc.input, tc.defaultCode);
    assert.strictEqual(res.valid, true, `Should be valid for ${tc.desc}`);
    assert.strictEqual(res.e164, tc.expected, `Mismatch for ${tc.desc}`);
  }

  // Reject invalid numbers
  const invalidRes1 = normalizePhoneNumber('123');
  assert.strictEqual(invalidRes1.valid, false, 'Should reject short numbers');

  const invalidRes2 = normalizePhoneNumber('not-a-number');
  assert.strictEqual(invalidRes2.valid, false, 'Should reject non-digits');
  console.log('  ✅ International E.164 phone normalization verified');

  // Test 2: OTP Request & Secure Hashing
  console.log('  Testing OTP Request, Expiry & Zero Plaintext in Database...');
  const testPhone = '+14155559999';
  // Clean prior state
  db.run('DELETE FROM auth_otps WHERE phone = ?', [testPhone]);
  db.run('DELETE FROM users WHERE phone = ?', [testPhone]);

  const otpRes = await AuthService.requestPhoneOtp(testPhone);
  assert.strictEqual(otpRes.success, true);
  assert.strictEqual(otpRes.phone, testPhone);
  assert.ok(otpRes.devCode, 'Dev code generated for testing');

  // Verify server database stores ONLY the bcrypt hash and NEVER plain OTP
  const dbOtp = db.get('SELECT * FROM auth_otps WHERE phone = ?', [testPhone]);
  assert.ok(dbOtp.otp_hash.startsWith('$2'), 'OTP must be hashed with bcrypt in database');
  assert.ok(!JSON.stringify(dbOtp).includes(otpRes.devCode), 'Plaintext OTP MUST NOT exist in DB row');
  console.log('  ✅ Zero Plaintext OTP persistence verified');

  // Test 3: OTP Brute-Force Lockout (3 Attempts Limit)
  console.log('  Testing OTP Brute-Force Lockout & Retry Limits...');
  let failedAttempts = 0;
  for (let i = 1; i <= 3; i++) {
    try {
      await AuthService.verifyPhoneOtp(testPhone, '000000', { deviceName: 'TestDev' });
    } catch (e) {
      failedAttempts++;
    }
  }
  assert.strictEqual(failedAttempts, 3, 'Must reject 3 wrong attempts');

  // The 4th attempt should find the OTP purged due to lockout
  let lockedOut = false;
  try {
    await AuthService.verifyPhoneOtp(testPhone, otpRes.devCode, { deviceName: 'TestDev' });
  } catch (e) {
    lockedOut = true;
    assert.ok(e.message.includes('locked') || e.message.includes('No pending OTP'), 'Must report lockout');
  }
  assert.ok(lockedOut, 'Account must be locked out after 3 failed OTP attempts');
  console.log('  ✅ OTP Brute-force lockout verified');

  // Test 4: Successful OTP Verification & Replay Protection
  console.log('  Testing Successful OTP Verification, Device Session & Replay Protection...');
  // Request fresh OTP
  db.run('DELETE FROM auth_otps WHERE phone = ?', [testPhone]);
  const freshOtpRes = await AuthService.requestPhoneOtp(testPhone);

  const authSession = await AuthService.verifyPhoneOtp(testPhone, freshOtpRes.devCode, {
    deviceName: 'iPhone 15 Pro',
    platform: 'ios'
  });

  assert.ok(authSession.user.id, 'User ID must exist');
  assert.ok(authSession.tokens.accessToken, 'Access token must be generated');
  assert.ok(authSession.tokens.refreshToken, 'Refresh token must be generated');
  assert.strictEqual(authSession.device.platform, 'ios');

  // Replay Attack Test: Re-using the same OTP immediately must be rejected
  let replayCaught = false;
  try {
    await AuthService.verifyPhoneOtp(testPhone, freshOtpRes.devCode, { deviceName: 'iPhone 15 Pro' });
  } catch (e) {
    replayCaught = true;
  }
  assert.ok(replayCaught, 'OTP must be immediately destroyed to prevent replay attacks');
  console.log('  ✅ OTP Verification & Replay Protection verified');

  // Test 5: Refresh Token Rotation & Reuse Detection
  console.log('  Testing Refresh Token Rotation & Compromise Revocation...');
  const originalRefresh = authSession.tokens.refreshToken;

  const rotated = AuthService.rotateRefreshToken(originalRefresh);
  assert.ok(rotated.accessToken, 'Fresh access token must be issued');
  assert.ok(rotated.refreshToken, 'New refresh token must be issued');
  assert.notStrictEqual(rotated.refreshToken, originalRefresh, 'Refresh token must be rotated');

  // Reuse Detection: If someone attempts to use the OLD refresh token again, revoke the session!
  let reuseBlocked = false;
  try {
    AuthService.rotateRefreshToken(originalRefresh);
  } catch (e) {
    reuseBlocked = true;
    assert.ok(e.message.includes('reuse') || e.message.includes('invalid'), 'Must report reuse detection');
  }
  assert.ok(reuseBlocked, 'Replaying old refresh token must trigger security violation');
  console.log('  ✅ Refresh token rotation & reuse detection verified');

  // Test 6: Google and Apple Auth Handlers
  console.log('  Testing Google OIDC & Apple Sign-In Handlers...');
  const googleRes = await AuthService.verifyGoogleAuth('mock-id-token', {
    email: 'alice.test@example.com',
    name: 'Alice Test'
  }, { deviceName: 'Pixel 8', platform: 'android' });

  assert.strictEqual(googleRes.user.email, 'alice.test@example.com');
  assert.strictEqual(googleRes.user.authProvider, 'google');

  const appleRes = await AuthService.verifyAppleAuth('mock-apple-token', {
    email: 'bob.privaterelay@appleid.com',
    name: { firstName: 'Bob', lastName: 'Apple' }
  }, { deviceName: 'MacBook Pro', platform: 'desktop' });

  assert.strictEqual(appleRes.user.authProvider, 'apple');
  console.log('  ✅ Google OIDC & Apple Sign In verified');

  console.log('✨ All Authentication & Security Boundary tests passed!\n');
}

runAuthTests().catch(err => {
  console.error('❌ Auth Test Failure:', err);
  process.exit(1);
});
