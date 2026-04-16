/**
 * WebBridge Tests
 */

import { WebBridge, createWebBridge, destroyWebBridge } from '../src/core/bridge/WebBridge.js';
import { MessageActions } from '../src/core/bridge/BridgeProtocol.js';

export function runTests(test, assert) {
  if (typeof window === 'undefined') {
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      postMessage: () => {}
    };
  }

  test('WebBridge creates with default options', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    assert.equal(bridge.isReady, false, 'not ready initially');
    assert.ok(bridge.options, 'has options');
    assert.equal(bridge.options.handshakeTimeout, 3000, 'default timeout');
  });

  test('WebBridge generates unique IDs', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    const id1 = bridge.generateId();
    const id2 = bridge.generateId();
    
    assert.ok(id1.length > 0, 'generates id');
    assert.notEqual(id1, id2, 'ids are unique');
  });

  test('WebBridge registers message handlers', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    let called = false;
    bridge.on('testAction', (data) => {
      called = true;
      return { result: 'ok' };
    });
    
    assert.equal(bridge.handlers.has('testAction'), true, 'handler registered');
  });

  test('WebBridge getStats returns correct structure', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    const stats = bridge.getStats();
    
    assert.ok(typeof stats.isReady === 'boolean', 'isReady');
    assert.ok(typeof stats.messageCount === 'number', 'messageCount');
    assert.ok(typeof stats.errorCount === 'number', 'errorCount');
    assert.ok(typeof stats.pendingRequests === 'number', 'pendingRequests');
    assert.ok(Array.isArray(stats.handlers), 'handlers is array');
    assert.ok(typeof stats.handshakeAttempts === 'number', 'handshakeAttempts');
  });

  test('WebBridge getHealth returns health status', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    const health = bridge.getHealth();
    
    assert.ok(health.health, 'has health value');
    assert.ok(typeof health.isReady === 'boolean', 'isReady');
    assert.ok(typeof health.isReconnecting === 'boolean', 'isReconnecting');
    assert.ok(typeof health.pendingRequests === 'number', 'pendingRequests');
    assert.ok(typeof health.errorRate === 'number', 'errorRate');
  });

  test('WebBridge destroy cleans up properly', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    bridge.on('test', () => {});
    
    bridge.destroy();
    
    assert.equal(bridge.handlers.size, 0, 'handlers cleared');
    assert.equal(bridge.pendingRequests.size, 0, 'pending cleared');
  });

  test('WebBridge getReady returns isReady status', () => {
    destroyWebBridge();
    const bridge = createWebBridge({ autoHandshake: false });
    
    assert.equal(bridge.getReady(), false, 'not ready');
  });
}