/**
 * Background Service Worker - Main Entry Point
 * Orchestrates all background services in a modular architecture
 */

import { MessageBus } from '../core/messaging/MessageBus.js';
import { MessageValidator } from '../core/messaging/MessageValidator.js';
import { TabManager } from './services/TabManager.js';
import { ConversationManager } from './services/ConversationManager.js';
import { DestinationManager } from './services/DestinationManager.js';

// Initialize core systems
const messageBus = new MessageBus();

// Add message validation middleware
messageBus.use(async (message) => {
  MessageValidator.validateMessage(message);
  return message;
});

// Initialize services
const services = new Map();

services.set('tabManager', new TabManager(messageBus));
services.set('conversationManager', new ConversationManager(messageBus));
services.set('destinationManager', new DestinationManager(messageBus));

// Handle incoming messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, message);

  // Route message through the bus
  messageBus.emit(message)
    .then(result => {
      // If the message expects a response, send it
      if (message.needsResponse) {
        sendResponse(result);
      }
    })
    .catch(error => {
      console.error('[Background] Message handling failed:', error);
      if (message.needsResponse) {
        sendResponse({ error: error.message });
      }
    });

  // Return true if we expect to send a response asynchronously
  return message.needsResponse || false;
});

// Side panel setup
chrome.sidePanel.setOptions({
  enabled: true,
  path: 'sidepanel.html'
});

chrome.action.onClicked.addListener((tab) => {
  // Open side panel for any tab - it will show appropriate state
  chrome.sidePanel.open({ tabId: tab.id });
});

// Initialize telemetry (if available)
function initTelemetry() {
  if (typeof VIVIMTelemetry !== 'undefined') {
    VIVIMTelemetry.init({
      retentionDays: 30,
      sampleRate: 1.0
    }).then(() => {
      console.log('[Background] Telemetry initialized');
      VIVIMTelemetry.trackAction('background_loaded', { version: '2.0.0' });
    }).catch(e => {
      console.warn('[Background] Telemetry init failed:', e);
    });
  }
}

// Startup initialization
async function init() {
  console.log('[Background] Initializing modular service worker...');

  // Initialize all services
  for (const [name, service] of services) {
    if (service.init) {
      try {
        await service.init();
        console.log(`[Background] Service '${name}' initialized`);
      } catch (error) {
        console.error(`[Background] Failed to initialize service '${name}':`, error);
      }
    }
  }

  // Initialize telemetry
  initTelemetry();

  console.log('[Background] All services initialized successfully');
}

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extension startup');
  init();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated');
  init();
});

// Initialize immediately if not already done
if (!chrome.runtime.onStartup.hasListeners()) {
  init();
}