/**
 * Aegis Backend - Real-Time Encrypted WebSocket Relay
 * Coordinates instant envelope delivery, typing indicators, delivery receipts,
 * and WebRTC peer calling signaling. Never inspects or stores payload contents.
 */

import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/config.js';
import { db } from '../db/database.js';

export class WebSocketRelay {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map(); // deviceId -> { ws, userId, deviceId, lastPing }
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Liveness heartbeat monitor every 30s
    setInterval(() => {
      const now = Date.now();
      for (const [deviceId, conn] of this.activeConnections.entries()) {
        if (now - conn.lastPing > 60000) {
          conn.ws.terminate();
          this.activeConnections.delete(deviceId);
        } else {
          try {
            conn.ws.ping();
          } catch (e) {}
        }
      }
    }, 30000);
  }

  handleConnection(ws, req) {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication token required');
      return;
    }

    try {
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
      const device = db.get(
        'SELECT id, user_id, revoked_at FROM devices WHERE id = ?',
        [decoded.deviceId]
      );

      if (!device || device.revoked_at) {
        ws.close(4003, 'Device unauthorized or revoked');
        return;
      }

      const deviceId = device.id;
      const userId = device.user_id;

      // Register connection
      this.activeConnections.set(deviceId, {
        ws,
        userId,
        deviceId,
        lastPing: Date.now()
      });

      // Acknowledge connection
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        deviceId,
        timestamp: Date.now()
      }));

      ws.on('pong', () => {
        const conn = this.activeConnections.get(deviceId);
        if (conn) conn.lastPing = Date.now();
      });

      ws.on('message', (raw) => {
        this.handleClientMessage(userId, deviceId, raw);
      });

      ws.on('close', () => {
        this.activeConnections.delete(deviceId);
        db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [Date.now(), deviceId]);
      });

      ws.on('error', () => {
        this.activeConnections.delete(deviceId);
      });

    } catch (err) {
      ws.close(4002, 'Token invalid or expired');
    }
  }

  handleClientMessage(senderUserId, senderDeviceId, rawData) {
    try {
      const msg = JSON.parse(rawData.toString());

      switch (msg.type) {
        case 'PING': {
          const conn = this.activeConnections.get(senderDeviceId);
          if (conn) {
            conn.lastPing = Date.now();
            conn.ws.send(JSON.stringify({ type: 'PONG' }));
          }
          break;
        }

        // Ephemeral typing notification (zero persistence)
        case 'TYPING': {
          this.routeToUserDevices(msg.recipientUserId, {
            type: 'TYPING',
            senderUserId,
            isTyping: !!msg.isTyping
          });
          break;
        }

        // Delivery / Read receipts
        case 'RECEIPT': {
          this.routeToUserDevices(msg.recipientUserId, {
            type: 'RECEIPT',
            messageId: msg.messageId,
            senderUserId,
            status: msg.status // 'delivered' or 'read'
          });
          break;
        }

        // WebRTC Signaling (Offer, Answer, ICE Candidate) for secure peer-to-peer calling
        case 'CALL_SIGNAL': {
          this.routeToUserDevices(msg.recipientUserId, {
            type: 'CALL_SIGNAL',
            senderUserId,
            signal: msg.signal
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      // Ignore malformed frames
    }
  }

  /**
   * Push an encrypted envelope directly to a connected device
   */
  pushEnvelope(recipientDeviceId, envelope) {
    const conn = this.activeConnections.get(recipientDeviceId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(JSON.stringify({
          type: 'ENVELOPE',
          envelope
        }));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Route real-time signal to all active devices of a given user
   */
  routeToUserDevices(recipientUserId, payload) {
    for (const conn of this.activeConnections.values()) {
      if (conn.userId === recipientUserId && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(JSON.stringify(payload));
        } catch (e) {}
      }
    }
  }

  /**
   * Check if at least one device belonging to a user is currently online
   */
  isUserOnline(userId) {
    for (const conn of this.activeConnections.values()) {
      if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }
}

export const wsRelay = new WebSocketRelay();
