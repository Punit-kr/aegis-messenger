# Aegis REST & WebSocket API Specification

Base URL: `http://localhost:3001` or `https://relay.yourdomain.com`

All endpoints requiring authentication must supply a valid Bearer JWT:
`Authorization: Bearer <access_token>`

---

## 1. Authentication Endpoints

### `GET /api/auth/countries`
Returns supported international country calling codes, flags, and national number lengths.

### `POST /api/auth/otp/request`
Request an international phone OTP.
- **Request Body**: `{ "phone": "+1 415 555 2671" }`
- **Response**: `{ "success": true, "phone": "+14155552671", "expiresInSeconds": 300 }`

### `POST /api/auth/otp/verify`
Verify 6-digit phone OTP and establish/register device.
- **Request Body**:
  ```json
  {
    "phone": "+14155552671",
    "otp": "492815",
    "deviceInfo": { "deviceName": "Chrome on Linux", "platform": "web" }
  }
  ```
- **Response**: User object, device record, privacy settings, and access/refresh tokens.

### `POST /api/auth/google`
Authenticate using Google OAuth/OpenID Connect ID token.
- **Request Body**: `{ "idToken": "...", "profile": { "email": "...", "name": "..." }, "deviceInfo": { ... } }`

### `POST /api/auth/apple`
Authenticate using Sign in with Apple identity token.
- **Request Body**: `{ "identityToken": "...", "userInfo": { ... }, "deviceInfo": { ... } }`

### `POST /api/auth/refresh`
Rotate refresh token and receive a fresh short-lived access token.
- **Request Body**: `{ "refreshToken": "<session_id>:<secret>" }`

### `POST /api/auth/logout` *(Auth Required)*
Revoke current device session.

### `DELETE /api/auth/account` *(Auth Required)*
Permanently shred entire account and associated cryptographic keys from the server.

---

## 2. Devices & Pre-Key Endpoints

### `POST /api/devices/keys` *(Auth Required)*
Upload or rotate public pre-key bundle for the authenticated device.
- **Request Body**:
  ```json
  {
    "registrationId": 12345,
    "identityKey": "<base64_public_key>",
    "signedPrekey": "<base64_public_key>",
    "signedPrekeyId": 1,
    "signedPrekeySig": "<base64_signature>",
    "oneTimePrekeys": [
      { "keyId": 1, "publicKey": "<base64>" },
      { "keyId": 2, "publicKey": "<base64>" }
    ]
  }
  ```

### `GET /api/devices/user/:userId/keys` *(Auth Required)*
Fetch pre-key bundles for all active devices of a recipient contact. Atomically consumes one OPK per device.

### `GET /api/devices/lookup?phone=...&email=...` *(Auth Required)*
Privacy-preserving contact lookup.

### `GET /api/devices/linked` *(Auth Required)*
List all linked devices for the calling user.

### `POST /api/devices/:deviceId/revoke` *(Auth Required)*
Revoke a linked device.

---

## 3. Encrypted Message Relay Endpoints

### `POST /api/messages/send` *(Auth Required)*
Relay encrypted envelopes to recipient devices.
- **Request Body**:
  ```json
  {
    "envelopes": [
      {
        "id": "uuid",
        "recipientUserId": "user-uuid",
        "recipientDeviceId": "device-uuid",
        "envelopeType": 2,
        "encryptedEnvelope": { "header": { ... }, "ciphertext": "...", "iv": "..." }
      }
    ]
  }
  ```

### `GET /api/messages/pending` *(Auth Required)*
Fetch queued offline encrypted envelopes for the calling device.

### `POST /api/messages/ack` *(Auth Required)*
Acknowledge delivery of messages, triggering server-side deletion.
- **Request Body**: `{ "messageIds": ["uuid1", "uuid2"] }`

---

## 4. Encrypted Attachment Relay Endpoints

### `POST /api/media/upload` *(Auth Required)*
Upload an encrypted binary media blob (up to 50MB).
- **Multipart Form Data**: `ciphertextBlob` (binary file)
- **Response**: `{ "attachmentId": "uuid", "fileSize": 1048576, "sha256": "...", "expiresAt": 1720000000000 }`

### `GET /api/media/:attachmentId` *(Auth Required)*
Download encrypted binary media blob if within 7-day retention period.

---

## 5. Privacy Endpoints

### `GET /api/privacy/settings` *(Auth Required)*
### `PUT /api/privacy/settings` *(Auth Required)*
Update last seen visibility, read receipts, typing status, and disappearing message defaults.

### `POST /api/privacy/block` *(Auth Required)*
### `POST /api/privacy/unblock` *(Auth Required)*
### `POST /api/privacy/report` *(Auth Required)*

---

## 6. Real-Time WebSocket Protocol

Path: `/ws?token=<access_token>`

### Frame Types:
- **`ENVELOPE`**: Instant delivery of incoming encrypted message envelope.
- **`TYPING`**: `{ "recipientUserId": "...", "isTyping": true|false }`
- **`RECEIPT`**: `{ "messageId": "...", "recipientUserId": "...", "status": "delivered"|"read" }`
- **`CALL_SIGNAL`**: Peer-to-peer WebRTC offer/answer/ICE candidate signaling.
- **`PING` / `PONG`**: Connection liveness heartbeat.
