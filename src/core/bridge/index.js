export { BridgeConfig, getBridgeConfig, initBridgeConfig, resetBridgeConfig } from './BridgeConfig.js';
export { WebBridge, getWebBridge, createWebBridge, destroyWebBridge } from './WebBridge.js';
export { 
  MessageActions, 
  MessageOrigins,
  buildMessage, 
  buildResponse,
  buildHandshakeRequest,
  buildHandshakeResponse,
  isValidMessage,
  parseMessage,
  validateOrigin,
  getMessageTarget,
} from './BridgeProtocol.js';