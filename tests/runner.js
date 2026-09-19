/**
 * Aegis Master Test Runner & Assurance Suite
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const testSuites = [
  'tests/unit/crypto.test.js',
  'tests/unit/auth.test.js',
  'tests/unit/retention.test.js',
  'tests/security/plaintext-audit.test.js',
  'tests/lifecycle/message-lifecycle.test.js'
];

console.log('====================================================');
console.log('🛡️  AEGIS PRIVACY-FIRST MESSENGER TEST SUITE RUNNER');
console.log('====================================================\n');

let allPassed = true;

for (const suite of testSuites) {
  const result = spawnSync(process.execPath, [path.join(ROOT, suite)], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    console.error(`❌ Suite failed: ${suite}`);
    allPassed = false;
    break;
  }
}

if (allPassed) {
  console.log('====================================================');
  console.log('🎉 ALL 5 TEST SUITES COMPLETED WITH 0 FAILURES!');
  console.log('✅ Cryptography & Signal Protocol: PASSED');
  console.log('✅ Authentication & E.164 Boundaries: PASSED');
  console.log('✅ 7-Day Server Retention Janitor: PASSED');
  console.log('✅ Zero-Knowledge Plaintext Audit: PASSED');
  console.log('✅ Full End-to-End Data Lifecycle: PASSED');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error('\n❌ Test execution failed.');
  process.exit(1);
}
