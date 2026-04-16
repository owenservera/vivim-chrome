/**
 * Security Manager - Handles security operations and user consent
 */

import { Logger } from '../logging/Logger.js';

export class SecurityManager {
  constructor(storageManager) {
    this.storage = storageManager;
    this.logger = new Logger('SecurityManager');
    this.consentGiven = false;
    this.auditLog = [];
    this.maxAuditEntries = 1000;
  }

  /**
   * Initialize security manager
   */
  async init() {
    await this.loadConsentStatus();
    await this.loadAuditLog();
    this.logger.info('Security manager initialized');
  }

  /**
   * Request user consent for data access
   * @param {string} operation - Description of the operation requiring consent
   * @param {string} dataType - Type of data being accessed
   * @returns {Promise<boolean>} Whether consent was granted
   */
  async requestConsent(operation, dataType) {
    if (this.consentGiven) {
      this.logAuditEvent('consent_auto_granted', { operation, dataType });
      return true;
    }

    // In a real implementation, this would show a user dialog
    // For now, we'll simulate consent for demonstration
    const consent = await this.showConsentDialog(operation, dataType);

    if (consent) {
      this.consentGiven = true;
      await this.saveConsentStatus();
      this.logAuditEvent('consent_granted', { operation, dataType });
    } else {
      this.logAuditEvent('consent_denied', { operation, dataType });
    }

    return consent;
  }

  /**
   * Show consent dialog (simulated)
   * @param {string} operation
   * @param {string} dataType
   * @returns {Promise<boolean>}
   */
  async showConsentDialog(operation, dataType) {
    // Simulate user interaction
    const message = `This extension needs access to ${dataType} for ${operation}.\n\nDo you consent to this data access?`;

    // In a real browser extension, this would be a proper UI dialog
    // For this implementation, we'll auto-consent for development
    const autoConsent = confirm(message);
    return autoConsent;
  }

  /**
   * Revoke user consent
   */
  async revokeConsent() {
    this.consentGiven = false;
    await this.saveConsentStatus();
    this.logAuditEvent('consent_revoked', {});
    this.logger.info('User consent revoked');
  }

  /**
   * Check if consent is valid
   * @returns {boolean}
   */
  hasValidConsent() {
    return this.consentGiven;
  }

  /**
   * Securely store sensitive data
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @param {object} metadata - Additional metadata
   */
  async secureStore(key, data, metadata = {}) {
    if (!await this.requestConsent('secure storage', 'sensitive data')) {
      throw new Error('User consent required for secure storage');
    }

    const secureData = {
      data: data,
      metadata: {
        ...metadata,
        storedAt: Date.now(),
        checksum: this.generateChecksum(data)
      }
    };

    await this.storage.set(`secure_${key}`, secureData);
    this.logAuditEvent('data_stored_securely', {
      key,
      dataType: typeof data,
      metadata
    });

    this.logger.info(`Securely stored data for key: ${key}`);
  }

  /**
   * Securely retrieve sensitive data
   * @param {string} key - Storage key
   * @returns {Promise<any>} Retrieved data
   */
  async secureRetrieve(key) {
    if (!this.hasValidConsent()) {
      throw new Error('User consent required for secure data access');
    }

    const secureData = await this.storage.get(`secure_${key}`);
    if (!secureData) {
      return null;
    }

    // Verify data integrity
    const checksum = this.generateChecksum(secureData.data);
    if (checksum !== secureData.metadata.checksum) {
      this.logAuditEvent('data_integrity_violation', { key });
      throw new Error('Data integrity check failed');
    }

    this.logAuditEvent('data_retrieved_securely', {
      key,
      storedAt: secureData.metadata.storedAt
    });

    return secureData.data;
  }

  /**
   * Securely delete sensitive data
   * @param {string} key - Storage key
   */
  async secureDelete(key) {
    await this.storage.remove(`secure_${key}`);
    this.logAuditEvent('data_deleted_securely', { key });
    this.logger.info(`Securely deleted data for key: ${key}`);
  }

  /**
   * Log security audit event
   * @param {string} event - Event type
   * @param {object} details - Event details
   */
  logAuditEvent(event, details) {
    const auditEntry = {
      timestamp: Date.now(),
      event,
      details,
      userAgent: navigator.userAgent,
      url: window.location?.href
    };

    this.auditLog.push(auditEntry);

    // Maintain max log size
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }

    // Save audit log periodically
    if (this.auditLog.length % 10 === 0) {
      this.saveAuditLog();
    }

    this.logger.debug('Audit event logged:', event, details);
  }

  /**
   * Get audit log entries
   * @param {object} filter - Filter options
   * @returns {Array} Filtered audit entries
   */
  getAuditLog(filter = {}) {
    let entries = [...this.auditLog];

    if (filter.event) {
      entries = entries.filter(e => e.event === filter.event);
    }

    if (filter.since) {
      entries = entries.filter(e => e.timestamp >= filter.since);
    }

    if (filter.limit) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  /**
   * Sanitize input data
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .trim();
  }

  /**
   * Validate data against schema
   * @param {any} data - Data to validate
   * @param {object} schema - Validation schema
   * @returns {boolean} Whether data is valid
   */
  validateData(data, schema) {
    // Basic validation implementation
    if (!schema) return true;

    if (schema.type === 'string' && typeof data !== 'string') return false;
    if (schema.type === 'number' && typeof data !== 'number') return false;
    if (schema.type === 'object' && typeof data !== 'object') return false;

    if (schema.maxLength && typeof data === 'string' && data.length > schema.maxLength) {
      return false;
    }

    return true;
  }

  /**
   * Generate checksum for data integrity
   * @param {any} data - Data to checksum
   * @returns {string} Checksum
   */
  generateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Load consent status from storage
   */
  async loadConsentStatus() {
    try {
      const status = await this.storage.get('security_consent');
      this.consentGiven = status?.given || false;
    } catch (error) {
      this.logger.warn('Failed to load consent status:', error);
      this.consentGiven = false;
    }
  }

  /**
   * Save consent status to storage
   */
  async saveConsentStatus() {
    try {
      await this.storage.set('security_consent', {
        given: this.consentGiven,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Failed to save consent status:', error);
    }
  }

  /**
   * Load audit log from storage
   */
  async loadAuditLog() {
    try {
      const log = await this.storage.get('security_audit_log');
      if (Array.isArray(log)) {
        this.auditLog = log;
      }
    } catch (error) {
      this.logger.warn('Failed to load audit log:', error);
    }
  }

  /**
   * Save audit log to storage
   */
  async saveAuditLog() {
    try {
      await this.storage.set('security_audit_log', this.auditLog);
    } catch (error) {
      this.logger.error('Failed to save audit log:', error);
    }
  }

  /**
   * Get security statistics
   * @returns {object} Security statistics
   */
  getStats() {
    const recentEntries = this.auditLog.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000);

    return {
      consentGiven: this.consentGiven,
      totalAuditEntries: this.auditLog.length,
      recentAuditEntries: recentEntries.length,
      auditEventsByType: recentEntries.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
      }, {})
    };
  }
}