/**
 * Aegis Client WebRTC Calling Service
 * Peer-to-Peer Encrypted Voice & Video Calling.
 * Media is strictly ephemeral and never recorded or persisted on the server.
 */

import { wsClient } from './ws.js';

export class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCall = null; // { peerUserId, isVideo, status: 'calling'|'ringing'|'connected' }
    this.listeners = {
      callState: [],
      remoteStream: []
    };

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
    this.rtcConfig = { iceServers };

    // Bind WebSocket signaling
    wsClient.on('callSignal', (msg) => this.handleSignal(msg));
  }

  async startCall(peerUserId, isVideo = false) {
    this.currentCall = { peerUserId, isVideo, status: 'calling' };
    this.notifyState();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
      });

      this.initPeerConnection(peerUserId);

      // Add local tracks
      for (const track of this.localStream.getTracks()) {
        this.peerConnection.addTrack(track, this.localStream);
      }

      // Create SDP offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer through zero-knowledge relay
      wsClient.sendCallSignal(peerUserId, {
        type: 'offer',
        sdp: offer.sdp,
        isVideo
      });

    } catch (err) {
      this.endCall();
      throw err;
    }
  }

  async handleSignal({ senderUserId, signal }) {
    if (!signal) return;

    if (signal.type === 'offer') {
      this.currentCall = { peerUserId: senderUserId, isVideo: !!signal.isVideo, status: 'ringing' };
      this.pendingOffer = signal;
      this.notifyState();
    } else if (signal.type === 'answer' && this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
      this.currentCall.status = 'connected';
      this.notifyState();
    } else if (signal.type === 'candidate' && this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (e) {}
    } else if (signal.type === 'hangup') {
      this.endCall(false);
    }
  }

  async acceptCall() {
    if (!this.pendingOffer || !this.currentCall) return;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.currentCall.isVideo
      });

      this.initPeerConnection(this.currentCall.peerUserId);

      for (const track of this.localStream.getTracks()) {
        this.peerConnection.addTrack(track, this.localStream);
      }

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: this.pendingOffer.sdp })
      );

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      wsClient.sendCallSignal(this.currentCall.peerUserId, {
        type: 'answer',
        sdp: answer.sdp
      });

      this.currentCall.status = 'connected';
      this.notifyState();
    } catch (err) {
      this.endCall();
    }
  }

  initPeerConnection(peerUserId) {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.sendCallSignal(peerUserId, {
          type: 'candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      for (const cb of this.listeners.remoteStream) {
        try { cb(this.remoteStream); } catch (e) {}
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'failed') {
        this.endCall(false);
      }
    };
  }

  endCall(sendHangup = true) {
    if (sendHangup && this.currentCall) {
      wsClient.sendCallSignal(this.currentCall.peerUserId, { type: 'hangup' });
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.pendingOffer = null;
    this.currentCall = null;
    this.notifyState();
  }

  onStateChange(cb) { this.listeners.callState.push(cb); }
  onRemoteStream(cb) { this.listeners.remoteStream.push(cb); }

  notifyState() {
    for (const cb of this.listeners.callState) {
      try { cb(this.currentCall); } catch (e) {}
    }
  }
}

export const webrtc = new WebRTCManager();
