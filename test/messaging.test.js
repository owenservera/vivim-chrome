import { MessageBus } from '../src/core/messaging/MessageBus.js';
import { MessageValidator } from '../src/core/messaging/MessageValidator.js';

export function runTests(test, assert) {
  test('MessageBus creates with empty state', () => {
    const bus = new MessageBus();
    
    assert.equal(bus.handlers.size, 0, 'no handlers');
    assert.equal(bus.middlewares.length, 0, 'no middlewares');
  });

  test('MessageBus registers handlers', () => {
    const bus = new MessageBus();
    
    const handler = (msg) => msg;
    bus.on('testMessage', handler);
    
    assert.equal(bus.handlers.has('testMessage'), true, 'handler registered');
  });

  test('MessageBus off removes handlers', () => {
    const bus = new MessageBus();
    
    const handler = (msg) => msg;
    bus.on('testMessage', handler);
    
    const handlerSet = bus.handlers.get('testMessage');
    bus.off('testMessage', handler);
    
    assert.equal(handlerSet.has(handler), false, 'handler removed from set');
  });

  test('MessageBus adds middlewares', () => {
    const bus = new MessageBus();
    
    const middleware = async (msg) => msg;
    bus.use(middleware);
    
    assert.equal(bus.middlewares.length, 1, 'middleware added');
  });

  test('MessageBus processes middlewares in order', async () => {
    const bus = new MessageBus();
    const order = [];
    
    bus.use(async (msg) => {
      order.push(1);
      return msg;
    });
    bus.use(async (msg) => {
      order.push(2);
      return msg;
    });
    
    const handler = async (msg) => {
      order.push(3);
      return msg;
    };
    bus.on('test', handler);
    
    await bus.emit({ type: 'test', data: 'test' });
    
    assert.deepEqual(order, [1, 2, 3], 'middlewares processed in order');
  });

  test('MessageValidator validates correct messages', () => {
    const validMsg = {
      type: 'test',
      data: { key: 'value' }
    };
    
    const result = MessageValidator.validateMessage(validMsg);
    
    assert.equal(result.valid, true, 'valid message');
  });

  test('MessageValidator rejects missing type', () => {
    const invalidMsg = { data: { key: 'value' } };
    
    const result = MessageValidator.validateMessage(invalidMsg);
    
    assert.equal(result.valid, false, 'invalid without type');
  });

  test('MessageValidator rejects null', () => {
    const result = MessageValidator.validateMessage(null);
    
    assert.equal(result.valid, false, 'invalid null');
  });
}