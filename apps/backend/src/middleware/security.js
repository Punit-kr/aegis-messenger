/**
 * Aegis Backend - Security, Rate Limiting & Abuse Protection Middleware
 */

class RateLimiter {
  constructor(windowMs = 60 * 1000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();

    // Periodic sweep to prevent memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.requests.entries()) {
        if (now - record.startTime > this.windowMs) {
          this.requests.delete(key);
        }
      }
    }, windowMs * 2);
  }

  middleware(customMax = null) {
    return (req, res, next) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const key = `${ip}:${req.baseUrl || req.path}`;
      const now = Date.now();
      const limit = customMax || this.maxRequests;

      let record = this.requests.get(key);
      if (!record || (now - record.startTime > this.windowMs)) {
        record = { count: 1, startTime: now };
        this.requests.set(key, record);
      } else {
        record.count++;
      }

      if (record.count > limit) {
        return res.status(429).json({
          error: 'Too many requests. Please slow down.',
          retryAfterMs: Math.max(0, this.windowMs - (now - record.startTime))
        });
      }

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - record.count));
      next();
    };
  }
}

export const standardLimiter = new RateLimiter(60 * 1000, 120); // 120 reqs/min
export const authLimiter = new RateLimiter(60 * 1000, 10);      // 10 reqs/min for auth/OTP
export const uploadLimiter = new RateLimiter(60 * 1000, 30);    // 30 uploads/min
