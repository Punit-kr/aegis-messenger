/**
 * Aegis Client Central Reactive State Store
 */

class Store {
  constructor() {
    this.state = {
      currentScreen: 'splash', // splash, welcome, phone_login, otp_verify, google_login, apple_login, profile_setup, chat_list, chat_view, settings, privacy, security, linked_devices, storage, blocked_users, safety_number
      user: null,
      device: null,
      privacySettings: {},
      chats: [],           // Array of { id, peerUserId, displayName, avatarUrl, lastMessage, unreadCount, isPinned, isArchived, isMuted }
      activeChatId: null,
      messages: {},        // chatId -> [ MessageObjects ]
      typingUsers: {},     // userId -> boolean
      onlineUsers: {},     // userId -> boolean
      activeModal: null,   // null, 'new_chat', 'search', 'safety_number', 'call', 'app_lock', 'profile'
      appLocked: false,
      lockPin: null,
      deviceKeys: null,    // { identityKeyPair, signedPrekeyPair, registrationId, oneTimePrekeysMap }
      ratchetSessions: {}  // peerUserId -> DoubleRatchetSession instance
    };

    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('State subscriber error:', e);
      }
    }
  }

  setScreen(screen) {
    this.setState({ currentScreen: screen });
  }

  setModal(modal) {
    this.setState({ activeModal: modal });
  }

  setActiveChat(chatId) {
    const updatedChats = this.state.chats.map(c => 
      c.id === chatId ? { ...c, unreadCount: 0 } : c
    );
    this.setState({ activeChatId: chatId, chats: updatedChats });
  }

  addMessage(chatId, message) {
    const chatMsgs = this.state.messages[chatId] || [];
    // Avoid duplicate message IDs
    if (chatMsgs.some(m => m.id === message.id)) return;

    const newMsgs = [...chatMsgs, message].sort((a, b) => a.timestamp - b.timestamp);
    
    // Update or create chat item in chat list
    let chatExists = false;
    const isCurrentActive = this.state.activeChatId === chatId;

    const updatedChats = this.state.chats.map(c => {
      if (c.id === chatId) {
        chatExists = true;
        return {
          ...c,
          lastMessage: message.text || (message.attachment ? `[${message.attachment.mimeType.split('/')[0]}]` : 'Encrypted Message'),
          lastTimestamp: message.timestamp,
          unreadCount: (!isCurrentActive && message.senderUserId !== this.state.user?.id) ? (c.unreadCount || 0) + 1 : 0
        };
      }
      return c;
    });

    if (!chatExists) {
      updatedChats.unshift({
        id: chatId,
        peerUserId: message.peerUserId || chatId,
        displayName: message.peerDisplayName || 'Aegis Contact',
        avatarUrl: message.peerAvatarUrl || null,
        lastMessage: message.text || 'Encrypted Message',
        lastTimestamp: message.timestamp,
        unreadCount: (!isCurrentActive && message.senderUserId !== this.state.user?.id) ? 1 : 0,
        isPinned: false,
        isArchived: false,
        isMuted: false
      });
    }

    // Sort pinned to top, then recent
    updatedChats.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
    });

    this.setState({
      messages: { ...this.state.messages, [chatId]: newMsgs },
      chats: updatedChats
    });
  }

  updateMessageStatus(chatId, messageId, status) {
    const chatMsgs = this.state.messages[chatId] || [];
    const updated = chatMsgs.map(m => m.id === messageId ? { ...m, status } : m);
    this.setState({
      messages: { ...this.state.messages, [chatId]: updated }
    });
  }

  addReaction(chatId, messageId, emoji, userId) {
    const chatMsgs = this.state.messages[chatId] || [];
    const updated = chatMsgs.map(m => {
      if (m.id === messageId) {
        const reactions = { ...(m.reactions || {}) };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        return { ...m, reactions };
      }
      return m;
    });
    this.setState({
      messages: { ...this.state.messages, [chatId]: updated }
    });
  }

  setTyping(userId, isTyping) {
    this.setState({
      typingUsers: { ...this.state.typingUsers, [userId]: isTyping }
    });
  }

  setUserOnline(userId, isOnline) {
    this.setState({
      onlineUsers: { ...this.state.onlineUsers, [userId]: isOnline }
    });
  }
}

export const store = new Store();
