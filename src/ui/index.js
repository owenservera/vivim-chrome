import { SidePanelController } from './SidePanelController.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

function initUI() {
  console.log('[UI] Initializing VIVIM side panel...');
  console.log('[UI] DOM state:', document.readyState);
  console.log('[UI] Looking for elements...');
  
  console.log('[UI] promptInput:', !!document.getElementById('promptInput'));
  console.log('[UI] sendBtn:', !!document.getElementById('sendBtn'));
  console.log('[UI] messagesArea:', !!document.getElementById('messagesArea'));

  const controller = new SidePanelController();

  const UI_RESPONSE_TYPES = new Set([
  'GET_CONVERSATION',
  'GET_CONVERSATION_HISTORY'
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[UI] Message received:', message.type, message);
    controller.handleMessage(message, sender, sendResponse);
    return UI_RESPONSE_TYPES.has(message.type);
  });

  console.log('[UI] Side panel initialized successfully');
}