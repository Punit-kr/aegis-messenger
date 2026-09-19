/**
 * Aegis Messenger - UI Component Templates & Screen Renderers
 * 19 Bespoke Screens and Functional Modal Views.
 */

export class UIComponents {
  // 1. Splash Screen
  static renderSplash() {
    return `
      <div class="fullscreen-view">
        <div class="brand-header" style="animation: fadeInScale 0.6s ease;">
          <div class="brand-logo">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <h1 class="brand-title">AEGIS</h1>
          <p class="brand-subtitle">End-to-End Encrypted Privacy Messenger</p>
          <div class="security-badge" style="margin-top: 12px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Zero-Knowledge Relay • Signal Protocol Compatible
          </div>
        </div>
      </div>
    `;
  }

  // 2. Welcome Screen
  static renderWelcome() {
    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <div class="brand-header">
            <div class="brand-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 class="brand-title">Aegis Messenger</h1>
            <p class="brand-subtitle">Maximum privacy. Zero metadata retention.</p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            <button class="btn btn-primary" id="btn-goto-phone">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              Continue with Phone Number
            </button>

            <div class="divider-row">or authenticate with</div>

            <button class="btn btn-oauth" id="btn-goto-google">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"/>
              </svg>
              Sign in with Google
            </button>

            <button class="btn btn-oauth" id="btn-goto-apple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.61 1.34-.55.63-1.03 1.66-.9 2.67 1.01.08 2.03-.51 2.59-1.16z"/>
              </svg>
              Sign in with Apple
            </button>
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 12px;">
            <button class="btn btn-ghost" id="btn-server-config" style="font-size: 12px; padding: 6px 12px; color: var(--text-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); width: 100%;">
              ⚙️ Relay Server: <span id="current-server-display">${typeof localStorage !== 'undefined' && localStorage.getItem('aegis_server_url') ? localStorage.getItem('aegis_server_url') : 'Auto (Default)'}</span>
            </button>
            <div style="font-size: 11px; text-align: center; color: var(--text-muted);">
              By signing in, you agree to Aegis's End-to-End Encrypted Terms & Privacy Notice.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Phone Login View
  static renderPhoneLogin(countries = []) {
    const options = countries.map(c => `
      <option value="${c.code}" ${c.code === '+1' ? 'selected' : ''}>
        ${c.flag} ${c.code} (${c.name})
      </option>
    `).join('');

    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <button class="icon-btn" id="btn-back-welcome" style="align-self: flex-start;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="brand-header">
            <h2 class="brand-title" style="font-size: 22px;">Phone Authentication</h2>
            <p class="brand-subtitle">Enter your international phone number to receive a verification OTP.</p>
          </div>

          <form id="form-phone-auth" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Country & Number</label>
              <div class="phone-input-row">
                <select class="country-select" id="select-country">
                  ${options}
                </select>
                <input type="tel" class="input-field" id="input-phone-number" placeholder="555 123 4567" required autocomplete="tel-national"/>
              </div>
              <div id="phone-normalized-preview" style="font-size: 12px; color: #34d399; font-family: var(--font-mono); min-height: 16px;"></div>
            </div>

            <div id="phone-error-msg" style="color: var(--status-error); font-size: 13px; display: none;"></div>

            <button type="submit" class="btn btn-primary" id="btn-request-otp">
              Send Secure OTP
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // 4. OTP Verification View
  static renderOtpVerify(phone, devCode = null) {
    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <button class="icon-btn" id="btn-back-phone" style="align-self: flex-start;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="brand-header">
            <h2 class="brand-title" style="font-size: 22px;">Verify Code</h2>
            <p class="brand-subtitle">Sent to <span style="color: var(--text-primary); font-family: var(--font-mono);">${phone}</span></p>
          </div>

          ${devCode ? `
            <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; color: #38bdf8; text-align: center;">
              <strong>Simulated Carrier SMS:</strong> Code is <span style="font-family: var(--font-mono); font-weight: 700;">${devCode}</span>
            </div>
          ` : ''}

          <div class="otp-container">
            <input type="text" maxlength="1" class="otp-box" data-index="0" autofocus/>
            <input type="text" maxlength="1" class="otp-box" data-index="1"/>
            <input type="text" maxlength="1" class="otp-box" data-index="2"/>
            <input type="text" maxlength="1" class="otp-box" data-index="3"/>
            <input type="text" maxlength="1" class="otp-box" data-index="4"/>
            <input type="text" maxlength="1" class="otp-box" data-index="5"/>
          </div>

          <div id="otp-error-msg" style="color: var(--status-error); font-size: 13px; text-align: center; display: none;"></div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span id="otp-countdown" style="color: var(--text-muted);">Expires in 05:00</span>
            <button class="btn btn-secondary" id="btn-resend-otp" style="padding: 6px 12px; font-size: 13px;" disabled>
              Resend Code
            </button>
          </div>

          <button class="btn btn-primary" id="btn-submit-otp" style="margin-top: 10px;">
            Verify & Secure Device
          </button>
        </div>
      </div>
    `;
  }

  // 5. Google Login Simulated/Direct Modal
  static renderGoogleAuth() {
    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <button class="icon-btn" id="btn-back-welcome-google" style="align-self: flex-start;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="brand-header">
            <h2 class="brand-title" style="font-size: 22px;">Google OpenID Connect</h2>
            <p class="brand-subtitle">Authenticate via Google Identity Services</p>
          </div>
          <form id="form-google-auth" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Google Account Email</label>
              <input type="email" class="input-field" id="input-google-email" placeholder="alice@gmail.com" required/>
            </div>
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" class="input-field" id="input-google-name" placeholder="Alice Smith" required/>
            </div>
            <button type="submit" class="btn btn-primary">
              Continue with Verified Token
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // 6. Apple Login Modal
  static renderAppleAuth() {
    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <button class="icon-btn" id="btn-back-welcome-apple" style="align-self: flex-start;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="brand-header">
            <h2 class="brand-title" style="font-size: 22px;">Sign in with Apple</h2>
            <p class="brand-subtitle">Authenticate with Apple ID and private relay</p>
          </div>
          <form id="form-apple-auth" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Apple ID / Hide My Email</label>
              <input type="email" class="input-field" id="input-apple-email" placeholder="alice@privaterelay.appleid.com" required/>
            </div>
            <div class="form-group">
              <label class="form-label">First Name</label>
              <input type="text" class="input-field" id="input-apple-name" placeholder="Alice" required/>
            </div>
            <button type="submit" class="btn btn-primary">
              Authorize Apple Token
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // 7. Profile Setup Screen
  static renderProfileSetup(user) {
    return `
      <div class="fullscreen-view">
        <div class="auth-card">
          <div class="brand-header">
            <h2 class="brand-title" style="font-size: 22px;">Profile Setup</h2>
            <p class="brand-subtitle">Choose your display name and encryption profile.</p>
          </div>
          <form id="form-profile-setup" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Your Name</label>
              <input type="text" class="input-field" id="input-profile-name" value="${user.displayName || ''}" required placeholder="e.g. Alice"/>
            </div>
            <div class="form-group">
              <label class="form-label">About Status</label>
              <input type="text" class="input-field" id="input-profile-about" value="${user.about || 'Hey there! I am using Aegis.'}" placeholder="Status"/>
            </div>
            <button type="submit" class="btn btn-primary">
              Complete Setup & Open Aegis
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // 8. Main Application Workspace (Sidebar + Active Chat Panel)
  static renderMainLayout(state) {
    const { user, chats, activeChatId, messages, typingUsers, onlineUsers } = state;
    const activeChat = chats.find(c => c.id === activeChatId) || null;
    const currentMsgs = activeChatId ? (messages[activeChatId] || []) : [];
    const isPeerOnline = activeChat ? !!onlineUsers[activeChat.peerUserId] : false;
    const isPeerTyping = activeChat ? !!typingUsers[activeChat.peerUserId] : false;

    return `
      <div class="aegis-layout ${activeChatId ? 'chat-open' : ''}">
        <!-- Sidebar Panel -->
        <div class="sidebar-panel">
          <div class="sidebar-header">
            <div class="user-avatar-badge" id="btn-open-profile">
              <div class="avatar">
                ${user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                <div class="status-indicator online"></div>
              </div>
              <div>
                <div style="font-weight: 600; font-size: 15px;">${user?.displayName || 'User'}</div>
                <div style="font-size: 12px; color: #34d399;">Active • Encrypted</div>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="icon-btn" id="btn-new-chat" title="New Encrypted Chat">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="8" x2="12" y2="14"></line>
                  <line x1="9" y1="11" x2="15" y2="11"></line>
                </svg>
              </button>
              <button class="icon-btn" id="btn-open-settings" title="Settings & Privacy">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="search-bar-wrap">
            <input type="text" class="search-input" id="input-search-chats" placeholder="Search conversations & verified contacts..."/>
          </div>

          <!-- Chat List -->
          <ul class="chat-list">
            ${chats.length === 0 ? `
              <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <div style="font-weight: 500; font-size: 15px; color: var(--text-secondary);">No conversations yet</div>
                <div style="font-size: 13px; margin-top: 4px;">Click the + button above to start an encrypted conversation.</div>
              </div>
            ` : chats.map(c => `
              <li class="chat-list-item ${c.id === activeChatId ? 'active' : ''}" data-chat-id="${c.id}">
                <div class="avatar">
                  ${c.displayName.charAt(0).toUpperCase()}
                  <div class="status-indicator ${onlineUsers[c.peerUserId] ? 'online' : ''}"></div>
                </div>
                <div class="chat-info">
                  <div class="chat-header-row">
                    <div class="chat-name">${c.displayName}</div>
                    <div class="chat-time">${c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                  <div class="chat-last-row">
                    <div class="chat-snippet">${typingUsers[c.peerUserId] ? '<span style="color: #34d399;">typing...</span>' : (c.lastMessage || 'Encrypted Message')}</div>
                    ${c.unreadCount > 0 ? `<div class="unread-badge">${c.unreadCount}</div>` : ''}
                  </div>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Chat Panel -->
        <div class="chat-panel">
          ${activeChat ? `
            <!-- Chat Top Bar -->
            <div class="chat-top-bar">
              <div style="display: flex; align-items: center; gap: 12px;">
                <button class="icon-btn" id="btn-back-to-chats" style="display: none;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <div class="chat-peer-info" id="btn-view-peer-profile">
                  <div class="avatar" style="width: 40px; height: 40px;">
                    ${activeChat.displayName.charAt(0).toUpperCase()}
                    <div class="status-indicator ${isPeerOnline ? 'online' : ''}"></div>
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 15px;">${activeChat.displayName}</div>
                    <div class="lock-pill">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      Signal Double Ratchet E2EE
                    </div>
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="icon-btn" id="btn-verify-safety-number" title="Verify 60-Digit Safety Number">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                </button>
                <button class="icon-btn" id="btn-start-audio-call" title="Encrypted Voice Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                </button>
                <button class="icon-btn" id="btn-start-video-call" title="Encrypted Video Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Messages Stream -->
            <div class="chat-stream" id="chat-messages-container">
              <div style="align-self: center; margin: 12px 0; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 8px 16px; border-radius: var(--radius-full); font-size: 12px; color: #34d399; display: flex; align-items: center; gap: 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Messages in this chat are end-to-end encrypted. No one outside this chat, not even Aegis, can read them.
              </div>

              ${currentMsgs.map(m => {
                const isOut = m.senderUserId === user?.id;
                return `
                  <div class="message-row ${isOut ? 'outgoing' : 'incoming'}" id="msg-${m.id}">
                    <div class="message-bubble">
                      ${m.replyToText ? `
                        <div style="background: rgba(0,0,0,0.2); border-left: 3px solid #34d399; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 6px; color: rgba(255,255,255,0.8);">
                          ${m.replyToText}
                        </div>
                      ` : ''}

                      ${m.attachment ? `
                        <div class="attachment-box" style="margin-bottom: 6px;">
                          ${m.attachment.mimeType.startsWith('image/') ? `
                            <img src="${m.attachment.objectUrl || ''}" alt="Attachment" style="max-width: 280px; border-radius: var(--radius-sm); display: block;" onerror="this.style.display='none'"/>
                          ` : m.attachment.mimeType.startsWith('audio/') ? `
                            <audio controls src="${m.attachment.objectUrl || ''}" style="max-width: 260px;"></audio>
                          ` : `
                            <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 6px;">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                              <span>${m.attachment.fileName || 'Encrypted File'}</span>
                            </div>
                          `}
                        </div>
                      ` : ''}

                      <div>${m.text || ''}</div>

                      <div class="msg-meta">
                        <span>${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ${isOut ? `
                          <span>
                            ${m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        ` : ''}
                      </div>
                    </div>

                    <div class="reaction-tray">
                      ${m.reactions ? Object.entries(m.reactions).map(([emoji, count]) => `
                        <div class="reaction-pill">${emoji} ${count}</div>
                      `).join('') : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Chat Input Bar -->
            <form class="chat-input-bar" id="form-chat-send">
              <input type="file" id="input-file-attach" style="display: none;"/>
              <button type="button" class="icon-btn" id="btn-attach-file" title="Send Encrypted Attachment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <textarea class="chat-textarea" id="input-chat-message" rows="1" placeholder="Type an encrypted message..."></textarea>

              <button type="button" class="icon-btn" id="btn-emoji-trigger" title="Add Emoji">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
              </button>

              <button type="submit" class="send-btn" id="btn-send-message" title="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          ` : `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--text-muted);">
              <div class="brand-logo" style="width: 80px; height: 80px;">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary);">Aegis Secure Workplace</h2>
              <p style="font-size: 14px; max-width: 320px; text-align: center;">
                Select a conversation from the sidebar or start a new encrypted chat to begin private communication.
              </p>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // 9. Safety Number & QR Verification Screen / Modal
  static renderSafetyNumberModal(peerUser, safetyNumberData) {
    const blocks = safetyNumberData.rawDigits.match(/.{1,5}/g) || [];

    return `
      <div class="modal-overlay">
        <div class="modal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 18px; font-weight: 600;">Verify Safety Number</h3>
            <button class="icon-btn" id="btn-close-modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            To verify that your communication with <strong style="color: var(--text-primary);">${peerUser.displayName}</strong> is end-to-end encrypted without any man-in-the-middle, compare the 60-digit safety number below or scan the QR code.
          </p>

          <div class="safety-number-grid">
            ${blocks.map(b => `<div class="fingerprint-block">${b}</div>`).join('')}
          </div>

          <div style="margin: 20px 0; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 600; font-size: 14px;">Mark as Verified</div>
              <div style="font-size: 12px; color: var(--text-muted);">You will receive an alert if their cryptographic keys change.</div>
            </div>
            <input type="checkbox" id="check-verified-peer" style="width: 20px; height: 20px; accent-color: var(--accent-primary); cursor: pointer;"/>
          </div>

          <button class="btn btn-primary" id="btn-done-verify" style="width: 100%;">
            Done
          </button>
        </div>
      </div>
    `;
  }

  // 10. Settings & Privacy Dashboard Modal
  static renderSettingsModal(state) {
    const { user, privacySettings } = state;

    return `
      <div class="modal-overlay">
        <div class="modal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="font-size: 18px; font-weight: 600;">Settings & Privacy</h3>
            <button class="icon-btn" id="btn-close-modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Section: Privacy Controls -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
              Privacy & Metadata Controls
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Last Seen Visibility</label>
              <select class="input-field" id="select-last-seen">
                <option value="everyone" ${privacySettings.last_seen_visibility === 'everyone' ? 'selected' : ''}>Everyone</option>
                <option value="contacts" ${privacySettings.last_seen_visibility === 'contacts' ? 'selected' : ''}>My Contacts</option>
                <option value="nobody" ${privacySettings.last_seen_visibility === 'nobody' ? 'selected' : ''}>Nobody (Maximum Privacy)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
              <div>
                <div style="font-size: 14px; font-weight: 500;">Read Receipts</div>
                <div style="font-size: 12px; color: var(--text-muted);">If turned off, you won't send or see read receipts.</div>
              </div>
              <input type="checkbox" id="toggle-read-receipts" ${privacySettings.read_receipts_enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);"/>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
              <div>
                <div style="font-size: 14px; font-weight: 500;">Typing Indicators</div>
                <div style="font-size: 12px; color: var(--text-muted);">Show when you are typing a message.</div>
              </div>
              <input type="checkbox" id="toggle-typing" ${privacySettings.typing_indicators_enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);"/>
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Default Disappearing Messages Timer</label>
              <select class="input-field" id="select-disappearing">
                <option value="0" ${privacySettings.disappearing_messages_default === 0 ? 'selected' : ''}>Off</option>
                <option value="86400" ${privacySettings.disappearing_messages_default === 86400 ? 'selected' : ''}>24 Hours</option>
                <option value="604800" ${privacySettings.disappearing_messages_default === 604800 ? 'selected' : ''}>7 Days</option>
                <option value="7776000" ${privacySettings.disappearing_messages_default === 7776000 ? 'selected' : ''}>90 Days</option>
              </select>
            </div>
          </div>

          <!-- Section: Device Security & Storage -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
              Device Security & Local Storage
            </div>

            <button class="btn btn-secondary" id="btn-open-linked-devices" style="width: 100%; justify-content: flex-start; margin-bottom: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Manage Linked Devices
            </button>

            <button class="btn btn-secondary" id="btn-wipe-local-cache" style="width: 100%; justify-content: flex-start; color: var(--status-warning);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Shred Local Message Cache & Temporary Data
            </button>
          </div>

          <!-- Section: Account Actions -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-secondary" id="btn-account-logout" style="width: 100%;">
              Log Out
            </button>

            <button class="btn" id="btn-account-delete" style="width: 100%; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">
              Permanently Delete Account
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 11. New Chat Modal
  static renderNewChatModal() {
    return `
      <div class="modal-overlay">
        <div class="modal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 18px; font-weight: 600;">Start New Encrypted Chat</h3>
            <button class="icon-btn" id="btn-close-modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <form id="form-lookup-contact" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Phone Number (with country code) or Email</label>
              <input type="text" class="input-field" id="input-contact-lookup" placeholder="+1 555 123 4567 or user@mail.com" required/>
            </div>

            <div id="lookup-result-box" style="display: none; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-do-lookup">
              Discover & Establish E2EE Session
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // 12. Active Call Floating Overlay
  static renderCallOverlay(call) {
    if (!call) return '';
    return `
      <div style="position: fixed; top: 24px; right: 24px; width: 340px; background: var(--bg-secondary); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); z-index: 300; padding: 20px; animation: slideUpFade 0.3s ease;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div class="avatar" style="width: 48px; height: 48px;">
            📞
          </div>
          <div>
            <div style="font-weight: 600; font-size: 16px;">${call.isVideo ? 'Video Call' : 'Voice Call'}</div>
            <div style="font-size: 13px; color: #34d399; text-transform: capitalize;">${call.status}...</div>
          </div>
        </div>

        <div style="display: flex; justify-content: center; gap: 16px;">
          ${call.status === 'ringing' ? `
            <button class="btn btn-primary" id="btn-call-accept" style="flex: 1;">
              Answer
            </button>
          ` : ''}
          <button class="btn" id="btn-call-hangup" style="flex: 1; background: #ef4444; color: #fff;">
            End Call
          </button>
        </div>
      </div>
    `;
  }
}
