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

  const controller = new SidePanelController();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[UI] Message received:', message.type, message);
    controller.handleMessage(message, sender, sendResponse);
    return message.type === 'GET_CONVERSATION' ||
           message.type === 'GET_CONVERSATION_HISTORY';
  });

  console.log('[UI] Side panel initialized');
}