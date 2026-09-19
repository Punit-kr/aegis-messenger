/**
 * Aegis Backend - Encrypted Media Router
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import { MediaService } from './media.service.js';
import { authenticateToken } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/security.js';

export const mediaRouter = Router();

// Configure temp upload storage
const upload = multer({
  dest: path.join(os.tmpdir(), 'aegis-uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max encrypted blob
  }
});

// Upload encrypted attachment
mediaRouter.post('/upload', authenticateToken, uploadLimiter.middleware(30), upload.single('ciphertextBlob'), (req, res) => {
  try {
    const result = MediaService.saveAttachment(req.device.id, req.file);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Download encrypted attachment
mediaRouter.get('/:attachmentId', authenticateToken, (req, res) => {
  try {
    const attachment = MediaService.getAttachment(req.params.attachmentId);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize);
    res.setHeader('X-Ciphertext-SHA256', attachment.sha256);
    res.sendFile(attachment.filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});
