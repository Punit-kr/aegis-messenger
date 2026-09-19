/**
 * Aegis Messenger - Master Client Application Controller
 * Connects UI Components, Signal Cryptography, Local Vault, and Real-Time WebSocket Relay.
 */

import { store } from '../state/store.js';
import { api, getApiBase } from '../services/api.js';
import { wsClient } from '../services/ws.js';
import { webrtc } from '../services/webrtc.js';
import { vault } from '../storage/vault.js';
import { UIComponents } from './components.js';
import { generateECDHKeyPair } from '../crypto/webcrypto.js';
import { X3DH } from '../crypto/x3dh.js';
import { DoubleRatchetSession } from '../crypto/ratchet.js';
import { EncryptedAttachmentManager } from '../crypto/attachments.js';
import { computeSafetyNumber } from '../../../../packages/protocol/fingerprint.js';
import { normalizePhoneNumber, COUNTRY_DATA } from '../../../../packages/protocol/e164.js';

export class AegisApp {
  constructor() {
    this.appEl = document.getElementById('app');
    this.countries = COUNTRY_DATA;
    this.currentOtpPhone = null;
    this.otpTimer = null;
    this.activeCall = null;

    // Subscribe to state changes for re-rendering
    store.subscribe((state) => this.render(state));

    // Listen for WebRTC call state changes
    webrtc.onStateChange((call) => {
      this.activeCall = call;
      this.render(store.getState());
    });
  }

  async init() {
    console.log('🛡️ Initializing Aegis Privacy Messenger...');

    try {
      // 1. Initialize local encrypted vault
      await vault.open();
      await vault.unlock('device-default-passphrase');

      // 2. Fetch country calling codes
      try {
        const countryRes = await api.getCountries();
        if (countryRes && countryRes.countries && countryRes.countries.length > 0) {
          this.countries = countryRes.countries;
        }
      } catch (e) {
        this.countries = COUNTRY_DATA;
      }

      // 3. Check authentication status
      if (api.accessToken) {
        try {
          const { user } = await api.getMe();
          const privacy = await api.getPrivacySettings();
          
          store.setState({
            user,
            privacySettings: privacy?.settings || {}
          });

          // Ensure device cryptographic identity exists locally and on server
          await this.initCryptographicKeys();

          // Connect WebSocket real-time relay
          wsClient.connect(api.accessToken);
          this.bindWebSocketEvents();

          // Fetch offline queued encrypted envelopes
          await this.syncOfflineMessages();

          store.setScreen('main');
          return;
        } catch (authErr) {
          console.warn('Session expired or invalid, directing to welcome screen:', authErr);
          api.clearTokens();
        }
      }

      // Default: show welcome onboarding
      store.setScreen('welcome');
    } catch (err) {
      console.error('Fatal initialization error:', err);
      store.setScreen('welcome');
    }
  }

  /**
   * Initialize or restore client cryptographic keys (IK, SPK, OPK pool)
   */
  async initCryptographicKeys() {
    let keys = await vault.getDecrypted('keystore', 'master_keys');
    if (!keys) {
      console.log('Generating fresh Signal-compatible cryptographic keypair bundle...');
      const identityKeyPair = await generateECDHKeyPair();
      const signedPrekeyPair = await generateECDHKeyPair();
      const registrationId = Math.floor(Math.random() * 65535) + 1;

      // Generate pool of 20 One-Time Prekeys (OPK)
      const oneTimePrekeys = [];
      const oneTimePrekeysMap = {};
      for (let i = 1; i <= 20; i++) {
        const opk = await generateECDHKeyPair();
        oneTimePrekeys.push({
          keyId: i,
          publicKey: opk.publicKeyBase64
        });
        oneTimePrekeysMap[i] = opk;
      }

      keys = {
        registrationId,
        identityKeyPair,
        signedPrekeyPair,
        oneTimePrekeysMap
      };

      // Save encrypted in local vault
      await vault.putEncrypted('keystore', { id: 'master_keys', ...keys });

      // Upload public keys bundle to server relay (private keys NEVER uploaded!)
      await api.uploadPrekeys({
        registrationId,
        identityKey: identityKeyPair.publicKeyBase64,
        signedPrekey: signedPrekeyPair.publicKeyBase64,
        signedPrekeyId: 1,
        signedPrekeySig: 'VALID_SIG_PLACEHOLDER_P256',
        oneTimePrekeys
      });
    }

    store.setState({ deviceKeys: keys });
  }

  /**
   * Fetch and decrypt offline queued envelopes
   */
  async syncOfflineMessages() {
    try {
      const { messages } = await api.fetchPendingMessages();
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`📥 Syncing ${messages.length} pending encrypted offline envelopes...`);
        const processedIds = [];

        for (const envelope of messages) {
          try {
            await this.processIncomingEnvelope(envelope);
            processedIds.push(envelope.id);
          } catch (e) {
            console.error('Failed to decrypt envelope:', e);
          }
        }

        if (processedIds.length > 0) {
          await api.ackMessages(processedIds);
        }
      }
    } catch (e) {
      console.warn('Offline sync error:', e);
    }
  }

  /**
   * Listen to real-time events over WebSocket
   */
  bindWebSocketEvents() {
    wsClient.on('envelope', async (envelope) => {
      await this.processIncomingEnvelope(envelope);
      if (envelope.id) {
        await api.ackMessages([envelope.id]);
      }
    });

    wsClient.on('typing', ({ senderUserId, isTyping }) => {
      store.setTyping(senderUserId, isTyping);
    });

    wsClient.on('receipt', ({ senderUserId, messageId, status }) => {
      const { chats, activeChatId } = store.getState();
      const chat = chats.find(c => c.peerUserId === senderUserId);
      if (chat) {
        store.updateMessageStatus(chat.id, messageId, status);
      }
    });
  }

  /**
   * Core End-to-End Decryption Pipeline
   */
  async processIncomingEnvelope(env) {
    const { senderUserId, senderDeviceId, envelopeType, encryptedEnvelope } = env;
    const { deviceKeys, ratchetSessions } = store.getState();

    let session = ratchetSessions[senderUserId];

    if (!session) {
      // Restore from local vault or establish via X3DH
      const storedSession = await vault.getDecrypted('ratchet_sessions', senderUserId);
      if (storedSession) {
        session = DoubleRatchetSession.fromJSON(storedSession);
      } else {
        // Initial session establishment from PreKeyWhisperMessage
        const masterSecret = await X3DH.receiveSession(
          deviceKeys,
          encryptedEnvelope.senderIdentityKey,
          encryptedEnvelope.ephemeralPublicKey,
          encryptedEnvelope.oneTimePreKeyId
        );

        session = await DoubleRatchetSession.initBob(
          masterSecret,
          deviceKeys.signedPrekeyPair,
          { peerUserId: senderUserId, peerDeviceId: senderDeviceId }
        );
      }
      ratchetSessions[senderUserId] = session;
    }

    // Decrypt the outer ciphertext using Double Ratchet
    const decryptedPayload = await session.decrypt(encryptedEnvelope);

    // Save advanced ratchet state to encrypted local vault
    await vault.putEncrypted('ratchet_sessions', { peerUserId: senderUserId, ...session.toJSON() }, 'peerUserId');

    // If attachment present, decrypt file blob in browser memory
    let attachmentObj = null;
    if (decryptedPayload.attachment) {
      const attInfo = decryptedPayload.attachment;
      try {
        const cipherBuffer = await api.downloadAttachment(attInfo.attachmentId);
        const { objectUrl, decryptedBlob } = await EncryptedAttachmentManager.decryptFile(
          cipherBuffer,
          attInfo.key,
          attInfo.iv,
          attInfo.sha256,
          attInfo.mimeType
        );

        attachmentObj = {
          ...attInfo,
          objectUrl
        };
      } catch (err) {
        console.error('Attachment decryption error:', err);
      }
    }

    const messageRecord = {
      id: decryptedPayload.id || env.id,
      senderUserId,
      peerUserId: senderUserId,
      peerDisplayName: decryptedPayload.senderName || 'Contact',
      text: decryptedPayload.text,
      attachment: attachmentObj,
      timestamp: decryptedPayload.timestamp || Date.now(),
      status: 'read'
    };

    // Store in encrypted local vault
    await vault.putEncrypted('messages', {
      ...messageRecord,
      chatId: senderUserId,
      expiresAt: decryptedPayload.disappearingAfterSeconds > 0 
        ? Date.now() + (decryptedPayload.disappearingAfterSeconds * 1000) 
        : 0
    });

    // Update reactive application state
    store.addMessage(senderUserId, messageRecord);

    // Send read receipt if enabled
    const privacy = store.getState().privacySettings;
    if (privacy.read_receipts_enabled !== false) {
      wsClient.sendReceipt(senderUserId, messageRecord.id, 'read');
    }
  }

  /**
   * Core End-to-End Encryption & Transmission Pipeline
   */
  async sendMessage(text, attachment = null) {
    const { activeChatId, chats, user, deviceKeys, ratchetSessions } = store.getState();
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    const recipientUserId = chat.peerUserId;
    let session = ratchetSessions[recipientUserId];

    let isNewSession = false;
    let x3dhData = null;

    if (!session) {
      // Check stored session
      const stored = await vault.getDecrypted('ratchet_sessions', recipientUserId);
      if (stored) {
        session = DoubleRatchetSession.fromJSON(stored);
      } else {
        // Fetch recipient's public prekey bundles from server relay
        const { bundles } = await api.getUserKeys(recipientUserId);
        if (!bundles || bundles.length === 0) {
          throw new Error('Recipient has no registered devices or keys');
        }

        const targetBundle = bundles[0]; // Primary device bundle
        x3dhData = await X3DH.initiateSession(deviceKeys.identityKeyPair, targetBundle);

        session = await DoubleRatchetSession.initAlice(
          x3dhData.sharedMasterKey,
          targetBundle.signedPrekey,
          { peerUserId: recipientUserId, peerDeviceId: targetBundle.deviceId }
        );
        isNewSession = true;
      }
      ratchetSessions[recipientUserId] = session;
    }

    // Prepare attachment encryption if file is attached
    let encryptedAttachmentPayload = null;
    if (attachment) {
      const { ciphertextBlob, keyBase64, ivBase64, sha256Hex, mimeType, fileSize, fileName } = 
        await EncryptedAttachmentManager.encryptFile(attachment);
      
      const uploadRes = await api.uploadAttachment(ciphertextBlob);

      encryptedAttachmentPayload = {
        attachmentId: uploadRes.attachmentId,
        mimeType,
        fileName,
        fileSize,
        key: keyBase64,
        iv: ivBase64,
        sha256: sha256Hex,
        objectUrl: URL.createObjectURL(attachment)
      };
    }

    const messageId = crypto.randomUUID();
    const timestamp = Date.now();
    const disappearingSeconds = store.getState().privacySettings.disappearing_messages_default || 0;

    const innerPayload = {
      id: messageId,
      senderUserId: user.id,
      senderName: user.displayName,
      text: text || '',
      attachment: encryptedAttachmentPayload ? {
        attachmentId: encryptedAttachmentPayload.attachmentId,
        mimeType: encryptedAttachmentPayload.mimeType,
        fileName: encryptedAttachmentPayload.fileName,
        fileSize: encryptedAttachmentPayload.fileSize,
        key: encryptedAttachmentPayload.key,
        iv: encryptedAttachmentPayload.iv,
        sha256: encryptedAttachmentPayload.sha256
      } : null,
      timestamp,
      disappearingAfterSeconds: disappearingSeconds
    };

    // Encrypt inner message payload using Double Ratchet
    const ratchetResult = await session.encrypt(innerPayload);

    // Save updated ratchet state to encrypted vault
    await vault.putEncrypted('ratchet_sessions', { peerUserId: recipientUserId, ...session.toJSON() }, 'peerUserId');

    // Build the outer transmission envelope
    const envelope = {
      recipientUserId,
      recipientDeviceId: session.peerDeviceId,
      envelopeType: isNewSession ? 1 : 2,
      encryptedEnvelope: {
        ...ratchetResult,
        senderIdentityKey: isNewSession ? deviceKeys.identityKeyPair.publicKeyBase64 : undefined,
        ephemeralPublicKey: isNewSession ? x3dhData.ephemeralPublicKeyBase64 : undefined,
        oneTimePreKeyId: isNewSession ? x3dhData.oneTimePreKeyId : undefined
      }
    };

    // Send through zero-knowledge relay
    await api.sendEnvelopes([envelope]);

    // Save to local decrypted vault
    const localMsg = {
      id: messageId,
      senderUserId: user.id,
      peerUserId: recipientUserId,
      text,
      attachment: encryptedAttachmentPayload,
      timestamp,
      status: 'sent'
    };

    await vault.putEncrypted('messages', {
      ...localMsg,
      chatId: activeChatId,
      expiresAt: disappearingSeconds > 0 ? timestamp + (disappearingSeconds * 1000) : 0
    });

    store.addMessage(activeChatId, localMsg);
  }

  /**
   * Render active screen based on state
   */
  render(state) {
    const { currentScreen, activeModal } = state;
    let html = '';

    switch (currentScreen) {
      case 'splash':
        html = UIComponents.renderSplash();
        break;
      case 'welcome':
        html = UIComponents.renderWelcome();
        break;
      case 'phone_login':
        html = UIComponents.renderPhoneLogin(this.countries);
        break;
      case 'otp_verify':
        html = UIComponents.renderOtpVerify(this.currentOtpPhone, this.lastDevCode);
        break;
      case 'google_login':
        html = UIComponents.renderGoogleAuth();
        break;
      case 'apple_login':
        html = UIComponents.renderAppleAuth();
        break;
      case 'profile_setup':
        html = UIComponents.renderProfileSetup(state.user || {});
        break;
      case 'main':
      default:
        html = UIComponents.renderMainLayout(state);
        break;
    }

    // Modals
    if (activeModal === 'safety_number') {
      const chat = state.chats.find(c => c.id === state.activeChatId);
      html += UIComponents.renderSafetyNumberModal(chat, this.currentSafetyNumberData);
    } else if (activeModal === 'settings') {
      html += UIComponents.renderSettingsModal(state);
    } else if (activeModal === 'new_chat') {
      html += UIComponents.renderNewChatModal();
    }

    // Call Overlay
    if (this.activeCall) {
      html += UIComponents.renderCallOverlay(this.activeCall);
    }

    this.appEl.innerHTML = html;
    this.bindEvents(state);
  }

  /**
   * Bind DOM event handlers
   */
  bindEvents(state) {
    // Welcome screen transitions
    const btnPhone = document.getElementById('btn-goto-phone');
    if (btnPhone) btnPhone.onclick = () => store.setScreen('phone_login');

    const btnGoogle = document.getElementById('btn-goto-google');
    if (btnGoogle) btnGoogle.onclick = () => store.setScreen('google_login');

    const btnApple = document.getElementById('btn-goto-apple');
    if (btnApple) btnApple.onclick = () => store.setScreen('apple_login');

    // Server configuration button
    const btnServerConfig = document.getElementById('btn-server-config');
    if (btnServerConfig) {
      btnServerConfig.onclick = () => {
        const cur = localStorage.getItem('aegis_server_url') || getApiBase();
        const input = prompt(
          'Enter Aegis Relay Server URL:\n(e.g., http://192.168.1.33:3001 for local Wi-Fi / LAN, or http://10.0.2.2:3001 for Android Emulator):\nLeave blank or type "default" for automatic detection.',
          cur
        );
        if (input !== null) {
          const val = input.trim();
          if (val === '' || val.toLowerCase() === 'default') {
            localStorage.removeItem('aegis_server_url');
          } else {
            localStorage.setItem('aegis_server_url', val.replace(/\/$/, ''));
          }
          window.location.reload();
        }
      };
    }

    // Back to welcome
    const btnBackWel = document.getElementById('btn-back-welcome') || 
                       document.getElementById('btn-back-welcome-google') || 
                       document.getElementById('btn-back-welcome-apple');
    if (btnBackWel) btnBackWel.onclick = () => store.setScreen('welcome');

    // Phone auth form
    const formPhone = document.getElementById('form-phone-auth');
    if (formPhone) {
      const phoneInput = document.getElementById('input-phone-number');
      const countrySelect = document.getElementById('select-country');
      const preview = document.getElementById('phone-normalized-preview');
      const errorMsg = document.getElementById('phone-error-msg');

      const updatePreview = () => {
        const full = `${countrySelect.value} ${phoneInput.value}`;
        const norm = normalizePhoneNumber(full);
        if (norm.valid) {
          preview.textContent = `Canonical E.164: ${norm.e164}`;
          errorMsg.style.display = 'none';
        } else {
          preview.textContent = '';
        }
      };

      phoneInput.oninput = updatePreview;
      countrySelect.onchange = updatePreview;

      formPhone.onsubmit = async (e) => {
        e.preventDefault();
        const full = `${countrySelect.value} ${phoneInput.value}`;
        const norm = normalizePhoneNumber(full);
        if (!norm.valid) {
          errorMsg.textContent = norm.error || 'Invalid phone number';
          errorMsg.style.display = 'block';
          return;
        }

        try {
          const res = await api.requestOtp(norm.e164);
          this.currentOtpPhone = norm.e164;
          this.lastDevCode = res.devCode;
          store.setScreen('otp_verify');
        } catch (err) {
          errorMsg.textContent = err.message;
          errorMsg.style.display = 'block';
        }
      };
    }

    // OTP Verification
    const btnBackPhone = document.getElementById('btn-back-phone');
    if (btnBackPhone) btnBackPhone.onclick = () => store.setScreen('phone_login');

    const otpBoxes = document.querySelectorAll('.otp-box');
    if (otpBoxes.length === 6) {
      otpBoxes.forEach((box, idx) => {
        box.oninput = (e) => {
          if (box.value.length === 1 && idx < 5) {
            otpBoxes[idx + 1].focus();
          }
        };
        box.onkeydown = (e) => {
          if (e.key === 'Backspace' && !box.value && idx > 0) {
            otpBoxes[idx - 1].focus();
          }
        };
      });

      // Auto-fill dev code if available for friction-free UX
      if (this.lastDevCode && this.lastDevCode.length === 6) {
        this.lastDevCode.split('').forEach((digit, i) => {
          if (otpBoxes[i]) otpBoxes[i].value = digit;
        });
      }

      const btnSubmitOtp = document.getElementById('btn-submit-otp');
      if (btnSubmitOtp) {
        btnSubmitOtp.onclick = async () => {
          const otp = Array.from(otpBoxes).map(b => b.value).join('');
          const errBox = document.getElementById('otp-error-msg');
          if (otp.length < 6) {
            errBox.textContent = 'Please enter all 6 digits';
            errBox.style.display = 'block';
            return;
          }

          try {
            const res = await api.verifyOtp(this.currentOtpPhone, otp, {
              deviceName: 'Web Browser Client',
              platform: 'web'
            });

            api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
            store.setState({ user: res.user, device: res.device, privacySettings: res.privacy });

            await this.initCryptographicKeys();
            wsClient.connect(res.tokens.accessToken);
            this.bindWebSocketEvents();

            store.setScreen('profile_setup');
          } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
          }
        };
      }
    }

    // Google Auth Form
    const formGoogle = document.getElementById('form-google-auth');
    if (formGoogle) {
      formGoogle.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('input-google-email').value;
        const name = document.getElementById('input-google-name').value;
        try {
          const res = await api.googleAuth('mock-google-id-token', { email, name }, { deviceName: 'Web Browser', platform: 'web' });
          api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
          store.setState({ user: res.user, device: res.device, privacySettings: res.privacy });
          await this.initCryptographicKeys();
          wsClient.connect(res.tokens.accessToken);
          this.bindWebSocketEvents();
          store.setScreen('main');
        } catch (err) {
          alert(err.message);
        }
      };
    }

    // Apple Auth Form
    const formApple = document.getElementById('form-apple-auth');
    if (formApple) {
      formApple.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('input-apple-email').value;
        const name = document.getElementById('input-apple-name').value;
        try {
          const res = await api.appleAuth('mock-apple-id-token', { email, name: { firstName: name } }, { deviceName: 'Web Browser', platform: 'web' });
          api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
          store.setState({ user: res.user, device: res.device, privacySettings: res.privacy });
          await this.initCryptographicKeys();
          wsClient.connect(res.tokens.accessToken);
          this.bindWebSocketEvents();
          store.setScreen('main');
        } catch (err) {
          alert(err.message);
        }
      };
    }

    // Profile Setup Form
    const formProfile = document.getElementById('form-profile-setup');
    if (formProfile) {
      formProfile.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('input-profile-name').value;
        const about = document.getElementById('input-profile-about').value;
        try {
          const res = await api.updateMe({ displayName: name, about });
          store.setState({ user: res.user });
          store.setScreen('main');
        } catch (err) {
          alert(err.message);
        }
      };
    }

    // Main Workspace Events
    const btnNewChat = document.getElementById('btn-new-chat');
    if (btnNewChat) btnNewChat.onclick = () => store.setModal('new_chat');

    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) btnSettings.onclick = () => store.setModal('settings');

    // Chat list items click
    const chatItems = document.querySelectorAll('.chat-list-item');
    chatItems.forEach(item => {
      item.onclick = async () => {
        const chatId = item.dataset.chatId;
        store.setActiveChat(chatId);
        // Load messages from vault
        const msgs = await vault.getMessagesForChat(chatId);
        store.setState({
          messages: { ...store.getState().messages, [chatId]: msgs }
        });
      };
    });

    // Chat Message Send Form
    const formChatSend = document.getElementById('form-chat-send');
    if (formChatSend) {
      const textarea = document.getElementById('input-chat-message');
      const fileInput = document.getElementById('input-file-attach');
      const attachBtn = document.getElementById('btn-attach-file');

      if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = async () => {
          if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            await this.sendMessage('', file);
            fileInput.value = '';
          }
        };
      }

      // Typing indicator emit
      let typingTimeout = null;
      textarea.oninput = () => {
        const activeChat = store.getState().chats.find(c => c.id === store.getState().activeChatId);
        if (activeChat) {
          wsClient.sendTyping(activeChat.peerUserId, true);
          if (typingTimeout) clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            wsClient.sendTyping(activeChat.peerUserId, false);
          }, 2000);
        }
      };

      formChatSend.onsubmit = async (e) => {
        e.preventDefault();
        const text = textarea.value.trim();
        if (!text) return;
        textarea.value = '';
        try {
          await this.sendMessage(text);
          const activeChat = store.getState().chats.find(c => c.id === store.getState().activeChatId);
          if (activeChat) wsClient.sendTyping(activeChat.peerUserId, false);
        } catch (err) {
          alert('Encryption/Transmission failed: ' + err.message);
        }
      };
    }

    // Safety Number Verification Button
    const btnVerifySafety = document.getElementById('btn-verify-safety-number');
    if (btnVerifySafety) {
      btnVerifySafety.onclick = async () => {
        const activeChat = store.getState().chats.find(c => c.id === store.getState().activeChatId);
        const { deviceKeys } = store.getState();
        if (!activeChat || !deviceKeys) return;

        // Fetch peer public keys
        const { bundles } = await api.getUserKeys(activeChat.peerUserId);
        if (bundles && bundles.length > 0) {
          const peerIK = bundles[0].identityKey;
          const ourIK = deviceKeys.identityKeyPair.publicKeyBase64;
          this.currentSafetyNumberData = await computeSafetyNumber(ourIK, peerIK, store.getState().user.id, activeChat.peerUserId);
          store.setModal('safety_number');
        }
      };
    }

    // Audio & Video Call Buttons
    const btnVoiceCall = document.getElementById('btn-start-audio-call');
    if (btnVoiceCall) {
      btnVoiceCall.onclick = async () => {
        const activeChat = store.getState().chats.find(c => c.id === store.getState().activeChatId);
        if (activeChat) {
          await webrtc.startCall(activeChat.peerUserId, false);
        }
      };
    }

    const btnVideoCall = document.getElementById('btn-start-video-call');
    if (btnVideoCall) {
      btnVideoCall.onclick = async () => {
        const activeChat = store.getState().chats.find(c => c.id === store.getState().activeChatId);
        if (activeChat) {
          await webrtc.startCall(activeChat.peerUserId, true);
        }
      };
    }

    // Active Call Overlay Controls
    const btnCallAccept = document.getElementById('btn-call-accept');
    if (btnCallAccept) btnCallAccept.onclick = () => webrtc.acceptCall();

    const btnCallHangup = document.getElementById('btn-call-hangup');
    if (btnCallHangup) btnCallHangup.onclick = () => webrtc.endCall();

    // Close Modal Button
    const btnCloseModal = document.getElementById('btn-close-modal') || document.getElementById('btn-done-verify');
    if (btnCloseModal) btnCloseModal.onclick = () => store.setModal(null);

    // New Chat Form Lookup
    const formLookup = document.getElementById('form-lookup-contact');
    if (formLookup) {
      formLookup.onsubmit = async (e) => {
        e.preventDefault();
        const query = document.getElementById('input-contact-lookup').value.trim();
        const resultBox = document.getElementById('lookup-result-box');

        try {
          const isEmail = query.includes('@');
          const lookupParams = isEmail ? { email: query } : { phone: query };
          const { user: peer } = await api.lookupContact(lookupParams);

          resultBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">${peer.display_name}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${peer.phone || peer.email}</div>
              </div>
              <button class="btn btn-primary" id="btn-start-chat-with-user" style="padding: 6px 14px; font-size: 13px;">
                Chat Now
              </button>
            </div>
          `;
          resultBox.style.display = 'block';

          document.getElementById('btn-start-chat-with-user').onclick = () => {
            store.setActiveChat(peer.id);
            store.setModal(null);
          };
        } catch (err) {
          resultBox.innerHTML = `<span style="color: var(--status-error);">${err.message}</span>`;
          resultBox.style.display = 'block';
        }
      };
    }

    // Privacy & Settings toggles
    const selectLastSeen = document.getElementById('select-last-seen');
    if (selectLastSeen) {
      selectLastSeen.onchange = async () => {
        await api.updateSettings({ last_seen_visibility: selectLastSeen.value });
      };
    }

    const toggleRead = document.getElementById('toggle-read-receipts');
    if (toggleRead) {
      toggleRead.onchange = async () => {
        await api.updateSettings({ read_receipts_enabled: toggleRead.checked });
      };
    }

    const toggleTyping = document.getElementById('toggle-typing');
    if (toggleTyping) {
      toggleTyping.onchange = async () => {
        await api.updateSettings({ typing_indicators_enabled: toggleTyping.checked });
      };
    }

    const selectDisappearing = document.getElementById('select-disappearing');
    if (selectDisappearing) {
      selectDisappearing.onchange = async () => {
        await api.updateSettings({ disappearing_messages_default: Number(selectDisappearing.value) });
      };
    }

    const btnWipe = document.getElementById('btn-wipe-local-cache');
    if (btnWipe) {
      btnWipe.onclick = async () => {
        if (confirm('Are you sure you want to permanently shred all local messages and cached attachments?')) {
          await vault.wipeAll();
          alert('Local encrypted storage shredded successfully.');
          window.location.reload();
        }
      };
    }

    const btnLogout = document.getElementById('btn-account-logout');
    if (btnLogout) {
      btnLogout.onclick = async () => {
        try { await api.logout(); } catch (e) {}
        api.clearTokens();
        await vault.wipeAll();
        store.setScreen('welcome');
        store.setModal(null);
      };
    }

    const btnDelete = document.getElementById('btn-account-delete');
    if (btnDelete) {
      btnDelete.onclick = async () => {
        if (confirm('PERMANENT ACTION: Are you sure you want to delete your entire Aegis account and all server records?')) {
          try {
            await api.deleteAccount();
            api.clearTokens();
            await vault.wipeAll();
            alert('Account and all server keys destroyed.');
            window.location.reload();
          } catch (err) {
            alert(err.message);
          }
        }
      };
    }
  }
}

// Instantiate and start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.aegis = new AegisApp();
  window.aegis.init();
});
