# Aegis Formal Threat Model & Security Evaluation

This document outlines the formal threat model for Aegis, analyzing potential attack surfaces, deployed mitigations, and documented residual risks according to standard cybersecurity evaluation frameworks.

---

## Threat Matrix

### 1. Malicious Network Attacker (Man-in-the-Middle)
- **Attack Surface**: Public Wi-Fi, malicious ISP, routing/DNS interception, transport layer between client and relay.
- **Mitigation**:
  - Mandatory TLS 1.3 with strict cipher suites and HSTS (`Strict-Transport-Security`).
  - End-to-end encryption using Curve25519/ECDH P-256 keys, HKDF-SHA256, and authenticated AES-256-GCM.
  - Transport certificates verified by browser/native engine.
- **Residual Risk**: Network-level traffic analysis (packet sizes, message frequency, sender/recipient IP addresses) remains observable unless routed through an anonymous transport layer (e.g. Tor or VPN).

### 2. Compromised Relay / Malicious Server Operator
- **Attack Surface**: Host machine memory, database server access, filesystem storage, administrator privileges.
- **Mitigation**:
  - Zero-knowledge design: The backend receives and stores **zero private encryption keys** and **zero plaintext messages**.
  - Server stores only public pre-key bundles and encrypted ciphertext blobs.
  - Strict 7-day automatic server-side retention Janitor shreds temporary ciphertext envelopes and temporary attachments upon receipt or expiration.
- **Residual Risk**: A compromised server can view communication metadata (who sends messages to whom and when) and could attempt to return malicious pre-key bundles during initial contact discovery (mitigated by Safety Number verification).

### 3. Stolen Database Dump
- **Attack Surface**: Unauthorized backup download, SQL injection, physical server seizure.
- **Mitigation**:
  - Database schema contains NO plaintext message table.
  - Ephemeral message table stores only AES-GCM ciphertext envelopes awaiting delivery.
  - Auth tokens and OTPs are stored only as one-way cryptographic hashes (bcrypt with high work factor and SHA-256).
  - Prepared statements with parameterized queries prevent SQL injection across all database interactions.
- **Residual Risk**: Attacker can view user account metadata (user ID, registered phone/email, device names, creation timestamps).

### 4. Stolen Device / Physical Extraction
- **Attack Surface**: Lost, stolen, or seized client hardware (laptop, smartphone).
- **Mitigation**:
  - Local client database encrypted with AES-256-GCM.
  - Master vault encryption key derived from device credentials/passphrase using PBKDF2 (100,000 iterations).
  - Master key held in volatile memory only during active session and erased on app lock or logout.
  - Local message retention shredder purges expired messages and cached media.
- **Residual Risk**: If an unlocked device with an active session in memory is seized by a forensic examiner with cold-boot attack capabilities, in-memory keys may theoretically be dumped before power loss.

### 5. Malicious User / Contact Impersonation
- **Attack Surface**: An attacker impersonating a contact by claiming their phone number or replacing public keys.
- **Mitigation**:
  - Contact Safety Number verification: Deterministic 60-digit fingerprint (or QR code) derived via SHA-512 over sorted participant identity keys.
  - Key change warnings: The client records verified identity keys and alerts the user if a contact's public key changes.
- **Residual Risk**: Users who fail to compare safety numbers or ignore key change alerts may fall victim to server-assisted identity substitution.

### 6. Session Theft & Token Replay
- **Attack Surface**: Stolen access or refresh tokens from client memory or network interception.
- **Mitigation**:
  - Short-lived JWT access tokens (15-minute expiration).
  - Refresh token rotation on every exchange.
  - Token reuse detection: If an old refresh token is submitted, the server automatically invalidates all active sessions for that device.
- **Residual Risk**: Token theft during its 15-minute validity window can allow unauthorized API access before expiration or rotation.

### 7. Account Takeover / SIM-Swap Attack
- **Attack Surface**: Attacker convinces cellular carrier to port victim's phone number to an attacker-controlled SIM card to receive SMS OTP.
- **Mitigation**:
  - Strict OTP rate limiting, 5-minute expiration, and 3-attempt lockout.
  - Forward secrecy: Even if an attacker intercepts an SMS OTP and registers a new device, **they cannot decrypt past message history** because previous message keys were erased from the server and recipient devices.
  - When the attacker registers, a new device key is generated, which triggers a Safety Number change alert on all peer contacts.
- **Residual Risk**: Attacker can receive new messages sent after the SIM-swap until the legitimate owner recovers their line.

### 8. Malicious Attachments / Remote Code Execution
- **Attack Surface**: Weaponized media files (crafted images, videos, audio, documents) designed to exploit parser vulnerabilities.
- **Mitigation**:
  - Attachments are encrypted client-side using random AES-256-GCM keys before upload.
  - Server stores attachments as opaque binary blobs (`.enc`) without parsing or executing them.
  - Client decodes decrypted blobs in isolated memory buffers and uses sandboxed element rendering.
- **Residual Risk**: Zero-day buffer overflow vulnerabilities in OS-level image or audio decoders could theoretically be triggered upon client decryption.

### 9. Malicious Client Modification
- **Attack Surface**: Modifying client JavaScript or native runtime to disable encryption or exfiltrate plaintext.
- **Mitigation**:
  - Server enforces protocol schema validation on incoming envelopes.
  - Subresource integrity and strict Content Security Policy.
- **Residual Risk**: A compromised OS or rootkit with kernel-level memory access can intercept plaintext from the application process memory.
