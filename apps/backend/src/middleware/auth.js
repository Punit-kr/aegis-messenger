/**
 * Aegis Backend - Authentication & Device Session Middleware
 */

import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/config.js';
import { db } from '../db/database.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    
    // Check if device or user exists and is active
    const device = db.get(
      `SELECT d.id, d.user_id, d.platform, d.device_name, d.revoked_at, u.account_status 
       FROM devices d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = ?`,
      [decoded.deviceId]
    );

    if (!device) {
      return res.status(401).json({ error: 'Device not recognized' });
    }

    if (device.revoked_at) {
      return res.status(403).json({ error: 'Device has been revoked' });
    }

    if (device.account_status === 'suspended' || device.account_status === 'deleted') {
      return res.status(403).json({ error: 'Account is no longer active' });
    }

    // Update device last seen timestamp
    db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [Date.now(), device.id]);

    req.user = { id: device.user_id };
    req.device = {
      id: device.id,
      platform: device.platform,
      name: device.device_name
    };

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
