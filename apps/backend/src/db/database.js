/**
 * Aegis Backend - High Performance Database Engine
 * Implements strict schema boundaries, zero-knowledge constraints, and WAL mode.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_FILE || path.join(DATA_DIR, 'aegis.sqlite');

export class AegisDatabase {
  constructor(dbPath = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  init() {
    // Enable foreign keys and Write-Ahead Logging for concurrency and reliability
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');

    this.createSchema();
  }

  createSchema() {
    this.db.exec(`
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        email TEXT UNIQUE,
        auth_provider TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        about TEXT DEFAULT 'Hey there! I am using Aegis.',
        account_status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- User Privacy Settings
      CREATE TABLE IF NOT EXISTS privacy_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_seen_visibility TEXT DEFAULT 'everyone',
        read_receipts_enabled INTEGER DEFAULT 1,
        typing_indicators_enabled INTEGER DEFAULT 1,
        profile_photo_visibility TEXT DEFAULT 'everyone',
        disappearing_messages_default INTEGER DEFAULT 0
      );

      -- Devices Table
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        push_token TEXT,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER DEFAULT NULL
      );

      -- Device Cryptographic Public Keys (Signal Protocol Bundle)
      CREATE TABLE IF NOT EXISTS device_keys (
        device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
        registration_id INTEGER NOT NULL,
        identity_key TEXT NOT NULL,
        signed_prekey TEXT NOT NULL,
        signed_prekey_id INTEGER NOT NULL,
        signed_prekey_sig TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        rotated_at INTEGER NOT NULL
      );

      -- One-Time Prekeys Pool (OPK)
      CREATE TABLE IF NOT EXISTS one_time_prekeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        key_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        consumed_at INTEGER DEFAULT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_opk_lookup ON one_time_prekeys(device_id, consumed_at);

      -- Sessions & Refresh Tokens
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER DEFAULT NULL
      );

      -- Phone OTP Authentication Store
      CREATE TABLE IF NOT EXISTS auth_otps (
        phone TEXT PRIMARY KEY,
        otp_hash TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      -- Temporary Encrypted Message Relay Queue (STRICT 7-DAY RETENTION)
      -- Plaintext is NEVER stored. Only encrypted ciphertext envelopes.
      CREATE TABLE IF NOT EXISTS temporary_messages (
        id TEXT PRIMARY KEY,
        sender_device_id TEXT NOT NULL REFERENCES devices(id),
        sender_user_id TEXT NOT NULL REFERENCES users(id),
        recipient_device_id TEXT NOT NULL REFERENCES devices(id),
        recipient_user_id TEXT NOT NULL REFERENCES users(id),
        envelope_type INTEGER NOT NULL,
        encrypted_envelope TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        delivered_at INTEGER DEFAULT NULL,
        receipt_acknowledged_at INTEGER DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_msg_recipient ON temporary_messages(recipient_device_id, delivered_at);
      CREATE INDEX IF NOT EXISTS idx_msg_expiry ON temporary_messages(expires_at);

      -- Temporary Encrypted Attachments (STRICT 7-DAY RETENTION)
      CREATE TABLE IF NOT EXISTS temporary_attachments (
        id TEXT PRIMARY KEY,
        uploader_device_id TEXT NOT NULL REFERENCES devices(id),
        storage_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        sha256_checksum TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_att_expiry ON temporary_attachments(expires_at);

      -- Blocked Users Table
      CREATE TABLE IF NOT EXISTS blocked_users (
        blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (blocker_user_id, blocked_user_id)
      );

      -- User Reports Table
      CREATE TABLE IF NOT EXISTS user_reports (
        id TEXT PRIMARY KEY,
        reporter_user_id TEXT NOT NULL REFERENCES users(id),
        reported_user_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  // Prepared statement execution helpers
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  close() {
    this.db.close();
  }
}

// Global database instance
export const db = new AegisDatabase();
