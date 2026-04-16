/**
 * Bridge Protocol - Message type definitions and serialization
 */

import { getBridgeConfig } from './BridgeConfig.js';

export const MessageActions = {
  HANDSHAKE: '__handshake__',
  PING: 'ping',
  PONG: 'pong',
  USER_PROMPT: 'userPrompt',
  CHAT_CHUNK: 'chatChunk',
  STREAM_COMPLETE: 'streamComplete',
  AUTH_REQUEST: 'authRequest',
  AUTH_RESPONSE: 'authResponse',
};

export const MessageOrigins = {
  INJECT: 'inject',
  CONTENT: 'content',
  BACKGROUND: 'background',
  SIDEPANEL: 'sidepanel',
};

export function buildMessage(action, data = {}, options = {}) {
  const config = getBridgeConfig();
  
  return {
    type: config.messageType,
    communicationId: config.selfId,
    id: generateMessageId(),
    action,
    data,
    needResponse: options.needResponse !== false,
    timestamp: Date.now(),
    protocolVersion: config.protocolVersion,
  };
}

export function buildResponse(requestId, success, data = null, error = null) {
  const config = getBridgeConfig();
  
  return {
    type: config.messageType,
    communicationId: config.selfId,
    requestId,
    success,
    data,
    error,
    timestamp: Date.now(),
  };
}

export function buildHandshakeRequest() {
  return buildMessage(MessageActions.HANDSHAKE, { timestamp: Date.now() }, { needResponse: true });
}

export function buildHandshakeResponse(requestId) {
  return buildResponse(requestId, true, { success: true, timestamp: Date.now() });
}

export function isValidMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (!message.type || !message.action) return false;
  return true;
}

export function getMessageTarget(origin) {
  const config = getBridgeConfig();
  
  switch (origin) {
    case MessageOrigins.INJECT:
      return config.injectId;
    case MessageOrigins.CONTENT:
      return config.contentId;
    default:
      return config.selfId;
  }
}

function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseMessage(eventData) {
  try {
    return {
      valid: isValidMessage(eventData),
      type: eventData?.type,
      communicationId: eventData?.communicationId,
      action: eventData?.action,
      data: eventData?.data,
      requestId: eventData?.requestId,
      needResponse: eventData?.needResponse,
      success: eventData?.success,
      error: eventData?.error,
      timestamp: eventData?.timestamp,
    };
  } catch {
    return { valid: false };
  }
}

export function validateOrigin(event, expectedId) {
  return event.data?.communicationId === expectedId;
}