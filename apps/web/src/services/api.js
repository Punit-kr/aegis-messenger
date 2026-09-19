/**
 * Aegis Client API Service
 * Handles authenticated HTTP requests, token rotation, and error management.
 */

export function getApiBase() {
  if (typeof window !== 'undefined' && window.AEGIS_SERVER_URL) {
    return window.AEGIS_SERVER_URL.replace(/\/$/, '');
  }
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('aegis_server_url') : null;
  if (custom) return custom.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location) {
    if (window.location.origin.includes(':5173') || window.location.origin.includes(':3000')) {
      return 'http://127.0.0.1:3001';
    }
    // Capacitor / file-based mobile runtime fallback
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
      return 'http://10.0.2.2:3001';
    }
  }
  return '';
}

export const API_BASE = getApiBase();

export class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('aegis_access_token') || null;
    this.refreshToken = localStorage.getItem('aegis_refresh_token') || null;
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) localStorage.setItem('aegis_access_token', accessToken);
    if (refreshToken) localStorage.setItem('aegis_refresh_token', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('aegis_access_token');
    localStorage.removeItem('aegis_refresh_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...options.headers };

    if (this.accessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url, { ...options, headers });

    // Handle token expiration & automatic rotation
    if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/refresh')) {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken })
        });

        if (refreshRes.ok) {
          const { accessToken, refreshToken } = await refreshRes.json();
          this.setTokens(accessToken, refreshToken);
          headers['Authorization'] = `Bearer ${accessToken}`;
          response = await fetch(url, { ...options, headers });
        } else {
          this.clearTokens();
          window.dispatchEvent(new CustomEvent('aegis:auth_expired'));
        }
      } catch (e) {
        this.clearTokens();
      }
    }

    if (!response.ok) {
      let errMessage = 'Request failed';
      try {
        const errJson = await response.json();
        errMessage = errJson.error || errMessage;
      } catch (e) {}
      throw new Error(errMessage);
    }

    // For file downloads
    if (options.asBlob) {
      return response.blob();
    }
    if (options.asArrayBuffer) {
      return response.arrayBuffer();
    }

    return response.json();
  }

  // Auth
  getCountries() {
    return this.request('/api/auth/countries');
  }

  requestOtp(phone) {
    return this.request('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  }

  verifyOtp(phone, otp, deviceInfo) {
    return this.request('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, deviceInfo })
    });
  }

  googleAuth(idToken, profile, deviceInfo) {
    return this.request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, profile, deviceInfo })
    });
  }

  appleAuth(identityToken, userInfo, deviceInfo) {
    return this.request('/api/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, userInfo, deviceInfo })
    });
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  deleteAccount() {
    return this.request('/api/auth/account', { method: 'DELETE' });
  }

  // Devices & Prekeys
  uploadPrekeys(bundle) {
    return this.request('/api/devices/keys', {
      method: 'POST',
      body: JSON.stringify(bundle)
    });
  }

  getUserKeys(userId) {
    return this.request(`/api/devices/user/${userId}/keys`);
  }

  lookupContact(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/devices/lookup?${qs}`);
  }

  getLinkedDevices() {
    return this.request('/api/devices/linked');
  }

  revokeDevice(deviceId) {
    return this.request(`/api/devices/${deviceId}/revoke`, { method: 'POST' });
  }

  // Messages
  sendEnvelopes(envelopes) {
    return this.request('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ envelopes })
    });
  }

  fetchPendingMessages() {
    return this.request('/api/messages/pending');
  }

  ackMessages(messageIds) {
    return this.request('/api/messages/ack', {
      method: 'POST',
      body: JSON.stringify({ messageIds })
    });
  }

  // Media
  uploadAttachment(ciphertextBlob) {
    const formData = new FormData();
    formData.append('ciphertextBlob', ciphertextBlob);
    return this.request('/api/media/upload', {
      method: 'POST',
      body: formData
    });
  }

  downloadAttachment(attachmentId) {
    return this.request(`/api/media/${attachmentId}`, { asArrayBuffer: true });
  }

  // Privacy
  getPrivacySettings() {
    return this.request('/api/privacy/settings');
  }

  updatePrivacySettings(settings) {
    return this.request('/api/privacy/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  getBlockedUsers() {
    return this.request('/api/privacy/blocked');
  }

  blockUser(userId) {
    return this.request('/api/privacy/block', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  unblockUser(userId) {
    return this.request('/api/privacy/unblock', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  reportUser(userId, reason) {
    return this.request('/api/privacy/report', {
      method: 'POST',
      body: JSON.stringify({ userId, reason })
    });
  }

  // Users
  getMe() {
    return this.request('/api/users/me');
  }

  updateMe(data) {
    return this.request('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  getUserProfile(userId) {
    return this.request(`/api/users/${userId}`);
  }

  getUserPresence(userId) {
    return this.request(`/api/users/${userId}/presence`);
  }
}

export const api = new ApiClient();
