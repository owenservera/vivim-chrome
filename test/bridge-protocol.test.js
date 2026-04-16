/**
 * BridgeProtocol Tests
 */

import { 
  MessageActions, 
  MessageOrigins,
  buildMessage, 
  buildResponse,
  buildHandshakeRequest,
  buildHandshakeResponse,
  isValidMessage,
  parseMessage,
  validateOrigin,
  getMessageTarget
} from '../src/core/bridge/BridgeProtocol.js';

export function runTests(test, assert) {
  test('buildMessage creates correct structure', () => {
    const msg = buildMessage('testAction', { key: 'value' }, { needResponse: true });
    
    assert.equal(msg.action, 'testAction', 'action');
    assert.deepEqual(msg.data, { key: 'value' }, 'data');
    assert.equal(msg.needResponse, true, 'needResponse');
    assert.ok(msg.id, 'has id');
    assert.ok(msg.timestamp, 'has timestamp');
    assert.ok(msg.communicationId, 'has communicationId');
  });

  test('buildResponse creates correct structure', () => {
    const resp = buildResponse('req-123', true, { result: 'ok' }, null);
    
    assert.equal(resp.requestId, 'req-123', 'requestId');
    assert.equal(resp.success, true, 'success');
    assert.deepEqual(resp.data, { result: 'ok' }, 'data');
    assert.equal(resp.error, null, 'no error');
  });

  test('buildHandshakeRequest sets correct action and needResponse', () => {
    const req = buildHandshakeRequest();
    
    assert.equal(req.action, MessageActions.HANDSHAKE, 'handshake action');
    assert.equal(req.needResponse, true, 'needs response');
    assert.ok(req.data.timestamp, 'has timestamp');
  });

  test('buildHandshakeResponse creates success response', () => {
    const resp = buildHandshakeResponse('req-456');
    
    assert.equal(resp.requestId, 'req-456', 'requestId');
    assert.equal(resp.success, true, 'success');
    assert.ok(resp.data.success, 'data.success');
  });

  test('isValidMessage validates correctly', () => {
    assert.equal(isValidMessage({ type: 'x', action: 'y' }), true, 'valid message');
    assert.equal(isValidMessage(null), false, 'null');
    assert.equal(isValidMessage({}), false, 'missing type');
    assert.equal(isValidMessage({ type: 'x' }), false, 'missing action');
  });

  test('parseMessage extracts all fields', () => {
    const parsed = parseMessage({
      type: 'vivim-bridge',
      communicationId: 'bridge-1',
      action: 'test',
      data: { foo: 'bar' },
      requestId: 'req-789',
      needResponse: true,
      success: true,
      error: null,
      timestamp: 1234567890
    });
    
    assert.equal(parsed.valid, true, 'valid');
    assert.equal(parsed.type, 'vivim-bridge', 'type');
    assert.equal(parsed.communicationId, 'bridge-1', 'communicationId');
    assert.equal(parsed.action, 'test', 'action');
    assert.deepEqual(parsed.data, { foo: 'bar' }, 'data');
    assert.equal(parsed.requestId, 'req-789', 'requestId');
    assert.equal(parsed.needResponse, true, 'needResponse');
    assert.equal(parsed.success, true, 'success');
  });

  test('parseMessage returns invalid for bad input', () => {
    assert.equal(parseMessage(null).valid, false, 'null');
    assert.equal(parseMessage('string').valid, false, 'string');
    assert.equal(parseMessage({ type: 'x' }).valid, false, 'missing action');
  });

  test('MessageActions has correct values', () => {
    assert.equal(MessageActions.HANDSHAKE, '__handshake__', 'handshake');
    assert.equal(MessageActions.PING, 'ping', 'ping');
    assert.equal(MessageActions.PONG, 'pong', 'pong');
    assert.equal(MessageActions.USER_PROMPT, 'userPrompt', 'userPrompt');
    assert.equal(MessageActions.CHAT_CHUNK, 'chatChunk', 'chatChunk');
  });

  test('MessageOrigins has correct values', () => {
    assert.equal(MessageOrigins.INJECT, 'inject', 'inject');
    assert.equal(MessageOrigins.CONTENT, 'content', 'content');
    assert.equal(MessageOrigins.BACKGROUND, 'background', 'background');
    assert.equal(MessageOrigins.SIDEPANEL, 'sidepanel', 'sidepanel');
  });
}