import { getBridgeConfig } from './BridgeConfig.js';
import {
  MessageActions,
  buildMessage,
  buildResponse,
  buildHandshakeRequest,
  parseMessage,
} from './BridgeProtocol.js';

let webBridgeInstance = null;

export class WebBridge {
  constructor(options = {}) {
    this.config = getBridgeConfig();
    this.isReady = false;
    this.isReconnecting = false;
    this.readyPromise = null;
    this.handlers = new Map();
    this.pendingRequests = new Map();
    this.handshakeAttempts = 0;
    this.messageCount = 0;
    this.errorCount = 0;
    this.handshakeRetryTimer = null;
    this.connectionHealth = 'unknown';

    this.options = {
      handshakeTimeout: this.config.handshakeTimeout,
      requestTimeout: this.config.requestTimeout,
      handshakeRetryInterval: this.config.config.timeouts?.handshakeRetryInterval || 1000,
      maxHandshakeAttempts: this.config.config.timeouts?.maxHandshakeAttempts || 10,
      autoHandshake: options.autoHandshake !== false,
      targetId: this.config.contentId,
      enableAutoReconnect: options.enableAutoReconnect !== false,
      healthCheckInterval: options.healthCheckInterval || 30000,
      ...options,
    };

    // Bind handleMessage to preserve 'this' context
    this.handleMessage = this.handleMessage.bind(this);
    
    this.setupMessageListener();
    this.setupHandshakeHandler();
    this.startHealthCheck();

    if (this.options.autoHandshake) {
      this.ensureReady();
    }
  }
  
  setupMessageListener() {
    window.addEventListener('message', this.handleMessage);
    console.log('[WebBridge] Message listener registered');
  }
  
  setupHandshakeHandler() {
    this.on(MessageActions.HANDSHAKE, () => ({ success: true, timestamp: Date.now() }));
  }
  
  async ensureReady() {
    if (this.isReady) {
      return Promise.resolve();
    }
    
    if (this.readyPromise) {
      return this.readyPromise;
    }
    
    this.readyPromise = this.performHandshakeWithRetry();
    
    try {
      await this.readyPromise;
    } finally {
      this.readyPromise = null;
    }
  }
  
  async performHandshakeWithRetry() {
    return new Promise((resolve, reject) => {
      const attempt = async () => {
        try {
          await this.sendSingleHandshakeRequest();
          this.isReady = true;
          console.log('[WebBridge] Handshake successful', { 
            communicationId: this.config.selfId,
            timestamp: Date.now() 
          });
          resolve();
        } catch (error) {
          this.handshakeAttempts++;
          
          if (this.handshakeAttempts >= this.options.maxHandshakeAttempts) {
            console.error('[WebBridge] Handshake failed', { 
              error: error.message,
              attempts: this.handshakeAttempts 
            });
            reject(new Error(`Handshake failed: ${error.message}`));
            return;
          }
          
          console.log('[WebBridge] Retrying handshake', { 
            attempt: this.handshakeAttempts,
            maxAttempts: this.options.maxHandshakeAttempts 
          });
          
          this.handshakeRetryTimer = setTimeout(attempt, this.options.handshakeRetryInterval);
        }
      };
      
      attempt();
    });
  }
  
  async sendSingleHandshakeRequest() {
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Handshake timeout'));
      }, this.options.handshakeTimeout);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      const message = buildHandshakeRequest();
      message.id = requestId;
      
      console.log('[WebBridge] Sending handshake request', { requestId });
      
      window.postMessage(message, '*');
    });
  }
  
  send(action, data = {}) {
    if (!this.isReady && this.options.autoHandshake) {
      console.warn('[WebBridge] Not ready, waiting for handshake before send');
      return this.ensureReady().then(() => this.send(action, data));
    }
    
    const message = buildMessage(action, data, { needResponse: false });
    
    console.log('[WebBridge] Send:', action, { 
      hasData: !!data,
      isReady: this.isReady 
    });
    
    window.postMessage(message, '*');
  }
  
  async invoke(action, data = {}) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${action}`));
      }, this.options.requestTimeout);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      const message = buildMessage(action, data, { needResponse: true });
      message.id = requestId;
      
      console.log('[WebBridge] Invoke:', action, { requestId });
      
      window.postMessage(message, '*');
    });
  }
  
  on(action, handler) {
    this.handlers.set(action, handler);
  }
  
  handleMessage(event) {
    // In the MAIN world, all postMessage events arrive with event.source === window.
    // Filtering on source would drop every response from the content script.
    // We rely solely on the communicationId field for security scoping.
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    const parsed = parseMessage(event.data);

    if (!parsed.valid) {
      return;
    }

    const expectedId = this.config.selfId;
    const targetId = this.config.contentId;

    if (event.data?.communicationId !== expectedId && event.data?.communicationId !== targetId) {
      return;
    }
    
    this.messageCount++;
    
    const { action, data, requestId, needResponse, success, error } = parsed;
    
    if (requestId && this.pendingRequests.has(requestId)) {
      const pending = this.pendingRequests.get(requestId);
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      
      if (success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(error || 'Request failed'));
      }
      return;
    }
    
    if (action && this.handlers.has(action)) {
      try {
        const handler = this.handlers.get(action);
        let result = handler(data);
        
        if (result && typeof result.then === 'function') {
          result.then(r => {
            if (needResponse && requestId) {
              const response = buildResponse(requestId, true, r);
              window.postMessage(response, '*');
            }
          }).catch(err => {
            if (needResponse && requestId) {
              const response = buildResponse(requestId, false, null, err.message);
              window.postMessage(response, '*');
            }
            this.errorCount++;
          });
          return;
        }
        
        if (needResponse && requestId) {
          const response = buildResponse(requestId, true, result);
          window.postMessage(response, '*');
        }
      } catch (err) {
        if (needResponse && requestId) {
          const response = buildResponse(requestId, false, null, err.message);
          window.postMessage(response, '*');
        }
        this.errorCount++;
      }
    }
  }
  
  getReady() {
    return this.isReady;
  }
  
  getStats() {
    return {
      isReady: this.isReady,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      pendingRequests: this.pendingRequests.size,
      handlers: Array.from(this.handlers.keys()),
      handshakeAttempts: this.handshakeAttempts,
    };
  }
  
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startHealthCheck() {
    if (!this.options.healthCheckInterval) return;

    this.healthCheckTimer = setInterval(async () => {
      if (!this.isReady || this.pendingRequests.size > 0) return;

      try {
        await this.ping();
        this.connectionHealth = 'healthy';
      } catch {
        this.connectionHealth = 'degraded';
        if (this.options.enableAutoReconnect && !this.isReconnecting) {
          this.reconnect();
        }
      }
    }, this.options.healthCheckInterval);
  }

  async ping() {
    return this.invoke(MessageActions.PING, { timestamp: Date.now() });
  }

  async reconnect() {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.isReady = false;
    this.handshakeAttempts = 0;
    this.connectionHealth = 'reconnecting';

    console.log('[WebBridge] Attempting reconnection...');

    try {
      await this.ensureReady();
      this.connectionHealth = 'healthy';
      console.log('[WebBridge] Reconnection successful');
    } catch (error) {
      this.connectionHealth = 'failed';
      console.error('[WebBridge] Reconnection failed:', error.message);
    } finally {
      this.isReconnecting = false;
    }
  }

  forceReconnect() {
    this.isReady = false;
    this.isReconnecting = false;
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Force reconnect'));
    });
    this.pendingRequests.clear();
    return this.reconnect();
  }

  getHealth() {
    return {
      health: this.connectionHealth,
      isReady: this.isReady,
      isReconnecting: this.isReconnecting,
      pendingRequests: this.pendingRequests.size,
      errorRate: this.messageCount > 0 ? this.errorCount / this.messageCount : 0
    };
  }

  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.handshakeRetryTimer) {
      clearTimeout(this.handshakeRetryTimer);
    }

    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Bridge destroyed'));
    });

    this.pendingRequests.clear();
    this.handlers.clear();
    window.removeEventListener('message', this.handleMessage);
  }
}

export function createWebBridge(options = {}) {
  if (!webBridgeInstance) {
    webBridgeInstance = new WebBridge(options);
  } else if (options.reset === true) {
    webBridgeInstance.destroy();
    webBridgeInstance = new WebBridge(options);
  }
  return webBridgeInstance;
}

export function getWebBridge() {
  if (!webBridgeInstance) {
    webBridgeInstance = new WebBridge({ autoHandshake: false });
  }
  return webBridgeInstance;
}

export function destroyWebBridge() {
  if (webBridgeInstance) {
    webBridgeInstance.destroy();
    webBridgeInstance = null;
  }
}

export { WebBridge as default };