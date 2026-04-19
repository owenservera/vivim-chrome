/**
 * OpenAIChatCompletionsParser - Full Chat Completions SSE streaming
 */

import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';
import { ToolCallHandler } from '../handlers/ToolCallHandler.js';

export class OpenAIChatCompletionsParser extends BaseParser {
  constructor(options) {
    super(options);
    this.toolCallHandler = new ToolCallHandler();
    this.accumulator = null;
    this.accumulators = {};
    this.isMultiChoice = false;
    this.lastContent = '';
  }
  
  createAccumulator() {
    return new StreamAccumulator();
  }
  
  async parse(response) {
    await this.initialize();
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    let currentEvent = 'message';
    let eventData = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        let streamDone = false;
        for (const line of lines) {
          if (this.isCancelled) break;
          
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              streamDone = true;
              break;
            }
            
            eventData = eventData ? eventData + '\n' + data : data;
            
            try {
              JSON.parse(eventData); // Validates JSON
              await this.processEvent(currentEvent, eventData);
              eventData = ''; // Reset after successful parse
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Partial JSON, keep accumulating in eventData
              } else {
                this.logger.error('Error processing event:', e, eventData);
                eventData = ''; // Prevent infinite accumulation on logic errors
              }
            }
          }
        }
        if (streamDone) break;
      }
      
      this.handleComplete();
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('abort')) {
        this.logger.info(`Stream aborted (${error.message}), treating as complete to flush buffer`);
        this.handleComplete();
      } else {
        this.handleError(error);
      }
    }
  }
  
  async processEvent(eventType, data) {
    if (this.isStreamEnd(data)) {
      this.handleComplete();
      return;
    }
    
    try {
      const chunk = JSON.parse(data);
      
      if (this.isErrorChunk(chunk)) {
        const error = this.extractError(chunk);
        this.handleError(error);
        return;
      }
      
      await this.processChunk(chunk);
    } catch (error) {
      this.logger.debug(`Parse error: ${error.message}`);
    }
  }
  
  async processChunk(chunk) {
    if (!chunk.choices || chunk.choices.length === 0) {
      if (chunk.usage) {
        this.accumulator.usage = chunk.usage;
        this.emitChunk({
          type: 'usage',
          usage: chunk.usage,
          cumulative: true,
          isFinal: true
        });
      }
      return;
    }
    
    for (const choice of chunk.choices) {
      const idx = choice.index;
      
      let acc = this.accumulators[idx];
      if (!acc) {
        acc = new StreamAccumulator();
        this.accumulators[idx] = acc;
      }
      
      const delta = choice.delta || {};
      
      if (delta.role && acc.content === '' && acc.role === 'assistant') {
        this.transition(StreamState.ROLE_RECEIVED);
        acc.role = delta.role;
      }
      
      if (delta.content != null) {
        this.transition(StreamState.STREAMING);
        acc.content += delta.content;
      }
      
      if (delta.refusal != null) {
        this.transition(StreamState.STREAMING);
        acc.refusal = (acc.refusal || '') + delta.refusal;
      }
      
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        this.transition(StreamState.TOOL_CALLING);
        for (const tc of delta.tool_calls) {
          const tcIdx = tc.index;
          if (!acc.tool_calls[tcIdx]) {
            acc.tool_calls[tcIdx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } };
          }
          if (tc.id) acc.tool_calls[tcIdx].id = tc.id;
          if (tc.function?.name) acc.tool_calls[tcIdx].function.name += tc.function.name;
          if (tc.function?.arguments) acc.tool_calls[tcIdx].function.arguments += tc.function.arguments;
        }
      }
      
      if (choice.finish_reason) {
        this.transition(StreamState.FINISHING);
        acc.finish_reason = choice.finish_reason;
      }
      
      if (chunk.id && !acc.id) acc.id = chunk.id;
      if (chunk.model && !acc.model) acc.model = chunk.model;
    }
    
    if (chunk.system_fingerprint) {
      for (const acc of Object.values(this.accumulators)) {
        acc.system_fingerprint = chunk.system_fingerprint;
      }
    }
    
    if (!this.accumulator) {
      this.accumulator = this.accumulators[0] || new StreamAccumulator();
    }
    
    const count = Object.keys(this.accumulators).length;
    if (count > 1) this.isMultiChoice = true;
    
    if (this.isMultiChoice) {
      const messages = Object.entries(this.accumulators).map(([idx, acc]) => ({
        index: parseInt(idx),
        ...acc.toMessage()
      }));
      this.emitChunk({
        type: 'multi_content',
        choices: messages,
        count: count,
        cumulative: true,
        isFinal: this.accumulators[0]?.finish_reason !== null
      });
    } else {
      const acc = this.accumulators[0];
      if (acc) {
        const newContent = acc.content.slice(this.lastContent.length);
        this.lastContent = acc.content;
        if (newContent || delta?.tool_calls) {
          this.emitChunk({
            type: 'content',
            content: newContent,
            fullContent: acc.content,
            role: acc.role,
            model: acc.model,
            tool_calls: acc.tool_calls.filter(Boolean),
            finish_reason: acc.finish_reason,
            refusal: acc.refusal,
            cumulative: true,
            isFinal: acc.finish_reason !== null
          });
        }
      }
    }
  }
}

export default OpenAIChatCompletionsParser;