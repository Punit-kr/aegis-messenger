/**
 * Aegis Backend - Messages Relay Router
 */

import { Router } from 'express';
import { MessagesService } from './messages.service.js';
import { authenticateToken } from '../../middleware/auth.js';

export const messagesRouter = Router();

// Send encrypted envelopes to recipient devices
messagesRouter.post('/send', authenticateToken, (req, res) => {
  try {
    const { envelopes } = req.body;
    const result = MessagesService.relayEnvelopes(req.user.id, req.device.id, envelopes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch pending undelivered envelopes (offline delivery sync)
messagesRouter.get('/pending', authenticateToken, (req, res) => {
  try {
    const messages = MessagesService.fetchPendingEnvelopes(req.device.id);
    res.json({ messages });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Acknowledge receipt of messages
messagesRouter.post('/ack', authenticateToken, (req, res) => {
  try {
    const { messageIds } = req.body;
    const result = MessagesService.acknowledgeReceipt(req.device.id, messageIds);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
