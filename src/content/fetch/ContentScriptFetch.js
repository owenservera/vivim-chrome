/**
 * Content Script Fetch Handler - Stealth Mode
 * Provides fetch operations from content script context for reduced detection
 */

import { Logger } from '../../core/logging/Logger.js';

export class ContentScriptFetch {
  constructor() {
    this.logger = new Logger('ContentScriptFetch');
    this.activeRequests = new Map();
    this.requestId = 0;
  }

  /**
   * Initialize content script fetch handler
   */
  init() {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      this.logger.warn('Chrome runtime not available, skipping init');
      return;
    }
    this.logger.info('Initializing content script fetch handler');

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CONTENT_FETCH_REQUEST') {
        this.handleFetchRequest(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      }
    });

    // Set up fetch interception for stealth mode
    this.setupStealthFetch();
  }

  /**
   * Handle fetch request from background script
   */
  async handleFetchRequest(message, sender, sendResponse) {
    const { requestId, url, options = {} } = message;

    try {
      this.logger.debug(`Processing fetch request ${requestId}:`, url);

      // Add browser-like headers to reduce detection
      const stealthOptions = this.addStealthHeaders(options);

      const response = await fetch(url, stealthOptions);
      const responseData = await this.processResponse(response);

      sendResponse({
        success: true,
        requestId,
        status: response.status,
        statusText: response.statusText,
        headers: this.headersToObject(response.headers),
        data: responseData
      });

    } catch (error) {
      this.logger.error(`Fetch request ${requestId} failed:`, error);
      sendResponse({
        success: false,
        requestId,
        error: error.message
      });
    }
  }

  /**
   * Process response data
   */
  async processResponse(response) {
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  /**
   * Convert Headers object to plain object
   */
  headersToObject(headers) {
    const result = {};
    for (const [key, value] of headers.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Add stealth headers to make requests appear more browser-like
   */
  addStealthHeaders(options) {
    const headers = { ...options.headers };

    // Add common browser headers
    headers['Accept'] = headers['Accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    headers['Accept-Language'] = headers['Accept-Language'] || navigator.language || 'en-US,en;q=0.5';
    headers['Accept-Encoding'] = headers['Accept-Encoding'] || 'gzip, deflate, br';
    headers['User-Agent'] = headers['User-Agent'] || navigator.userAgent;
    headers['Cache-Control'] = headers['Cache-Control'] || 'no-cache';
    headers['Pragma'] = headers['Pragma'] || 'no-cache';

    // Add referer if not present
    if (!headers['Referer'] && window.location.href) {
      headers['Referer'] = window.location.href;
    }

    // Add cookie if available
    if (document.cookie && !headers['Cookie']) {
      headers['Cookie'] = document.cookie;
    }

    return { ...options, headers };
  }

  /**
   * Set up stealth fetch interception
   */
  setupStealthFetch() {
    // Override fetch in content script context for additional stealth
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [url, options = {}] = args;

      // Add stealth headers
      const stealthOptions = this.addStealthHeaders(options);

      // Add random delay to mimic human behavior
      if (this.shouldAddDelay()) {
        await this.randomDelay();
      }

      return originalFetch(url, stealthOptions);
    };

    this.logger.debug('Stealth fetch interception active');
  }

  /**
   * Determine if we should add random delay
   */
  shouldAddDelay() {
    // Add delay 30% of the time to mimic human behavior
    return Math.random() < 0.3;
  }

  /**
   * Add random delay to mimic human behavior
   */
  async randomDelay() {
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Send fetch request to content script
   * @param {number} tabId - Tab ID to send request to
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @param {number} timeout - Request timeout in ms
   */
  static async fetchFromContentScript(tabId, url, options = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const requestId = Date.now() + '_' + Math.random();

      const message = {
        type: 'CONTENT_FETCH_REQUEST',
        requestId,
        url,
        options
      };

      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Content script fetch timeout after ${timeout}ms`));
      }, timeout);

      // Send message to content script
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }

        if (response.success) {
          // Create a mock Response object
          const mockResponse = {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            json: () => Promise.resolve(response.data),
            text: () => Promise.resolve(typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
          };
          resolve(mockResponse);
        } else {
          reject(new Error(response.error || 'Content script fetch failed'));
        }
      });
    });
  }
}

// Initialize content script fetch handler
const contentScriptFetch = new ContentScriptFetch();
contentScriptFetch.init();