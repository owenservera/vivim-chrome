/**
 * Secure Storage - Encrypted storage for sensitive data
 */

import { Logger } from '../logging/Logger.js';

export class SecureStorage {
  constructor(storageManager) {
    this.storage = storageManager;
    this.logger = new Logger('SecureStorage');
    this.encryptionKey = null;
  }

  /**
   * Initialize secure storage with encryption key
   * @param {string} key - Encryption key
   */
  async init(key = null) {
    if (key) {
      this.encryptionKey = key;
    } else {
      // Generate a key if none provided
      this.encryptionKey = await this.generateEncryptionKey();
    }

    this.logger.info('Secure storage initialized');
  }

  /**
   * Store encrypted data
   * @param {string} key - Storage key
   * @param {any} data - Data to encrypt and store
   * @param {object} metadata - Additional metadata
   */
  async store(key, data, metadata = {}) {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const encryptedData = await this.encrypt(data);
      const secureData = {
        data: encryptedData,
        metadata: {
          ...metadata,
          storedAt: Date.now(),
          version: '1.0'
        }
      };

      await this.storage.set(`secure_${key}`, secureData);
      this.logger.info(`Encrypted data stored for key: ${key}`);

    } catch (error) {
      this.logger.error(`Failed to store encrypted data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt data
   * @param {string} key - Storage key
   * @returns {Promise<any>} Decrypted data
   */
  async retrieve(key) {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }

    try {
      const secureData = await this.storage.get(`secure_${key}`);
      if (!secureData) {
        return null;
      }

      const decryptedData = await this.decrypt(secureData.data);
      this.logger.info(`Encrypted data retrieved for key: ${key}`);

      return decryptedData;

    } catch (error) {
      this.logger.error(`Failed to retrieve encrypted data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete encrypted data
   * @param {string} key - Storage key
   */
  async delete(key) {
    try {
      await this.storage.remove(`secure_${key}`);
      this.logger.info(`Encrypted data deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete encrypted data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if secure data exists
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    const data = await this.storage.get(`secure_${key}`);
    return data !== null;
  }

  /**
   * Encrypt data using Web Crypto API
   * @param {any} data - Data to encrypt
   * @returns {Promise<string>} Encrypted data as base64 string
   */
  async encrypt(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      'AES-GCM',
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data using Web Crypto API
   * @param {string} encryptedData - Encrypted data as base64 string
   * @returns {Promise<any>} Decrypted data
   */
  async decrypt(encryptedData) {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.encryptionKey),
      'AES-GCM',
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    const decryptedStr = decoder.decode(decrypted);

    return JSON.parse(decryptedStr);
  }

  /**
   * Generate a random encryption key
   * @returns {Promise<string>} Random key
   */
  async generateEncryptionKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Rotate encryption key (re-encrypt all data with new key)
   * @param {string} newKey - New encryption key
   */
  async rotateKey(newKey) {
    this.logger.info('Starting encryption key rotation');

    // Get all secure keys
    const allKeys = await this.storage.getAllKeys();
    const secureKeys = allKeys.filter(key => key.startsWith('secure_'));

    for (const key of secureKeys) {
      try {
        const data = await this.retrieve(key.replace('secure_', ''));
        await this.delete(key.replace('secure_', ''));
        this.encryptionKey = newKey;
        await this.store(key.replace('secure_', ''), data);
      } catch (error) {
        this.logger.error(`Failed to rotate key for ${key}:`, error);
      }
    }

    this.encryptionKey = newKey;
    this.logger.info('Encryption key rotation completed');
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage statistics
   */
  async getStats() {
    const allKeys = await this.storage.getAllKeys();
    const secureKeys = allKeys.filter(key => key.startsWith('secure_'));

    return {
      totalSecureItems: secureKeys.length,
      encryptionEnabled: !!this.encryptionKey
    };
  }
}