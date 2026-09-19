/**
 * Aegis Backend - Devices & Key Bundles Router
 */

import { Router } from 'express';
import { DevicesService } from './devices.service.js';
import { authenticateToken } from '../../middleware/auth.js';
import { db } from '../../db/database.js';
import { normalizePhoneNumber } from '../../../../../packages/protocol/e164.js';

export const devicesRouter = Router();

// Upload / rotate public prekey bundle
devicesRouter.post('/keys', authenticateToken, (req, res) => {
  try {
    const result = DevicesService.uploadPrekeys(req.device.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch prekey bundles for a recipient user's devices to initiate/ratchet E2EE
devicesRouter.get('/user/:userId/keys', authenticateToken, (req, res) => {
  try {
    const bundles = DevicesService.getPrekeyBundlesForUser(req.params.userId);
    res.json({ bundles });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lookup contact by phone or email (privacy-preserving discovery)
devicesRouter.get('/lookup', authenticateToken, (req, res) => {
  try {
    const { phone, email } = req.query;
    let user = null;

    if (phone) {
      const { valid, e164 } = normalizePhoneNumber(phone);
      if (valid) {
        user = db.get(
          `SELECT id, display_name, phone, avatar_url, about 
           FROM users 
           WHERE phone = ? AND account_status = 'active'`,
          [e164]
        );
      }
    } else if (email) {
      user = db.get(
        `SELECT id, display_name, email, avatar_url, about 
         FROM users 
         WHERE email = ? AND account_status = 'active'`,
        [email.toLowerCase().trim()]
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if blocked
    const isBlocked = db.get(
      `SELECT 1 FROM blocked_users 
       WHERE (blocker_user_id = ? AND blocked_user_id = ?) 
          OR (blocker_user_id = ? AND blocked_user_id = ?)`,
      [req.user.id, user.id, user.id, req.user.id]
    );

    if (isBlocked) {
      return res.status(404).json({ error: 'User not found or unavailable' });
    }

    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List linked devices
devicesRouter.get('/linked', authenticateToken, (req, res) => {
  try {
    const devices = DevicesService.getLinkedDevices(req.user.id);
    res.json({ devices });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Revoke a linked device
devicesRouter.post('/:deviceId/revoke', authenticateToken, (req, res) => {
  try {
    const result = DevicesService.revokeDevice(req.user.id, req.params.deviceId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
