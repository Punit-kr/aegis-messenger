/**
 * Aegis Unified Development Runner
 * Starts Backend Zero-Knowledge Relay and Web Client Server
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('🚀 Launching Aegis Full Development Environment...');

const backend = spawn(process.execPath, ['apps/backend/src/server.js'], {
  cwd: ROOT,
  stdio: 'inherit'
});

const web = spawn(process.execPath, ['apps/web/server.js'], {
  cwd: ROOT,
  stdio: 'inherit'
});

process.on('SIGINT', () => {
  backend.kill();
  web.kill();
  process.exit();
});
