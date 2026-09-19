/**
 * Aegis Backend - Authentication Router
 */

import { Router } from 'express';
import { AuthService } from './auth.service.js';
import { authenticateToken } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/security.js';
import { COUNTRY_DATA } from '../../../../../packages/protocol/e164.js';

export const authRouter = Router();

// Country list for phone selection
authRouter.get('/countries', (req, res) => {
  res.json({ countries: COUNTRY_DATA });
});

// Request international phone OTP
authRouter.post('/otp/request', authLimiter.middleware(10), async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const result = await AuthService.requestPhoneOtp(phone);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Verify phone OTP
authRouter.post('/otp/verify', authLimiter.middleware(15), async (req, res) => {
  try {
    const { phone, otp, deviceInfo } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP code are required' });
    }

    const result = await AuthService.verifyPhoneOtp(phone, otp, deviceInfo);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Google OAuth / OIDC
authRouter.post('/google', authLimiter.middleware(15), async (req, res) => {
  try {
    const { idToken, profile, deviceInfo } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Google ID token required' });

    const result = await AuthService.verifyGoogleAuth(idToken, profile, deviceInfo);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apple Sign In
authRouter.post('/apple', authLimiter.middleware(15), async (req, res) => {
  try {
    const { identityToken, userInfo, deviceInfo } = req.body;
    if (!identityToken) return res.status(400).json({ error: 'Apple identity token required' });

    const result = await AuthService.verifyAppleAuth(identityToken, userInfo, deviceInfo);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Refresh Token Rotation
authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const result = AuthService.rotateRefreshToken(refreshToken);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Logout
authRouter.post('/logout', authenticateToken, (req, res) => {
  const result = AuthService.logout(req.device.id);
  res.json(result);
});

// Delete Account
authRouter.delete('/account', authenticateToken, (req, res) => {
  const result = AuthService.deleteAccount(req.user.id);
  res.json(result);
});
