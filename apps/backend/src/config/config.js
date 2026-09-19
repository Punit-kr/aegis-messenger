/**
 * Aegis Backend Configuration
 */

import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');
const fallbackRefreshSecret = crypto.randomBytes(32).toString('hex');

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
  JWT_SECRET: process.env.JWT_SECRET || fallbackJwtSecret,
  REFRESH_SECRET: process.env.REFRESH_SECRET || fallbackRefreshSecret,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  MEDIA_DIR: process.env.MEDIA_DIR || path.resolve(__dirname, '../../data/media'),
  RETENTION: {
    MAX_MESSAGE_RETENTION_MS: 7 * 24 * 60 * 60 * 1000, // Strict 7 Days
    MAX_ATTACHMENT_RETENTION_MS: 7 * 24 * 60 * 60 * 1000, // Strict 7 Days
    CLEANUP_INTERVAL_MS: 30 * 1000 // 30 seconds interval for testing/worker
  },
  AUTH: {
    OTP_EXPIRY_MS: 5 * 60 * 1000,
    OTP_MAX_ATTEMPTS: 3,
    ACCESS_TOKEN_LIFETIME: '15m',
    REFRESH_TOKEN_DAYS: 30,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',
    SMS_PROVIDER: process.env.SMS_PROVIDER || 'mock' // 'mock' or 'twilio'
  }
};
