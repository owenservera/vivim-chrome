/**
 * StorageManager Tests
 */

import { StorageManager } from '../src/core/storage/StorageManager.js';

export function runTests(test, assert) {
  const mockStorage = {
    data: {},
    get: function(keys, callback) {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        if (this.data[k] !== undefined) {
          result[k] = this.data[k];
        }
      }
      callback(result);
    },
    set: function(items, callback) {
      Object.assign(this.data, items);
      callback();
    },
    remove: function(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        delete this.data[k];
      }
      callback();
    },
    clear: function(callback) {
      this.data = {};
      callback();
    }
  };

  test('StorageManager initializes with storage interface', () => {
    const storage = new StorageManager(mockStorage);
    
    assert.ok(storage, 'created');
  });

  test('StorageManager get retrieves stored data', async () => {
    const storage = new StorageManager(mockStorage);
    mockStorage.data['testKey'] = 'testValue';
    
    const result = await storage.get('testKey');
    
    assert.equal(result, 'testValue', 'retrieved value');
  });

  test('StorageManager set stores data', async () => {
    const storage = new StorageManager(mockStorage);
    
    await storage.set('newKey', 'newValue');
    
    assert.equal(mockStorage.data['newKey'], 'newValue', 'stored');
  });

  test('StorageManager remove deletes data', async () => {
    const storage = new StorageManager(mockStorage);
    mockStorage.data['toRemove'] = 'value';
    
    await storage.remove('toRemove');
    
    assert.equal(mockStorage.data['toRemove'], undefined, 'removed');
  });

  test('StorageManager clear removes all data', async () => {
    const storage = new StorageManager(mockStorage);
    mockStorage.data = { a: 1, b: 2 };
    
    await storage.clear();
    
    assert.deepEqual(mockStorage.data, {}, 'cleared');
  });

  test('StorageManager getMultiple retrieves multiple keys', async () => {
    const storage = new StorageManager(mockStorage);
    mockStorage.data = { key1: 'val1', key2: 'val2' };
    
    const result = await storage.getMultiple(['key1', 'key2']);
    
    assert.deepEqual(result, { key1: 'val1', key2: 'val2' }, 'multiple retrieved');
  });

  test('StorageManager setMultiple stores multiple items', async () => {
    const storage = new StorageManager(mockStorage);
    
    await storage.setMultiple({ k1: 'v1', k2: 'v2' });
    
    assert.equal(mockStorage.data['k1'], 'v1', 'first stored');
    assert.equal(mockStorage.data['k2'], 'v2', 'second stored');
  });
}