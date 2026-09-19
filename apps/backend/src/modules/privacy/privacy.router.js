/**
 * Aegis Backend - Privacy Router
 */

import { Router } from 'express';
import { PrivacyService } from './privacy.service.js';
import { authenticateToken } from '../../middleware/auth.js';

export const privacyRouter = Router();

// Get settings
privacyRouter.get('/settings', authenticateToken, (req, res) => {
  try {
    const settings = PrivacyService.getSettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update settings
privacyRouter.put('/settings', authenticateToken, (req, res) => {
  try {
    const settings = PrivacyService.updateSettings(req.user.id, req.body);
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List blocked users
privacyRouter.get('/blocked', authenticateToken, (req, res) => {
  try {
    const blocked = PrivacyService.getBlockedUsers(req.user.id);
    res.json({ blocked });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Block user
privacyRouter.post('/block', authenticateToken, (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID to block is required' });

    const result = PrivacyService.blockUser(req.user.id, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unblock user
privacyRouter.post('/unblock', authenticateToken, (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID to unblock is required' });

    const result = PrivacyService.unblockUser(req.user.id, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Report user
privacyRouter.post('/report', authenticateToken, (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId || !reason) return res.status(400).json({ error: 'User ID and reason required' });

    const result = PrivacyService.reportUser(req.user.id, userId, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
