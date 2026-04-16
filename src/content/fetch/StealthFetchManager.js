/**
 * Stealth Fetch Manager
 * Manages fetch operations with stealth options to reduce detection
 */

import { Logger } from '../../core/logging/Logger.js';
import { ContentScriptFetch } from './ContentScriptFetch.js';

export class StealthFetchManager {
  constructor(options = {}) {
    this.logger = new Logger('StealthFetchManager');
    this.options = {
      preferContentScript: false,
      fallbackToBackground: true,
      contentScriptTimeout: 10000,
      ...options
    };

    this.providers = new Map();
  }

  /**
   * Register a provider's stealth configuration
   */
  registerProvider(providerId, config) {
    this.providers.set(providerId, {
      preferContentScript: config.preferContentScript || this.options.preferContentScript,
      contentScriptHosts: config.contentScriptHosts || [],
      fallbackToBackground: config.fallbackToBackground !== false,
      ...config
    });

    this.logger.info(`Registered stealth config for ${providerId}`);
  }

  /**
   * Perform a stealth fetch operation
   */
  async fetch(providerId, url, options = {}) {
    const config = this.providers.get(providerId) || {};
    const shouldUseContentScript = this.shouldUseContentScript(providerId, url, config);

    if (shouldUseContentScript) {
      try {
        return await this.fetchViaContentScript(providerId, url, options, config);
      } catch (error) {
        this.logger.warn(`Content script fetch failed for ${providerId}:`, error.message);

        if (config.fallbackToBackground || this.options.fallbackToBackground) {
          this.logger.info(`Falling back to background fetch for ${providerId}`);
          return await this.fetchViaBackground(url, options);
        }

        throw error;
      }
    } else {
      return await this.fetchViaBackground(url, options);
    }
  }

  /**
   * Determine if we should use content script for this request
   */
  shouldUseContentScript(providerId, url, config) {
    // Check if provider prefers content script
    if (!config.preferContentScript && !this.options.preferContentScript) {
      return false;
    }

    // Check if we have suitable tabs for this provider
    const hasSuitableTab = this.hasSuitableContentScriptTab(providerId, url, config);
    if (!hasSuitableTab) {
      this.logger.debug(`No suitable content script tab found for ${providerId}`);
      return false;
    }

    return true;
  }

  /**
   * Check if we have a suitable tab for content script fetch
   */
  hasSuitableContentScriptTab(providerId, url, config) {
    try {
      // Get all tabs that could work for this provider
      const hostPatterns = config.contentScriptHosts || [];

      // For now, we'll use a simpler check - look for tabs matching provider domains
      // In a real implementation, this would query actual tabs
      return hostPatterns.some(pattern => url.includes(pattern));
    } catch (error) {
      this.logger.warn('Error checking for suitable tabs:', error);
      return false;
    }
  }

  /**
   * Fetch via content script
   */
  async fetchViaContentScript(providerId, url, options, config) {
    this.logger.debug(`Fetching ${url} via content script for ${providerId}`);

    // Find a suitable tab for this provider
    const tabId = await this.findContentScriptTab(providerId, config);

    if (!tabId) {
      throw new Error(`No suitable tab found for content script fetch`);
    }

    return await ContentScriptFetch.fetchFromContentScript(
      tabId,
      url,
      options,
      config.contentScriptTimeout || this.options.contentScriptTimeout
    );
  }

  /**
   * Find a suitable tab for content script operations
   */
  async findContentScriptTab(providerId, config) {
    const hostPatterns = config.contentScriptHosts || [];

    try {
      // Query for tabs that match the provider's domains
      for (const pattern of hostPatterns) {
        const tabs = await chrome.tabs.query({ url: `*://${pattern}/*` });
        if (tabs.length > 0) {
          // Return the first active tab, or just the first tab
          const activeTab = tabs.find(tab => tab.active) || tabs[0];
          return activeTab.id;
        }
      }
    } catch (error) {
      this.logger.error('Error finding content script tab:', error);
    }

    return null;
  }

  /**
   * Fetch via background script (standard fetch)
   */
  async fetchViaBackground(url, options) {
    this.logger.debug(`Fetching ${url} via background script`);

    return await fetch(url, options);
  }

  /**
   * Update stealth configuration for a provider
   */
  updateProviderConfig(providerId, config) {
    const existing = this.providers.get(providerId) || {};
    this.providers.set(providerId, { ...existing, ...config });
    this.logger.info(`Updated stealth config for ${providerId}`);
  }

  /**
   * Get stealth statistics
   */
  getStats() {
    return {
      registeredProviders: Array.from(this.providers.keys()),
      globalConfig: this.options
    };
  }
}

// Export singleton instance
export const stealthFetchManager = new StealthFetchManager();