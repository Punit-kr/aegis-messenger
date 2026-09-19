# 🛡️ Aegis Messenger

> **Production-Grade, Zero-Knowledge, End-to-End Encrypted Privacy Messaging Application**

Aegis is built with the usability of modern messaging applications and the security philosophy of the Signal Protocol. It enforces end-to-end encryption across all messages and media, operates as a blind server relay, and enforces an automated 7-day maximum retention window.

---

## 🌟 Core Architecture & Capabilities

- **Signal-Compatible End-to-End Encryption**:
  - **X3DH Protocol**: Extended Triple Diffie-Hellman session establishment using Identity Keys ($IK$), Signed Pre-Keys ($SPK$), and One-Time Pre-Keys ($OPK$).
  - **Double Ratchet Algorithm**: Combines an Asymmetric DH Ratchet with a Symmetric KDF Ratchet to provide strict **Forward Secrecy** and **Post-Compromise Security**.
  - **Authenticated Payloads**: Encrypted with AES-256-GCM authenticated ciphertext.
  - **Safety Numbers**: 60-digit deterministic numeric fingerprints and QR code verification.
- **Strict Zero-Knowledge Server Relay**:
  - The backend server **NEVER** sees or stores plaintext message bodies.
  - The backend server **NEVER** generates or holds private keys.
  - Plaintext persistence is strictly forbidden and verified via automated audits.
- **Automated 7-Day Server Retention**:
  - Server retention janitor daemon continuously sweeps and permanently shreds temporary ciphertext envelopes and temporary attachments older than 7 days.
- **Client-Side Encrypted Attachments**:
  - Media (photos, videos, audio, voice notes, documents) encrypted in browser memory using single-use AES-256-GCM keys before transmission.
- **Triple-Option Authentication**:
  - **Phone OTP**: International E.164 normalization across 15+ regions, rate limiting, and 3-attempt brute-force lockout.
  - **Google OAuth / OpenID Connect**.
  - **Sign in with Apple**.
- **19 Bespoke Screens & Views**:
  - Splash, Onboarding, Phone OTP, Google/Apple Auth, Profile Setup, Chat List, Active Chat, Encrypted Attachments, WebRTC Calling, Safety Numbers, Settings, Privacy Controls, Linked Devices, Storage Shredder.

---

## 📁 Repository Structure

```
.
├── apps/
│   ├── backend/               # Node.js + Express + WebSocket Zero-Knowledge Relay
│   │   ├── src/
│   │   │   ├── config/        # Environment and security configuration
│   │   │   ├── db/            # Database engine with WAL mode and schema
│   │   │   ├── middleware/    # Auth verification, rate limiting, security headers
│   │   │   ├── modules/
│   │   │   │   ├── auth/      # Phone OTP, Google, Apple, Refresh Token Rotation
│   │   │   │   ├── devices/   # Public prekey bundle repository and device links
│   │   │   │   ├── messages/  # Ciphertext envelope relay & offline queue
│   │   │   │   ├── media/     # Encrypted binary blob storage and download
│   │   │   │   ├── privacy/   # Privacy settings, blocking, reporting
│   │   │   │   ├── retention/ # 7-day server retention janitor daemon
│   │   │   │   └── users/     # Profiles and presence
│   │   │   ├── websocket/     # Real-time WebSocket envelope dispatcher
│   │   │   ├── server.js      # Main backend entry point
│   │   │   └── worker.js      # Standalone retention janitor daemon
│   │   └── package.json
│   └── web/                   # Responsive Web Client & PWA
│       ├── public/
│       │   └── index.html     # Single-page application root
│       ├── src/
│       │   ├── css/           # Bespoke Titanium & Emerald Design System
│       │   ├── crypto/        # WebCrypto X3DH, Double Ratchet, Attachments
│       │   ├── storage/       # Encrypted IndexedDB vault & local retention shredder
│       │   ├── services/      # REST API, WebSocket client, WebRTC calling
│       │   ├── state/         # Central reactive store
│       │   └── ui/            # UI components and master app orchestrator
│       └── server.js          # Web client static server
├── packages/
│   └── protocol/              # Shared E.164 phone normalizer, schemas, fingerprints
├── tests/
│   ├── unit/
│   │   ├── crypto.test.js     # Signal X3DH, Double Ratchet, AEAD tamper tests
│   │   ├── auth.test.js       # E.164, OTP lockout, Google/Apple, Token rotation
│   │   └── retention.test.js  # 7-day retention janitor sweep and file shredding
│   ├── security/
│   │   └── plaintext-audit.test.js # Proof that plaintext is NEVER stored in backend
│   ├── lifecycle/
│   │   └── message-lifecycle.test.js # Create -> Encrypt -> Send -> Deliver -> Expire
│   └── runner.js              # Consolidated test runner
├── docs/                      # Full technical documentation
│   ├── ARCHITECTURE.md
│   ├── THREAT_MODEL.md
│   ├── CRYPTO_SPEC.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── PRIVACY.md
├── infrastructure/
│   ├── Dockerfile.backend
│   ├── Dockerfile.web
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 🚀 Quickstart

### 1. Run Unified Development Environment
```bash
# Starts Backend Relay (port 3001) and Web Client (port 3000)
node scripts/dev.js
```
Open `http://localhost:3000` in your web browser.

### 2. Execute Automated Test Suites
```bash
node tests/runner.js
```

### 3. Build & Package Android Application (`.apk`)

Aegis includes a native Android wrapper powered by **Capacitor**:

- **Prepare Mobile Assets & Sync Android Project**:
  ```bash
  npm run cap:sync
  ```
- **Option A — Build via Android Studio (Recommended)**:
  1. Open the [android/](file:///c:/Users/PUNIT%20KUMAR/Downloads/Punit's%20Project/android) folder in Android Studio.
  2. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
  3. Locate the compiled `.apk` in `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Option B — Build via Command Line (with JDK 17 & Android SDK)**:
  ```bash
  npm run build:apk
  ```
- **Option C — Automated Cloud Build (GitHub Actions)**:
  Push your repository to GitHub; the automated workflow at [.github/workflows/build-apk.yml](file:///c:/Users/PUNIT%20KUMAR/Downloads/Punit's%20Project/.github/workflows/build-apk.yml) will compile the `.apk` and attach it as a downloadable release artifact automatically.

- **Configuring Relay Server on Android**:
  On an Android device, `localhost` points to the phone. On the welcome screen, tap **"⚙️ Relay Server"** to set your host machine's Wi-Fi IP (e.g. `http://192.168.1.15:3001`) or a deployed relay server.

---

## 📋 Acceptance Criteria Checklist

- [x] **Google authentication works**
- [x] **Apple authentication works**
- [x] **Phone OTP works**
- [x] **International phone normalization works (E.164 standard)**
- [x] **User accounts work**
- [x] **Device management works**
- [x] **Real E2EE works (Signal-compatible X3DH + Double Ratchet)**
- [x] **Backend cannot decrypt message content (Zero-knowledge relay)**
- [x] **Encrypted attachments work (Client-side AES-GCM)**
- [x] **One-to-one messaging works**
- [x] **Offline delivery works (Encrypted envelope queue)**
- [x] **Seven-day expiration works (Automated Janitor)**
- [x] **Local data expiration works (IndexedDB shredder)**
- [x] **Privacy settings work (Last seen, read receipts, disappearing timer)**
- [x] **Notifications do not expose plaintext message contents**
- [x] **Security verification works (60-digit safety numbers & QR codes)**
- [x] **Account deletion works (Complete cryptographic purge)**
- [x] **Rate limiting works (Brute-force and abuse protection)**
- [x] **Automated tests exist (5 complete suites)**
- [x] **Security tests exist (Tamper detection, replay protection, token reuse)**
- [x] **Threat model exists (Formal 10-vector matrix)**
- [x] **Deployment configuration exists (Docker Compose + Nginx)**
- [x] **Documentation exists (Architecture, Crypto Spec, API, Threat Model)**
- [x] **No fake implementations remain**
- [x] **No plaintext secrets are hard-coded**
- [x] **No plaintext messages are stored server-side**
