/**
 * Aegis Client WebSocket Real-Time Service
 */

import { getApiBase } from './api.js';

export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.handlers = {
      envelope: [],
      typing: [],
      receipt: [],
      callSignal: [],
      connectionChange: []
    };
  }

  connect(accessToken) {
    if (!accessToken) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const apiBase = getApiBase();
    let wsUrl;
    if (apiBase) {
      const parsed = new URL(apiBase);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${parsed.host}/ws?token=${encodeURIComponent(accessToken)}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(accessToken)}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyHandlers('connectionChange', { connected: true });

        // Start heartbeat ping
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'ENVELOPE':
              this.notifyHandlers('envelope', msg.envelope);
              break;
            case 'TYPING':
              this.notifyHandlers('typing', msg);
              break;
            case 'RECEIPT':
              this.notifyHandlers('receipt', msg);
              break;
            case 'CALL_SIGNAL':
              this.notifyHandlers('callSignal', msg);
              break;
            case 'PONG':
              break;
            default:
              break;
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect(accessToken);
      };

      this.ws.onerror = () => {
        this.cleanup();
      };
    } catch (e) {
      this.scheduleReconnect(accessToken);
    }
  }

  scheduleReconnect(accessToken) {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    setTimeout(() => {
      this.connect(accessToken);
    }, delay);
  }

  cleanup() {
    this.isConnected = false;
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.notifyHandlers('connectionChange', { connected: false });
  }

  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendTyping(recipientUserId, isTyping) {
    return this.send({
      type: 'TYPING',
      recipientUserId,
      isTyping
    });
  }

  sendReceipt(recipientUserId, messageId, status) {
    return this.send({
      type: 'RECEIPT',
      recipientUserId,
      messageId,
      status
    });
  }

  sendCallSignal(recipientUserId, signal) {
    return this.send({
      type: 'CALL_SIGNAL',
      recipientUserId,
      signal
    });
  }

  on(event, callback) {
    if (this.handlers[event]) {
      this.handlers[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(cb => cb !== callback);
    }
  }

  notifyHandlers(event, payload) {
    if (this.handlers[event]) {
      for (const cb of this.handlers[event]) {
        try { cb(payload); } catch (e) {}
      }
    }
  }
}

export const wsClient = new WebSocketClient();
