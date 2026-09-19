/**
 * Aegis Protocol Constants & Envelope Definitions
 */

export const RETENTION_CONSTANTS = {
  MAX_SERVER_RETENTION_MS: 7 * 24 * 60 * 60 * 1000, // Strict 7 Days in Milliseconds
  DEFAULT_LOCAL_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000, // 30 Days local default
  CLEANUP_INTERVAL_MS: 60 * 1000 // Worker sweeps every 60 seconds
};

export const AUTH_CONSTANTS = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  OTP_MAX_ATTEMPTS: 3,
  OTP_RESEND_COOLDOWN_MS: 60 * 1000, // 60 seconds
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY_DAYS: 30
};

export const ENVELOPE_TYPE = {
  PREKEY_WHISPER_MESSAGE: 1, // Session establishment + initial ciphertext
  WHISPER_MESSAGE: 2,        // Established Double Ratchet message
  RECEIPT: 3                 // Delivery / read receipt acknowledgment
};

export const MESSAGE_CONTENT_TYPE = {
  TEXT: 'text',
  MEDIA: 'media',
  REACTION: 'reaction',
  REPLY: 'reply',
  DELETE: 'delete',
  KEY_EXCHANGE: 'key_exchange'
};

export const DELIVERY_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

export const DISAPPEARING_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '24 Hours', seconds: 86400 },
  { label: '7 Days', seconds: 604800 },
  { label: '90 Days', seconds: 7776000 }
];
