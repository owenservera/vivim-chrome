/**
 * ResponsesAPIParser - OpenAI Responses API streaming
 */

import { BaseParser, StreamState } from './BaseParser.js';

export const ResponsesEventType = {
  RESPONSE_CREATED: 'response.created',
  RESPONSE_QUEUED: 'response.queued',
  RESPONSE_IN_PROGRESS: 'response.in_progress',
  RESPONSE_COMPLETED: 'response.completed',
  RESPONSE_FAILED: 'response.failed',
  RESPONSE_INCOMPLETE: 'response.incomplete',
  OUTPUT_ITEM_ADDED: 'response.output_item.added',
  OUTPUT_ITEM_DONE: 'response.output_item.done',
  CONTENT_PART_ADDED: 'response.content_part.added',
  CONTENT_PART_DONE: 'response.content_part.done',
  OUTPUT_TEXT_DELTA: 'response.output_text.delta',
  OUTPUT_TEXT_DONE: 'response.output_text.done',
  OUTPUT_TEXT_ANNOTATION_ADDED: 'response.output_text.annotation.added',
  REFUSAL_DELTA: 'response.refusal.delta',
  REFUSAL_DONE: 'response.refusal.done',
  FUNCTION_CALL_ARGUMENTS_DELTA: 'response.function_call_arguments.delta',
  FUNCTION_CALL_ARGUMENTS_DONE: 'response.function_call_arguments.done',
  FILE_SEARCH_CALL_IN_PROGRESS: 'response.file_search_call.in_progress',
  FILE_SEARCH_CALL_SEARCHING: 'response.file_search_call.searching',
  FILE_SEARCH_CALL_COMPLETED: 'response.file_search_call.completed',
  WEB_SEARCH_CALL_IN_PROGRESS: 'response.web_search_call.in_progress',
  WEB_SEARCH_CALL_SEARCHING: 'response.web_search_call.searching',
  WEB_SEARCH_CALL_COMPLETED: 'response.web_search_call.completed',
  CODE_INTERPRETER_CALL_IN_PROGRESS: 'response.code_interpreter_call.in_progress',
  CODE_INTERPRETER_CALL_INTERPRETING: 'response.code_interpreter_call.interpreting',
  CODE_INTERPRETER_CALL_COMPLETED: 'response.code_interpreter_call.completed',
  REASONING_SUMMARY_TEXT_DELTA: 'response.reasoning_summary_text.delta',
  REASONING_SUMMARY_TEXT_DONE: 'response.reasoning_summary_text.done',
  MCP_LIST_TOOLS_IN_PROGRESS: 'response.mcp_list_tools.in_progress',
  MCP_LIST_TOOLS_COMPLETED: 'response.mcp_list_tools.completed',
  MCP_CALL_IN_PROGRESS: 'response.mcp_call.in_progress',
  MCP_CALL_COMPLETED: 'response.mcp_call.completed',
  ERROR: 'error'
};

export class ResponsesAPIParser extends BaseParser {
  constructor(options) {
    super(options);
    this.outputItems = new Map();
    this.currentItemId = null;
    this.contentBuffer = '';
    this.toolCallBuffer = '';
    this.reasoningBuffer = '';
    this.toolCalls = [];
    this.itemContent = [];
    this.currentContentIndex = 0;
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
    
    const event = JSON.parse(data);
    
    if (event.type === ResponsesEventType.ERROR) {
      this.handleError(new Error(event.message));
      return;
    }
    
    this.transitionForEvent(event.type);
    
    switch (event.type) {
      case ResponsesEventType.RESPONSE_CREATED:
        this.emitChunk({ type: 'created', response: event.response });
        break;
        
      case ResponsesEventType.OUTPUT_ITEM_ADDED:
        this.handleOutputItemAdded(event);
        break;
        
      case ResponsesEventType.OUTPUT_TEXT_DELTA:
        this.handleTextDelta(event);
        break;
        
      case ResponsesEventType.OUTPUT_TEXT_DONE:
        this.handleTextDone(event);
        break;
        
      case ResponsesEventType.FUNCTION_CALL_ARGUMENTS_DELTA:
        this.handleFunctionCallDelta(event);
        break;
        
      case ResponsesEventType.FUNCTION_CALL_ARGUMENTS_DONE:
        this.handleFunctionCallDone(event);
        break;
        
      case ResponsesEventType.REFUSAL_DELTA:
        this.handleRefusalDelta(event);
        break;
        
      case ResponsesEventType.FILE_SEARCH_CALL_IN_PROGRESS:
      case ResponsesEventType.FILE_SEARCH_CALL_SEARCHING:
      case ResponsesEventType.FILE_SEARCH_CALL_COMPLETED:
        this.emitChunk({ type: 'tool_progress', tool: 'file_search', status: event.type.split('.').pop(), event: event });
        break;
        
      case ResponsesEventType.WEB_SEARCH_CALL_IN_PROGRESS:
      case ResponsesEventType.WEB_SEARCH_CALL_SEARCHING:
      case ResponsesEventType.WEB_SEARCH_CALL_COMPLETED:
        this.emitChunk({ type: 'tool_progress', tool: 'web_search', status: event.type.split('.').pop(), event: event });
        break;
        
      case ResponsesEventType.CODE_INTERPRETER_CALL_IN_PROGRESS:
      case ResponsesEventType.CODE_INTERPRETER_CALL_INTERPRETING:
      case ResponsesEventType.CODE_INTERPRETER_CALL_COMPLETED:
        this.emitChunk({ type: 'tool_progress', tool: 'code_interpreter', status: event.type.split('.').pop(), event: event });
        break;
        
      case ResponsesEventType.REASONING_SUMMARY_TEXT_DELTA:
        this.handleReasoningDelta(event);
        break;
        
      case ResponsesEventType.REASONING_SUMMARY_TEXT_DONE:
        this.handleReasoningDone(event);
        break;
        
      case ResponsesEventType.RESPONSE_COMPLETED:
        this.emitChunk({ type: 'completed', response: event.response, isFinal: true });
        break;
        
      case ResponsesEventType.RESPONSE_FAILED:
        this.handleError(new Error(event.response?.error?.message || 'Response failed'));
        break;
    }
  }
  
  transitionForEvent(eventType) {
    if (eventType.includes('in_progress')) {
      this.transition(StreamState.STREAMING);
    } else if (eventType.includes('done') || eventType.includes('completed')) {
      this.transition(StreamState.FINISHING);
    }
  }
  
  handleOutputItemAdded(event) {
    this.currentItemId = event.item_id;
    this.outputItems.set(event.item_id, {
      id: event.item_id,
      type: event.item?.type,
      status: 'in_progress',
      content: []
    });
    this.currentContentIndex = 0;
    this.emitChunk({ type: 'item_added', item_id: event.item_id, item: event.item });
  }
  
  handleTextDelta(event) {
    this.contentBuffer += event.delta;
    this.emitChunk({
      type: 'content',
      content: event.delta,
      item_id: event.item_id,
      cumulative: this.contentBuffer,
      isDelta: true
    });
  }
  
  handleTextDone(event) {
    this.emitChunk({
      type: 'content_done',
      content: this.contentBuffer,
      item_id: event.item_id,
      isFinal: true
    });
    this.contentBuffer = '';
  }
  
  handleFunctionCallDelta(event) {
    this.toolCallBuffer += event.delta;
    this.emitChunk({
      type: 'tool_call_delta',
      tool_call_id: event.item_id,
      arguments: event.delta,
      cumulative: this.toolCallBuffer,
      isDelta: true
    });
  }
  
  handleFunctionCallDone(event) {
    const item = this.outputItems.get(event.item_id);
    if (item) {
      item.tool_call = { id: event.item_id, arguments: event.arguments };
    }
    this.emitChunk({
      type: 'tool_call_done',
      tool_call_id: event.item_id,
      arguments: event.arguments,
      isFinal: true
    });
    this.toolCallBuffer = '';
  }
  
  handleRefusalDelta(event) {
    this.emitChunk({
      type: 'refusal',
      content: event.delta,
      isDelta: true
    });
  }
  
  handleReasoningDelta(event) {
    this.reasoningBuffer += event.delta;
    this.emitChunk({
      type: 'reasoning',
      content: event.delta,
      cumulative: this.reasoningBuffer,
      isDelta: true
    });
  }
  
  handleReasoningDone(event) {
    this.emitChunk({
      type: 'reasoning_done',
      content: this.reasoningBuffer,
      isFinal: true
    });
    this.reasoningBuffer = '';
  }
  
  handleComplete() {
    const response = {
      items: Array.from(this.outputItems.values()),
      content: this.contentBuffer,
      tool_calls: this.toolCalls
    };
    this.emitChunk({ type: 'complete', response, isFinal: true });
    super.handleComplete();
  }
}

export default ResponsesAPIParser;