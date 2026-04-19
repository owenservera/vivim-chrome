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
import { ApiStreamService } from './services/ApiStreamService.js';
import { globalDataFeedManager } from '../core/storage/DataFeedManager.js';

const logger = new Logger('Background');
const messageBus = new MessageBus();
messageBus.logger = logger.child('MessageBus');

// Add message validation middleware
messageBus.use(async (message) => {
  try {
    const result = MessageValidator.validateMessage(message);
    if (!result.valid && result.errors.length > 0) {
      logger.warn('Message validation failed:', result.errors);
    }
  } catch (error) {
    logger.warn('Message validation error:', error.message);
  }
  return message;
});

// Initialize services
const services = new Map();

const tabManager = new TabManager(messageBus);
const conversationManager = new ConversationManager(messageBus);
const destinationManager = new DestinationManager(messageBus);
const apiStreamService = new ApiStreamService(messageBus);

// Wire services
conversationManager.setDestinationManager(destinationManager);

services.set('tabManager', tabManager);
services.set('conversationManager', conversationManager);
services.set('destinationManager', destinationManager);
services.set('apiStreamService', apiStreamService);

messageBus.on('*', (message, sender) => {
  logger.debug('Wildcard handler caught:', message.type);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, message);

  if (message.type === 'REGISTER_DESTINATION') {
    destinationManager.registerDestination(message.id, message.config);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'EXPORT_ALL_CONVERSATIONS') {
    conversationManager.exportAllConversations()
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'AUTH_UPDATE') {
    if (message.provider && message.auth) {
      chrome.storage.local.set({ [`${message.provider}_auth`]: message.auth })
        .then(() => console.log(`[Background] Saved auth for ${message.provider}`))
        .catch(err => console.error(`[Background] Failed to save auth:`, err));
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'PING') {
    if (message.component === 'sidepanel' || message.component === 'options') {
      destinationManager.registerDestination(message.component);
    }

    sendResponse({ 
      status: 'ok', 
      timestamp: Date.now(),
      services: Array.from(services.keys())
    });
    return true;
  }

  if (message.type === 'API_STREAM_CONFIG') {
    apiStreamService.saveConfig(message.config)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'API_STREAM_GET_CONFIG') {
    sendResponse(apiStreamService.getConfig());
    return true;
  }

  if (message.type === 'runChatGPTTests') {
    // Import the test scenarios dynamically
    import('../providers/chatgpt/ChatGPTStreamingTestScenarios.js')
      .then(({ default: ChatGPTStreamingTestScenarios }) => {
        // We need access to the ChatGPT provider instance
        // For now, we'll create a mock provider or find the real one
        // This is a simplified implementation - in a real scenario,
        // you'd need to access the actual provider instance
        try {
          // Create a mock provider for testing
          const mockProvider = {
            sendToBridge: (action, data) => {
              logger.debug(`Mock sendToBridge: ${action}`, data);
            },
            dataFeedStudy: {
              captureNetworkEvent: () => {},
              captureSSEEvent: () => {},
              captureJSONParseAttempt: () => {},
              captureDeltaProcessing: () => {},
              captureChunkEmission: () => {},
              captureError: () => {}
            }
          };

          const testScenarios = new ChatGPTStreamingTestScenarios(mockProvider);
          return testScenarios.runAllScenarios();
        } catch (error) {
          throw new Error(`Failed to create test scenarios: ${error.message}`);
        }
      })
      .then(results => {
        sendResponse({
          success: true,
          results: {
            total: results.results.length,
            passed: results.results.filter(r => r.passed).length,
            failed: results.results.filter(r => !r.passed).length
          },
          summary: results.summary
        });
      })
      .catch(error => {
        logger.error('Test scenarios failed:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true;
  }

  if (message.type === 'API_STREAM_GET_STATUS') {
    sendResponse(apiStreamService.getStatus());
    return true;
  }

  if (message.type === 'API_STREAM_SET_ENABLED') {
    apiStreamService.setEnabled(message.enabled);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'API_STREAM_FORCE_SYNC') {
    apiStreamService.forceSync(message.messages)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  messageBus.emit(message, sender)
    .then(result => {
      console.log('[Background] messageBus.emit result:', message.type, result);
      if (message.needsResponse) {
        sendResponse(result);
      }
    })
    .catch(error => {
      console.error('[Background] Message handling error:', message.type, error);
      if (message.needsResponse) {
        sendResponse({ error: error.message });
      }
    });

  return true;
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

  // Initialize data feed manager
  try {
    await globalDataFeedManager.initialize();
    logger.info('Data feed manager initialized');
  } catch (error) {
    logger.error('Failed to initialize data feed manager:', error);
  }

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

// Always initialize immediately: the service worker is executed fresh on each
// activation, so we must init synchronously. onStartup/onInstalled only fire
// on specific lifecycle events and are not guaranteed on every SW activation.
init();