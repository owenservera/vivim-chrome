import { UILogic } from '../src/ui/UILogic.js';

export function runTests(test, assert) {
  test('UILogic initializes with defaults', () => {
    const ui = new UILogic();
    
    assert.equal(ui.currentProvider.id, 'chatgpt', 'default provider');
    assert.equal(ui.availableProviders.length, 3, '3 providers');
    assert.equal(ui.messageList.length, 0, 'empty messages');
  });

  test('switchProvider changes provider', () => {
    const ui = new UILogic();
    const newProvider = { id: 'claude', name: 'Claude', color: '#8B5CF6' };
    
    const result = ui.switchProvider(newProvider);
    
    assert.equal(ui.currentProvider.id, 'claude', 'provider changed');
    assert.equal(result.changed, true, 'change recorded');
    assert.equal(result.previous.id, 'chatgpt', 'previous recorded');
  });

  test('switchProvider returns unchanged for same provider', () => {
    const ui = new UILogic();
    const sameProvider = { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' };
    
    const result = ui.switchProvider(sameProvider);
    
    assert.equal(result.changed, false, 'not changed');
  });

  test('isValidProvider validates provider IDs', () => {
    const ui = new UILogic();
    
    assert.equal(ui.isValidProvider('chatgpt'), true, 'valid chatgpt');
    assert.equal(ui.isValidProvider('claude'), true, 'valid claude');
    assert.equal(ui.isValidProvider('gemini'), true, 'valid gemini');
    assert.equal(ui.isValidProvider('invalid'), false, 'invalid provider');
  });

  test('getProviderById returns provider', () => {
    const ui = new UILogic();
    
    const provider = ui.getProviderById('claude');
    assert.equal(provider.name, 'Claude', 'found claude');
    
    const missing = ui.getProviderById('nonexistent');
    assert.equal(missing, undefined, 'returns undefined for missing');
  });

  test('addMessage adds valid message', () => {
    const ui = new UILogic();
    
    const msg = ui.addMessage('user', 'Hello world', 'user', Date.now());
    
    assert.equal(ui.messageList.length, 1, 'message added');
    assert.equal(msg.role, 'user', 'role correct');
    assert.equal(msg.content, 'Hello world', 'content correct');
  });

  test('addMessage rejects invalid message', () => {
    const ui = new UILogic();
    
    assert.equal(ui.addMessage(null, 'test'), false, 'rejects null role');
    assert.equal(ui.addMessage('user', null), false, 'rejects null content');
    assert.equal(ui.addMessage('', 'test'), false, 'rejects empty role');
  });

  test('clearMessages clears all messages', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'test' }];
    
    const result = ui.clearMessages();
    
    assert.equal(ui.messageList.length, 0, 'messages cleared');
    assert.equal(result.cleared, true, 'cleared flag');
  });

  test('filterMessages returns matching messages', () => {
    const ui = new UILogic();
    ui.messageList = [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'world peace' }
    ];
    
    const results = ui.filterMessages('world');
    
    assert.equal(results.length, 2, '2 matches');
  });

  test('filterMessages returns all on empty query', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'test' }];
    
    const results = ui.filterMessages('');
    
    assert.equal(results.length, 1, 'returns all');
  });

  test('formatMessage escapes HTML', () => {
    const ui = new UILogic();
    
    const result = ui.formatMessage('<script>alert(1)</script>');
    
    assert.ok(!result.includes('<script>'), 'script tag escaped');
    assert.ok(result.includes('&lt;'), 'lt escaped');
  });

  test('formatMessage handles markdown', () => {
    const ui = new UILogic();
    
    const result = ui.formatMessage('**bold** *italic* `code`');
    
    assert.ok(result.includes('<strong>'), 'bold converted');
    assert.ok(result.includes('<em>'), 'italic converted');
    assert.ok(result.includes('<code>'), 'code converted');
  });

  test('formatMessage handles newlines', () => {
    const ui = new UILogic();
    
    const result = ui.formatMessage('line1\nline2');
    
    assert.ok(result.includes('<br>'), 'newlines converted');
  });

  test('escapeHtml escapes angle brackets', () => {
    const ui = new UILogic();
    
    const result = ui.escapeHtml('<div>test</div>');
    
    assert.ok(result.includes('&lt;'), 'lt escaped');
    assert.ok(result.includes('&gt;'), 'gt escaped');
  });

  test('prepareExport formats JSON', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'test' }];
    
    const result = ui.prepareExport('json');
    
    assert.ok(result.content.includes('"role"'), 'valid JSON');
    assert.equal(result.extension, 'json', 'correct extension');
    assert.equal(result.mimeType, 'application/json', 'correct MIME');
  });

  test('prepareExport formats Markdown', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'hello' }];
    
    const result = ui.prepareExport('md');
    
    assert.ok(result.content.includes('## User'), 'markdown headers');
    assert.equal(result.extension, 'md', 'correct extension');
  });

  test('prepareExport formats plain text', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'hello' }];
    
    const result = ui.prepareExport('txt');
    
    assert.ok(result.content.includes('User:'), 'plain text format');
    assert.equal(result.extension, 'txt', 'correct extension');
  });

  test('validateMessage validates correctly', () => {
    const ui = new UILogic();
    
    const valid = ui.validateMessage({ role: 'user', content: 'hello' });
    assert.equal(valid.valid, true, 'valid message');
    
    const noRole = ui.validateMessage({ content: 'hello' });
    assert.equal(noRole.valid, false, 'rejects missing role');
    
    const noContent = ui.validateMessage({ role: 'user' });
    assert.equal(noContent.valid, false, 'rejects missing content');
    
    const nullMsg = ui.validateMessage(null);
    assert.equal(nullMsg.valid, false, 'rejects null');
    
    const badRole = ui.validateMessage({ role: 'bot', content: 'test' });
    assert.equal(badRole.valid, false, 'rejects invalid role');
  });

  test('canSendPrompt works', () => {
    const ui = new UILogic();
    
    const ready = ui.canSendPrompt('hello', 123);
    assert.ok(ready.canSend, 'ready with text and tab');
    
    const noText = ui.canSendPrompt('', 123);
    assert.ok(!noText.canSend, 'blocked without text');
    
    const noTab = ui.canSendPrompt('hello', undefined);
    assert.ok(!noTab.canSend, 'blocked without tab');
  });

  test('search returns results with metadata', () => {
    const ui = new UILogic();
    ui.messageList = [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi' }
    ];
    
    const result = ui.search('world');
    
    assert.equal(result.count, 1, '1 result');
    assert.equal(result.results[0].content, 'Hello world', 'correct match');
    assert.equal(result.query, 'world', 'query recorded');
    assert.equal(result.total, 2, 'total tracked');
  });

  test('search returns all on empty query', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'test' }];
    
    const result = ui.search('');
    
    assert.equal(result.count, 1, 'returns all');
    assert.equal(result.query, '', 'empty query recorded');
  });

  test('getProviderMenuItems returns menu structure', () => {
    const ui = new UILogic();
    
    const items = ui.getProviderMenuItems();
    
    assert.equal(items.length, 3, '3 providers');
    assert.equal(items[0].isSelected, true, 'chatgpt selected');
    assert.equal(items[1].isSelected, false, 'claude not selected');
  });

  test('getState returns full state', () => {
    const ui = new UILogic();
    ui.messageList = [{ role: 'user', content: 'test' }];
    
    const state = ui.getState();
    
    assert.equal(state.currentProvider.id, 'chatgpt', 'provider included');
    assert.equal(state.messageCount, 1, 'message count included');
    assert.ok(Array.isArray(state.messages), 'messages array included');
  });

  test('loadState restores state', () => {
    const ui = new UILogic();
    
    ui.loadState({
      currentProvider: { id: 'gemini', name: 'Gemini', color: '#F59E0B' },
      messageList: [{ role: 'user', content: 'restored' }]
    });
    
    assert.equal(ui.currentProvider.id, 'gemini', 'provider restored');
    assert.equal(ui.messageList.length, 1, 'messages restored');
    assert.equal(ui.messageList[0].content, 'restored', 'content restored');
  });
}