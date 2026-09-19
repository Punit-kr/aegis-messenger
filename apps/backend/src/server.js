/**
 * Aegis Backend Server Entry Point
 * Production-Grade Zero-Knowledge Relay for End-to-End Encrypted Messaging
 */

import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from './config/config.js';
import { db } from './db/database.js';
import { standardLimiter } from './middleware/security.js';
import { authRouter } from './modules/auth/auth.router.js';
import { devicesRouter } from './modules/devices/devices.router.js';
import { messagesRouter } from './modules/messages/messages.router.js';
import { mediaRouter } from './modules/media/media.router.js';
import { privacyRouter } from './modules/privacy/privacy.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { wsRelay } from './websocket/relay.js';
import { RetentionJanitor } from './modules/retention/retention.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Security Headers & CORS
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for local dev/flexibility with WebCrypto and blob URLs
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: CONFIG.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(standardLimiter.middleware(300));

// Serve Web Client if static dist exists
const webDistPath = path.resolve(__dirname, '../../web/public');
app.use(express.static(webDistPath));

// Mount REST API Routers
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/users', usersRouter);

// Health Check & System Status Endpoint
app.get('/health', (req, res) => {
  const userCount = db.get('SELECT COUNT(*) as count FROM users');
  const pendingMsgCount = db.get('SELECT COUNT(*) as count FROM temporary_messages');
  const tempAttCount = db.get('SELECT COUNT(*) as count FROM temporary_attachments');

  res.json({
    status: 'healthy',
    service: 'aegis-relay',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    metrics: {
      registeredUsers: userCount?.count || 0,
      queuedCiphertextEnvelopes: pendingMsgCount?.count || 0,
      activeEncryptedAttachments: tempAttCount?.count || 0,
      activeWebSocketConnections: wsRelay.activeConnections.size
    },
    zeroKnowledgeGuarantee: {
      serverPlaintextStorage: false,
      serverPrivateKeyStorage: false,
      serverMaxRetentionPolicy: '7 Days Strictly Enforced'
    }
  });
});

// Manual trigger for retention sweep (admin / testing)
app.post('/api/admin/retention/sweep', (req, res) => {
  const stats = RetentionJanitor.runCleanupSweep();
  res.json({ success: true, sweep: stats });
});

// Attach real-time WebSocket relay
wsRelay.attach(server);

// Start periodic 7-day retention janitor daemon
const retentionTimer = setInterval(() => {
  try {
    RetentionJanitor.runCleanupSweep();
  } catch (err) {
    // Non-blocking log
  }
}, CONFIG.RETENTION.CLEANUP_INTERVAL_MS);

// Start listening
if (process.env.NODE_ENV !== 'test') {
  server.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(`====================================================`);
    console.log(`🛡️  AEGIS ZERO-KNOWLEDGE RELAY RUNNING`);
    console.log(`📡  HTTP & WS Server listening on http://${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log(`🔒  E2EE Relay Active: Plaintext persistence strictly DISABLED`);
    console.log(`⏳  Automated 7-Day Server Retention Janitor Active`);
    console.log(`====================================================`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(retentionTimer);
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  clearInterval(retentionTimer);
  server.close(() => process.exit(0));
});

export { app, server };
