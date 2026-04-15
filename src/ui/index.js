/**
 * UI Entry Point - Side Panel
 * Initializes the modular UI components
 */

// Import core UI functionality (will be expanded)
import { SidePanelController } from './SidePanelController.js';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

function initUI() {
  console.log('[UI] Initializing modular side panel...');

  // Initialize the main side panel controller
  const controller = new SidePanelController();

  // Set up message handling for background communication
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    controller.handleMessage(message, sender, sendResponse);
    // Return true if we might send a response asynchronously
    return message.type === 'GET_CONVERSATION' ||
           message.type === 'GET_CONVERSATION_HISTORY';
  });

  console.log('[UI] Side panel initialized');
}