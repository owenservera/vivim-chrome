/**
 * Bridge Configuration Management
 * Centralizes all communication IDs, timeouts, and protocol settings
 * 
 * No hardcoded values - all configurable
 */

// Default configuration - can be overridden
const DEFAULT_CONFIG = {
  // Communication IDs for the message bus
  communication: {
    // Bridge's own identity
    selfId: 'vivim-bridge',
    
    // ID that content script listens for
    contentId: 'vivim-content',
    
    // ID that inject-web expects from content
    injectId: 'vivim-inject',
  },
  
  // Message timeouts (milliseconds)
  timeouts: {
    // How long to wait for handshake response
    handshake: 500,
    
    // How long to wait for message response
    request: 30000,
    
    // How often to retry handshake
    handshakeRetryInterval: 1000,
    
    // Max handshake attempts before giving up
    maxHandshakeAttempts: 10,
  },
  
  // Protocol version
  protocol: {
    version: '1.0.0',
    messageType: 'vivim-bridge',
  },
  
  // Providers configuration
  providers: {
    // Which providers are enabled
    enabled: ['chatgpt', 'claude', 'gemini', 'deepseek'],
    
    // Request patterns for each provider
    patterns: {
      chatgpt: {
        request: /\/backend-api(\/f)?\/conversation(\?|$)/,
        hosts: ['chatgpt.com', 'chat.com'],
      },
      claude: {
        request: /\/api\/v0\/messages/,
        hosts: ['claude.ai'],
      },
      gemini: {
        request: /\/api\/generate(ai|Content)/,
        hosts: ['generativelanguage.googleapis.com'],
      },
      deepseek: {
        request: /\/v1\/chat\/completions/,
        hosts: ['api.deepseek.com'],
      },
    },
  },
};

// Merge user config with defaults
class BridgeConfig {
  constructor(userConfig = {}) {
    this.config = this.merge(DEFAULT_CONFIG, userConfig);
  }
  
  merge(defaults, overrides) {
    const result = { ...defaults };
    
    for (const [key, value] of Object.entries(overrides)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.merge(defaults[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  // Getters for common config values
  get selfId() {
    return this.config.communication.selfId;
  }
  
  get contentId() {
    return this.config.communication.contentId;
  }
  
  get injectId() {
    return this.config.communication.injectId;
  }
  
  get handshakeTimeout() {
    return this.config.timeouts.handshake;
  }
  
  get requestTimeout() {
    return this.config.timeouts.request;
  }
  
  get messageType() {
    return this.config.protocol.messageType;
  }
  
  get protocolVersion() {
    return this.config.protocol.version;
  }
  
  get enabledProviders() {
    return this.config.providers.enabled;
  }
  
  getProviderPattern(providerId) {
    return this.config.providers.patterns[providerId];
  }
  
  isProviderEnabled(providerId) {
    return this.config.providers.enabled.includes(providerId);
  }
  
  // Get full config (for debugging)
  getAll() {
    return { ...this.config };
  }
}

// Singleton instance
let bridgeConfig = null;

/**
 * Initialize or get bridge configuration
 * @param {Object} userConfig - Optional user configuration to merge
 * @returns {BridgeConfig} Configuration instance
 */
export function initBridgeConfig(userConfig = {}) {
  if (!bridgeConfig) {
    bridgeConfig = new BridgeConfig(userConfig);
  }
  return bridgeConfig;
}

/**
 * Get current bridge configuration
 * @returns {BridgeConfig} Configuration instance
 */
export function getBridgeConfig() {
  if (!bridgeConfig) {
    bridgeConfig = new BridgeConfig();
  }
  return bridgeConfig;
}

/**
 * Reset configuration (mainly for testing)
 */
export function resetBridgeConfig() {
  bridgeConfig = null;
}

export { BridgeConfig, DEFAULT_CONFIG };