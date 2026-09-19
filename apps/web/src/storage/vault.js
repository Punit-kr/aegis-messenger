/**
 * Aegis Client Storage - Encrypted Local Storage Vault & Retention Shredder
 * Protects local keys and message logs with AES-256-GCM authenticated encryption.
 * Automatically enforces client-side message expiration and shredding.
 */

import {
  encryptAESGCM,
  decryptAESGCM,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from '../crypto/webcrypto.js';

const DB_NAME = 'aegis_secure_vault';
const DB_VERSION = 1;

export class EncryptedLocalVault {
  constructor() {
    this.db = null;
    this.vaultKey = null; // In-memory 256-bit AES master key
  }

  /**
   * Open IndexedDB database and initialize object stores
   */
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Stores
        if (!db.objectStoreNames.contains('keystore')) {
          db.createObjectStore('keystore', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ratchet_sessions')) {
          db.createObjectStore('ratchet_sessions', { keyPath: 'peerUserId' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('chatId', 'chatId', { unique: false });
          msgStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to open Aegis Secure Vault: ' + event.target.error));
      };
    });
  }

  /**
   * Initialize or unlock vault master key using device secret / PIN
   */
  async unlock(passphrase = 'device-default-entropy') {
    if (!this.db) await this.open();

    // Derive 256-bit key from passphrase using PBKDF2
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('aegis-device-vault-salt-v1');
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const exported = await window.crypto.subtle.exportKey('raw', derivedKey);
    this.vaultKey = new Uint8Array(exported);

    // Launch periodic local retention shredder
    this.startLocalShredder();
    return true;
  }

  /**
   * Lock vault and wipe master key from memory
   */
  lock() {
    this.vaultKey = null;
  }

  isUnlocked() {
    return this.vaultKey !== null;
  }

  // Encrypted Key-Value store helper
  async putEncrypted(storeName, item, idKey = 'id') {
    if (!this.vaultKey) throw new Error('Vault is locked');

    const plaintext = JSON.stringify(item);
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const { ciphertextBase64, ivBase64 } = await encryptAESGCM(this.vaultKey, plaintextBytes);

    const record = {
      [idKey]: item[idKey],
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      // Indexable unencrypted metadata required for fast range queries and expiration sweeps
      chatId: item.chatId || undefined,
      expiresAt: item.expiresAt || 0,
      timestamp: item.timestamp || Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getDecrypted(storeName, key) {
    if (!this.vaultKey) throw new Error('Vault is locked');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = async () => {
        const record = req.result;
        if (!record) return resolve(null);

        try {
          const decryptedBytes = await decryptAESGCM(this.vaultKey, record.ciphertext, record.iv);
          const plaintext = new TextDecoder().decode(decryptedBytes);
          resolve(JSON.parse(plaintext));
        } catch (err) {
          reject(new Error('Vault decryption error: ' + err.message));
        }
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getMessagesForChat(chatId) {
    if (!this.vaultKey) throw new Error('Vault is locked');
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['messages'], 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('chatId');
      const req = index.getAll(chatId);

      req.onsuccess = async () => {
        const records = req.result || [];
        const decryptedMessages = [];

        for (const rec of records) {
          // Check local expiry
          if (rec.expiresAt > 0 && now >= rec.expiresAt) {
            continue; // Skip expired
          }

          try {
            const decryptedBytes = await decryptAESGCM(this.vaultKey, rec.ciphertext, rec.iv);
            const plaintext = new TextDecoder().decode(decryptedBytes);
            decryptedMessages.push(JSON.parse(plaintext));
          } catch (e) {}
        }

        // Sort chronological
        decryptedMessages.sort((a, b) => a.timestamp - b.timestamp);
        resolve(decryptedMessages);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Periodic Local Retention Shredder:
   * Permanently wipes expired messages and thumbnails from browser IndexedDB
   */
  async sweepExpiredMessages() {
    if (!this.db) return;
    const now = Date.now();

    const tx = this.db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('expiresAt');
    // Find all records where expiresAt > 0 and <= now
    const range = IDBKeyRange.bound(1, now);
    const req = index.openCursor(range);

    let shredded = 0;
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        shredded++;
        cursor.continue();
      }
    };
  }

  startLocalShredder() {
    if (this._shredderInterval) clearInterval(this._shredderInterval);
    this._shredderInterval = setInterval(() => {
      this.sweepExpiredMessages();
    }, 30000);
  }

  /**
   * Clear all local data on logout / device wipe
   */
  async wipeAll() {
    if (!this.db) return;
    const storeNames = ['keystore', 'ratchet_sessions', 'messages', 'contacts', 'settings'];
    const tx = this.db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    this.vaultKey = null;
  }
}

export const vault = new EncryptedLocalVault();
