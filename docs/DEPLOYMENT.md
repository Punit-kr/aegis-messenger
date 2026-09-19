# Aegis Deployment & Production Hardening Guide

This guide covers deploying Aegis in local development and production environments using Docker and containerized services.

---

## 1. Local Development Setup

### Prerequisites
- Node.js v24.x LTS
- npm v11+
- Modern Web Browser (Chrome, Firefox, Safari, Edge)

### Step 1: Install Dependencies
```bash
npm install
cd apps/backend && npm install
cd ../../
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Step 3: Run Full Stack
```bash
# Starts both Backend Relay (port 3001) and Web Client (port 3000)
node scripts/dev.js
```

Visit:
- Web App: `http://localhost:3000`
- Backend Relay: `http://localhost:3001`
- Health Check: `http://localhost:3001/health`

### Step 4: Run Test Suites
```bash
node tests/runner.js
```

---

## 2. Production Docker Deployment

### Step 1: Generate Cryptographically Secure Secrets
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
Place these generated strings into your production `.env` file.

### Step 2: Launch Containers
```bash
docker compose up -d --build
```

Services started:
- `backend`: Zero-knowledge relay listening on port 3001 (isolated network).
- `web`: Web client frontend on port 3000.
- `proxy`: NGINX reverse proxy on port 80 (and 443 with TLS certificates).

---

## 3. Production Hardening Checklist

1. **TLS / HTTPS**:
   - Enforce TLS 1.3 on Nginx proxy.
   - Obtain automated Let's Encrypt certificates using Certbot.
   - Ensure WebSocket upgrades (`/ws`) use `wss://`.

2. **Server-Side Ephemeral Storage**:
   - Verify that the 7-day retention daemon is active (`/health` reports status).
   - Use an encrypted volume or RAM disk (`tmpfs`) for temporary attachment storage if physical server seizure is in your threat model.

3. **Rate Limiting**:
   - Ensure rate limiters for `/api/auth/otp/*` and `/api/messages/send` are calibrated to production traffic volumes.

4. **Third-Party Service Isolation**:
   - When configuring Google/Apple OAuth or Twilio SMS, use separate, non-privileged API service accounts.
