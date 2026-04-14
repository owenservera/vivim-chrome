// Basic compliance and validation tests for VIVIM extension
// Run with: npm test

function validateUserPrompt(message) {
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('USER_PROMPT: invalid or missing content');
  }
  if (message.conversationId !== null && message.conversationId !== undefined && typeof message.conversationId !== 'string') {
    throw new Error('USER_PROMPT: invalid conversationId type');
  }
  if (message.timestamp && typeof message.timestamp !== 'number') {
    throw new Error('USER_PROMPT: invalid timestamp type');
  }
  return true;
}

function validateStreamChunk(message) {
  if (!message.role || typeof message.role !== 'string') {
    throw new Error('STREAM_CHUNK: invalid or missing role');
  }
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('STREAM_CHUNK: invalid or missing content');
  }
  if (message.model && typeof message.model !== 'string') {
    throw new Error('STREAM_CHUNK: invalid model type');
  }
  if (message.seq !== undefined && typeof message.seq !== 'number') {
    throw new Error('STREAM_CHUNK: invalid seq type');
  }
  return true;
}

function runTests() {
  console.log('🧪 Running VIVIM compliance tests...\n');

  const tests = [
    {
      name: 'Valid USER_PROMPT message',
      test: () => validateUserPrompt({ content: 'Hello world', conversationId: 'conv_123', timestamp: 1234567890 }),
      expected: true
    },
    {
      name: 'USER_PROMPT without conversationId',
      test: () => validateUserPrompt({ content: 'Hello world' }),
      expected: true
    },
    {
      name: 'Invalid USER_PROMPT - missing content',
      test: () => validateUserPrompt({ conversationId: 'conv_123' }),
      expected: false
    },
    {
      name: 'Invalid USER_PROMPT - wrong content type',
      test: () => validateUserPrompt({ content: 123 }),
      expected: false
    },
    {
      name: 'Valid STREAM_CHUNK message',
      test: () => validateStreamChunk({ role: 'assistant', content: 'Response text', model: 'gpt-4', seq: 1 }),
      expected: true
    },
    {
      name: 'Invalid STREAM_CHUNK - missing role',
      test: () => validateStreamChunk({ content: 'Response text' }),
      expected: false
    },
    {
      name: 'Invalid STREAM_CHUNK - wrong seq type',
      test: () => validateStreamChunk({ role: 'assistant', content: 'Response text', seq: '1' }),
      expected: false
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(testCase => {
    try {
      const result = testCase.test();
      if (result === testCase.expected) {
        console.log(`✅ ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name} - Unexpected result: ${result}`);
        failed++;
      }
    } catch (error) {
      if (testCase.expected === false) {
        console.log(`✅ ${testCase.name} - Correctly rejected: ${error.message}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name} - Unexpected error: ${error.message}`);
        failed++;
      }
    }
  });

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('💥 Some tests failed!');
    return false;
  }
}

// Run tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests, validateUserPrompt, validateStreamChunk };
} else {
  runTests();
}