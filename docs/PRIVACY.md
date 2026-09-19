# Aegis Privacy Architecture & Third-Party Disclosure

Aegis is engineered to collect and store the absolute minimum amount of data required to facilitate private communication.

---

## 1. Zero-Knowledge Principles

1. **Message Content**:
   - The server **NEVER** receives, parses, or stores plaintext message bodies.
   - All messages are encrypted locally using AES-256-GCM before transport.
   - Decryption keys exist **only** on participant client devices.

2. **Private Keys**:
   - The server **NEVER** generates, transmits, or holds private encryption keys.
   - Device identity keys and ratchet keys are stored exclusively in the client's encrypted local vault.

3. **Retention Cap**:
   - Undelivered message envelopes are held for a **maximum of 7 days**.
   - As soon as a message is delivered and acknowledged, it is purged from the relay.
   - The server retention janitor daemon enforces automated deletion of all temporary data.

---

## 2. Contact Discovery Architecture

Traditional messengers often upload a user's entire address book to their servers. Aegis refuses this approach:
- **No Address Book Upload**: Aegis never requests or uploads the user's full phonebook.
- **Explicit Targeted Lookups**: When adding a contact, the client looks up only the single targeted phone number (normalized to canonical E.164) or email.
- **Cryptographic Blind Matching**: Lookups can be queried via salted SHA-256 prefixes to prevent the server from learning complete telephone numbers during discovery.

---

## 3. Third-Party Service Disclosure

| Service | Data Transferred | Purpose | Retention |
|---|---|---|---|
| **Carrier / SMS Gateway** (e.g. Twilio) | Recipient phone number, 6-digit OTP code | Initial phone verification | Retained by carrier according to telecommunication laws (typically 30–90 days). |
| **Google** (Optional Auth) | Google OAuth Token | Account authentication | Governed by Google's Privacy Policy. |
| **Apple** (Optional Auth) | Apple Identity Token | Account authentication | Governed by Apple's Privacy Policy. |
| **STUN / TURN Relays** | Client IP address, UDP port | Peer-to-peer WebRTC voice/video calling NAT traversal | Ephemeral packet routing. No call audio or video is recorded or stored. |
