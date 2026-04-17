import { SecurityManager } from '../security/SecurityManager.js';
import { SecureStorage } from '../security/SecureStorage.js';
import { ErrorHandler } from './ErrorHandler.js';

export function createProviderMixin(BaseClass) {
  return class extends BaseClass {
    constructor(config = {}) {
      super(config);
      this.securityManager = null;
      this.secureStorage = null;
      this.errorHandler = new ErrorHandler({
        logger: this.logger,
        maxRetries: config.maxRetries ?? 3,
        baseRetryDelay: config.baseRetryDelay ?? 1000
      });
      this.storageKey = config.storageKey || `${this.id}_auth`;
      this.initSecurityLater();
    }

    async initSecurityLater() {
      const checkStorage = () => {
        return typeof window !== 'undefined' && window.storageManager;
      };

      if (checkStorage()) {
        await this.initializeSecurity();
      } else {
        setTimeout(() => this.initSecurityLater(), 100);
      }
    }

    async initializeSecurity() {
      try {
        const storageMgr = typeof window !== 'undefined' ? window.storageManager : null;
        if (!storageMgr) {
          this.logger.warn('StorageManager not available, skipping security init');
          return;
        }
        this.securityManager = new SecurityManager(storageMgr);
        this.secureStorage = new SecureStorage(storageMgr);
        await this.securityManager.init();
        await this.secureStorage.init();
        await this.loadSecureAuthData();
        this.logger.info(`Security features initialized for ${this.id} provider`);
      } catch (error) {
        this.logger.warn('Failed to initialize security features:', error);
      }
    }

    async loadSecureAuthData() {
      if (!this.secureStorage) return;
      try {
        const secureAuth = await this.secureStorage.retrieve(this.storageKey);
        if (secureAuth) {
          this.onAuthDataLoaded(secureAuth);
          this.logger.info(`Loaded secure auth data for ${this.id}`);
        }
      } catch (error) {
        this.logger.warn('Failed to load secure auth data:', error);
      }
    }

    onAuthDataLoaded(secureAuth) {
    }

    async storeSecureAuthData(authData) {
      if (!this.secureStorage) return;
      try {
        await this.secureStorage.store(this.storageKey, authData, {
          provider: this.id,
          storedBy: 'auth_interception'
        });
        this.logger.info(`Securely stored ${this.id} auth data`);
      } catch (error) {
        this.logger.warn('Failed to store secure auth data:', error);
      }
    }

    async handleProviderError(error, retryCallback, onRefreshAuth) {
      return await this.errorHandler.handleError(error, retryCallback, onRefreshAuth);
    }

    retryWithBackoff(callback, attempt = 1) {
      return this.errorHandler.retryWithBackoff(callback, attempt);
    }

    delay(ms) {
      return this.errorHandler.delay(ms);
    }
  };
}