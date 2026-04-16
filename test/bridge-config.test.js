/**
 * BridgeConfig Tests
 */

import { BridgeConfig, getBridgeConfig, resetBridgeConfig } from '../src/core/bridge/BridgeConfig.js';

export function runTests(test, assert) {
  // Reset before tests
  resetBridgeConfig();

  test('BridgeConfig should have correct default values', () => {
    const config = getBridgeConfig();
    assert.equal(config.selfId, 'vivim-bridge', 'selfId');
    assert.equal(config.contentId, 'vivim-content', 'contentId');
    assert.equal(config.injectId, 'vivim-inject', 'injectId');
    assert.equal(config.handshakeTimeout, 3000, 'handshakeTimeout');
    assert.equal(config.requestTimeout, 30000, 'requestTimeout');
    assert.equal(config.messageType, 'vivim-bridge', 'messageType');
  });

  test('BridgeConfig should merge user config', () => {
    resetBridgeConfig();
    const config = new BridgeConfig({
      communication: { selfId: 'custom-bridge' }
    });
    assert.equal(config.selfId, 'custom-bridge', 'custom selfId');
    assert.equal(config.contentId, 'vivim-content', 'default contentId preserved');
  });

  test('BridgeConfig should provide provider patterns', () => {
    const config = getBridgeConfig();
    const chatgptPattern = config.getProviderPattern('chatgpt');
    assert.ok(chatgptPattern, 'chatgpt pattern exists');
    assert.ok(chatgptPattern.request, 'has request regex');
  });

  test('BridgeConfig.isProviderEnabled works correctly', () => {
    const config = getBridgeConfig();
    assert.equal(config.isProviderEnabled('chatgpt'), true, 'chatgpt enabled');
    assert.equal(config.isProviderEnabled('claude'), true, 'claude enabled');
    assert.equal(config.isProviderEnabled('unknown'), false, 'unknown not enabled');
  });
}