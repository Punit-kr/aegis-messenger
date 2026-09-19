/**
 * Aegis Backend - User Profile & Presence Router
 */

import { Router } from 'express';
import { db } from '../../db/database.js';
import { authenticateToken } from '../../middleware/auth.js';
import { wsRelay } from '../../websocket/relay.js';

export const usersRouter = Router();

// Current user profile
usersRouter.get('/me', authenticateToken, (req, res) => {
  const user = db.get(
    'SELECT id, phone, email, display_name, avatar_url, about, auth_provider, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update profile
usersRouter.put('/me', authenticateToken, (req, res) => {
  const { displayName, avatarUrl, about } = req.body;
  const now = Date.now();

  const current = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const newName = displayName !== undefined ? displayName.trim() : current.display_name;
  const newAvatar = avatarUrl !== undefined ? avatarUrl : current.avatar_url;
  const newAbout = about !== undefined ? about.trim() : current.about;

  db.run(
    'UPDATE users SET display_name = ?, avatar_url = ?, about = ?, updated_at = ? WHERE id = ?',
    [newName, newAvatar, newAbout, now, req.user.id]
  );

  const updated = db.get(
    'SELECT id, phone, email, display_name, avatar_url, about, auth_provider FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json({ user: updated });
});

// Public profile lookup
usersRouter.get('/:id', authenticateToken, (req, res) => {
  const targetUser = db.get(
    'SELECT id, display_name, avatar_url, about, created_at FROM users WHERE id = ? AND account_status = "active"',
    [req.params.id]
  );
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Privacy filters
  const privacy = db.get('SELECT * FROM privacy_settings WHERE user_id = ?', [targetUser.id]) || {};
  if (privacy.profile_photo_visibility === 'nobody') {
    targetUser.avatar_url = null;
  }

  res.json({ user: targetUser });
});

// Presence & online status
usersRouter.get('/:id/presence', authenticateToken, (req, res) => {
  const targetId = req.params.id;
  const privacy = db.get('SELECT * FROM privacy_settings WHERE user_id = ?', [targetId]) || {};

  if (privacy.last_seen_visibility === 'nobody') {
    return res.json({ online: false, lastSeen: null });
  }

  const isOnline = wsRelay.isUserOnline(targetId);
  const lastDevice = db.get(
    'SELECT MAX(last_seen_at) as last_seen FROM devices WHERE user_id = ?',
    [targetId]
  );

  res.json({
    online: isOnline,
    lastSeen: lastDevice ? lastDevice.last_seen : null
  });
});
