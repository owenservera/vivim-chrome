/**
 * Background Service Worker - Main Entry Point
 * Orchestrates all background services in a modular architecture
 */

import { Logger } from '../core/logging/Logger.js';
import { MessageBus } from '../core/messaging/MessageBus.js';
import { MessageValidator } from '../core/messaging/MessageValidator.js';
import { TabManager } from './services/TabManager.js';
import { ConversationManager } from './services/ConversationManager.js';
import { DestinationManager } from './services/DestinationManager.js';

const logger = new Logger('Background');
const messageBus = new MessageBus();
messageBus.logger = logger.child('MessageBus');

// Add message validation middleware
messageBus.use(async (message) => {
  MessageValidator.validateMessage(message);
  return message;
});

// Initialize services
const services = new Map();

const tabManager = new TabManager(messageBus);
const conversationManager = new ConversationManager(messageBus);
const destinationManager = new DestinationManager(messageBus);

// Wire services
conversationManager.setDestinationManager(destinationManager);

services.set('tabManager', tabManager);
services.set('conversationManager', conversationManager);
services.set('destinationManager', destinationManager);

// Handle incoming messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Received message:', message.type, message);

  // Handle ping for health check
  if (message.type === 'PING') {
    // Automatically register the sender as a destination if it's a UI component
    if (message.component === 'sidepanel' || message.component === 'options') {
      destinationManager.registerDestination(message.component);
    }

    sendResponse({ 
      status: 'ok', 
      timestamp: Date.now(),
      services: Array.from(services.keys())
    });
    return;
  }

  // Route message through the bus
  messageBus.emit(message)
    .then(result => {
      if (message.needsResponse) {
        sendResponse(result);
      }
    })
    .catch(error => {
      logger.error('Message handling failed:', error);
      if (message.needsResponse) {
        sendResponse({ error: error.message });
      }
    });

  return message.needsResponse || false;
});

// Side panel setup
chrome.sidePanel.setOptions({
  enabled: true,
  path: 'sidepanel.html'
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Startup initialization
async function init() {
  logger.info('Initializing modular service worker...');

  // Initialize all services
  for (const [name, service] of services) {
    if (service.init) {
      try {
        await service.init();
        logger.info(`Service '${name}' initialized`);
      } catch (error) {
        logger.error(`Failed to initialize service '${name}':`, error);
      }
    }
  }

  logger.info('All services initialized successfully');
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