/**
 * Parser Factory - Creates appropriate parser based on format
 */

import { BaseParser } from './BaseParser.js';

let parserClasses = {};

export function registerParser(format, ParserClass) {
  parserClasses[format] = ParserClass;
}

export function getParser(format) {
  return parserClasses[format];
}

export function listFormats() {
  return Object.keys(parserClasses);
}

export function createParser(format, options) {
  const ParserClass = parserClasses[format];
  
  if (!ParserClass) {
    const available = Object.keys(parserClasses).join(', ');
    throw new Error(`Unknown format "${format}". Available: ${available}`);
  }
  
  return new ParserClass(options);
}

export async function loadAndRegisterParsers() {
  try {
    const { OpenAIChatCompletionsParser } = await import('./OpenAIChatCompletionsParser.js');
    registerParser('openai-chat', OpenAIChatCompletionsParser);
  } catch (e) {}
  
  try {
    const { ResponsesAPIParser } = await import('./ResponsesAPIParser.js');
    registerParser('openai-responses', ResponsesAPIParser);
  } catch (e) {}
  
  try {
    const { DeltaEncodingV1Parser } = await import('./DeltaEncodingV1Parser.js');
    registerParser('delta-encoding-v1', DeltaEncodingV1Parser);
  } catch (e) {}
}

export function detectFormat(sample) {
  try {
    const data = JSON.parse(sample);
    
    if (data.type?.startsWith?.('response.')) {
      return 'openai-responses';
    }
    
    if (data.choices && Array.isArray(data.choices)) {
      return 'openai-chat';
    }
    
    if (data.o !== undefined || data.p !== undefined) {
      return 'delta-encoding-v1';
    }
    
    if (data.message?.content?.parts || data.delta) {
      return 'chatgpt-legacy';
    }
  } catch {
  }
  
  return 'openai-chat';
}

export function detectFormatFromUrl(url) {
  if (!url) return 'openai-chat';
  
  if (url.includes('chatgpt.com') || url.includes('chat.com')) {
    return 'delta-encoding-v1';
  }
  
  if (url.includes('/v1/responses')) {
    return 'openai-responses';
  }
  
  if (url.includes('/v1/chat')) {
    return 'openai-chat';
  }
  
  return 'openai-chat';
}

export default {
  registerParser,
  getParser,
  listFormats,
  createParser,
  loadAndRegisterParsers,
  detectFormat,
  detectFormatFromUrl
};