import { SidePanelController } from './SidePanelController.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

function initUI() {
  console.log('[UI] Initializing VIVIM side panel...');

  const controller = new SidePanelController();

  // The SidePanelController registers its own chrome.runtime.onMessage listener
  // inside init(). Do NOT add a second listener here — double-registration causes
  // every message to be handled twice and the second handler's sendResponse call
  // would throw "The message channel is closed" since the first handler already
  // consumed the channel.

  console.log('[UI] Side panel initialized successfully');
}