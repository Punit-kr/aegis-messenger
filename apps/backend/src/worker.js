/**
 * Aegis Retention Janitor Daemon
 * Standalone worker process for continuous 7-day retention enforcement.
 */

import { RetentionJanitor } from './modules/retention/retention.service.js';
import { CONFIG } from './config/config.js';

console.log('🧹 Aegis 7-Day Retention Janitor Daemon Started');
console.log(`⏱️  Running sweep every ${CONFIG.RETENTION.CLEANUP_INTERVAL_MS / 1000} seconds`);

function sweep() {
  try {
    const stats = RetentionJanitor.runCleanupSweep();
    if (stats.expiredMessagesPurged > 0 || stats.expiredAttachmentsPurged > 0) {
      console.log(`[${new Date().toISOString()}] Retention Sweep Completed:`, stats);
    }
  } catch (err) {
    console.error('Retention sweep error:', err.message);
  }
}

// Initial sweep on startup
sweep();

// Recurring sweep loop
setInterval(sweep, CONFIG.RETENTION.CLEANUP_INTERVAL_MS);
