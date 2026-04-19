/**
 * ChatGPT Streaming Test Scenarios
 * Automated tests to reproduce and validate streaming issues
 */

import { Logger } from '../../core/logging/Logger.js';

export class ChatGPTStreamingTestScenarios {
  constructor(chatGPTProvider) {
    this.provider = chatGPTProvider;
    this.logger = new Logger('ChatGPTStreamingTestScenarios');
    this.testResults = [];
  }

  /**
   * Run all test scenarios
   */
  async runAllScenarios() {
    this.logger.info('Starting ChatGPT streaming test scenarios');

    const scenarios = [
      this.testSimplePrompt.bind(this),
      this.testComplexPrompt.bind(this),
      this.testToolUsingPrompt.bind(this),
      this.testTitleGeneration.bind(this),
      this.testEmptyResponse.bind(this),
      this.testArrayPatchFormat.bind(this)
    ];

    for (const scenario of scenarios) {
      try {
        const result = await scenario();
        this.testResults.push(result);
        this.logger.info(`Scenario completed: ${result.name} - ${result.passed ? 'PASSED' : 'FAILED'}`);
      } catch (error) {
        this.logger.error(`Scenario failed: ${error.message}`);
        this.testResults.push({
          name: scenario.name,
          passed: false,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    return this.generateReport();
  }

  /**
   * Test simple prompt streaming
   */
  async testSimplePrompt() {
    const scenario = {
      name: 'simple_prompt',
      description: 'Test basic streaming with a simple prompt',
      prompt: 'Hello, how are you?',
      expected: {
        shouldStream: true,
        minChunks: 1,
        maxEmptyBubbles: 0
      }
    };

    // Simulate interception and processing
    const mockCtx = this.createMockContext(scenario.prompt, 'simple');
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Test complex prompt with reasoning
   */
  async testComplexPrompt() {
    const scenario = {
      name: 'complex_prompt',
      description: 'Test streaming with a complex analytical prompt',
      prompt: 'Analyze the current state of AI development and provide detailed insights about the major trends, challenges, and future directions.',
      expected: {
        shouldStream: true,
        minChunks: 5,
        maxEmptyBubbles: 0,
        shouldContainReasoning: true
      }
    };

    const mockCtx = this.createMockContext(scenario.prompt, 'complex');
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Test tool-using prompt
   */
  async testToolUsingPrompt() {
    const scenario = {
      name: 'tool_using_prompt',
      description: 'Test streaming when ChatGPT uses tools/functions',
      prompt: 'What is the current weather in New York? Please check using available tools.',
      expected: {
        shouldStream: true,
        mayUseTools: true,
        maxEmptyBubbles: 0
      }
    };

    const mockCtx = this.createMockContext(scenario.prompt, 'tool');
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Test title generation (non-streaming response)
   */
  async testTitleGeneration() {
    const scenario = {
      name: 'title_generation',
      description: 'Test that title generation requests are properly filtered out',
      prompt: 'Generate a title for our conversation',
      expected: {
        shouldStream: false, // Title generation is not streaming
        shouldBeFiltered: true,
        maxEmptyBubbles: 0
      }
    };

    const mockCtx = this.createMockContext(scenario.prompt, 'title', false); // Not streaming
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Test handling of empty responses
   */
  async testEmptyResponse() {
    const scenario = {
      name: 'empty_response',
      description: 'Test handling of empty or malformed responses',
      prompt: 'Respond with nothing',
      expected: {
        shouldStream: true,
        mayBeEmpty: true,
        maxEmptyBubbles: 1 // Allow one empty bubble for truly empty responses
      }
    };

    const mockCtx = this.createMockContext(scenario.prompt, 'empty');
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Test array-based JSON patch format
   */
  async testArrayPatchFormat() {
    const scenario = {
      name: 'array_patch_format',
      description: 'Test handling of array-based JSON patches',
      prompt: 'Test array patch handling',
      expected: {
        shouldStream: true,
        usesArrayPatches: true,
        minChunks: 1
      }
    };

    const mockCtx = this.createMockContext(scenario.prompt, 'array');
    // Force array-based response format
    mockCtx.response.format = 'array';
    await this.simulateProviderResponse(mockCtx);

    return {
      ...scenario,
      passed: this.validateScenario(scenario, mockCtx),
      actual: this.extractActualResults(mockCtx),
      timestamp: Date.now()
    };
  }

  /**
   * Create mock context for testing
   */
  createMockContext(prompt, type, isStreaming = true) {
    return {
      url: `https://chatgpt.com/backend-api/conversation?type=${type}`,
      method: 'POST',
      body: JSON.stringify({ prompt }),
      response: {
        status: 200,
        headers: new Map([
          ['content-type', isStreaming ? 'text/event-stream' : 'application/json'],
          ['cache-control', 'no-cache']
        ]),
        clone: () => ({
          body: {
            getReader: () => this.createMockStreamReader(type, isStreaming)
          }
        })
      },
      chunks: [],
      errors: [],
      filtered: false,
      startTime: Date.now()
    };
  }

  /**
   * Create mock stream reader for testing
   */
  createMockStreamReader(type, isStreaming) {
    let chunks = [];
    let index = 0;

    if (!isStreaming) {
      // Non-streaming response
      chunks = ['{"title": "Test Conversation"}'];
    } else {
      // Streaming responses based on type
      switch (type) {
        case 'simple':
          chunks = [
            'event: delta\ndata: {"o": "patch", "p": "/message/content/parts/0", "v": "Hello!"}',
            'event: delta\ndata: {"o": "patch", "p": "/message/content/parts/0", "v": " I\'m doing well, thank you!"}',
            'event: delta\ndata: [DONE]'
          ];
          break;
        case 'complex':
          chunks = [
            'event: delta\ndata: {"o": "patch", "p": "/message/content/parts/0", "v": "The field of AI development"}',
            'event: delta\ndata: [{"o": "patch", "p": "/message/content/parts/0", "v": " is rapidly evolving"}]',
            'event: delta\ndata: {"o": "patch", "p": "/message/content/parts/0", "v": " with several major trends..."}',
            'event: delta\ndata: [DONE]'
          ];
          break;
        case 'array':
          chunks = [
            'event: delta_encoding\ndata: [{"o": "patch", "p": "/message/content/parts/0", "v": "Array format"}]',
            'event: delta_encoding\ndata: [{"o": "patch", "p": "/message/content/parts/0", "v": " test completed"}]',
            'event: delta\ndata: [DONE]'
          ];
          break;
        default:
          chunks = [
            'event: delta\ndata: {"o": "patch", "p": "/message/content/parts/0", "v": "Test response"}',
            'event: delta\ndata: [DONE]'
          ];
      }
    }

    return {
      read: async () => {
        if (index >= chunks.length) {
          return { done: true };
        }

        const chunk = chunks[index++];
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(chunk + '\n');

        return {
          done: false,
          value: uint8Array
        };
      }
    };
  }

  /**
   * Simulate provider response processing
   */
  async simulateProviderResponse(ctx) {
    try {
      // Override sendToBridge to capture chunks
      const originalSendToBridge = this.provider.sendToBridge.bind(this.provider);
      this.provider.sendToBridge = (action, data) => {
        if (action === 'chatChunk') {
          ctx.chunks.push(data);
        } else if (action === 'streamComplete' && data.error) {
          ctx.errors.push(data.error);
        }
        originalSendToBridge(action, data);
      };

      await this.provider.onResponse(ctx);
    } catch (error) {
      ctx.errors.push(error.message);
      this.logger.error(`Error in simulateProviderResponse: ${error.message}`);
    }
  }

  /**
   * Validate scenario results
   */
  validateScenario(scenario, ctx) {
    const actual = this.extractActualResults(ctx);

    // Check if response was properly filtered for non-streaming
    if (scenario.expected.shouldBeFiltered && ctx.filtered) {
      return true;
    }

    // Check streaming expectations
    if (scenario.expected.shouldStream && !actual.didStream) {
      return false;
    }

    // Check minimum chunks
    if (scenario.expected.minChunks && actual.chunkCount < scenario.expected.minChunks) {
      return false;
    }

    // Check empty bubbles
    if (scenario.expected.maxEmptyBubbles !== undefined &&
        actual.emptyBubbles > scenario.expected.maxEmptyBubbles) {
      return false;
    }

    // Check for errors
    if (actual.errors.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Extract actual results from context
   */
  extractActualResults(ctx) {
    const emptyBubbles = ctx.chunks.filter(chunk =>
      !chunk.content || chunk.content.trim().length === 0
    ).length;

    return {
      didStream: ctx.chunks.length > 0,
      chunkCount: ctx.chunks.length,
      emptyBubbles,
      errors: ctx.errors,
      totalContentLength: ctx.chunks.reduce((sum, chunk) => sum + (chunk.content?.length || 0), 0),
      duration: Date.now() - ctx.startTime
    };
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    return {
      summary: {
        total,
        passed,
        failed,
        successRate: (passed / total) * 100,
        timestamp: Date.now()
      },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];

    const failedScenarios = this.testResults.filter(r => !r.passed);

    if (failedScenarios.some(s => s.name.includes('array'))) {
      recommendations.push({
        issue: 'Array-based JSON patches not handled correctly',
        action: 'Update DeltaEncodingV1Parser.processDeltaEncodingPayload() to properly iterate through array patches',
        priority: 'high'
      });
    }

    if (failedScenarios.some(s => s.actual?.emptyBubbles > 0)) {
      recommendations.push({
        issue: 'Empty bubbles being generated',
        action: 'Implement content-type filtering in ChatGPTProvider.onResponse() to skip non-streaming responses',
        priority: 'high'
      });
    }

    if (failedScenarios.some(s => s.actual?.errors?.length > 0)) {
      recommendations.push({
        issue: 'Streaming errors occurring',
        action: 'Add comprehensive error handling and recovery in StreamingManager',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Export test results for analysis
   */
  exportResults() {
    return {
      testRun: {
        id: `test-run-${Date.now()}`,
        timestamp: Date.now(),
        version: '1.0'
      },
      results: this.testResults,
      studyIntegration: {
        dataFeedStudyEnabled: !!this.provider.dataFeedStudy,
        studySessionId: this.provider.dataFeedStudy?.sessionId
      }
    };
  }
}

export default ChatGPTStreamingTestScenarios;