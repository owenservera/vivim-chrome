/**
 * Parser Factory
 *
 * Fixes vs original:
 *   1. loadAndRegisterParsers() collects errors and surfaces them
 *   2. 'chatgpt-legacy' now registers as alias to delta-encoding-v1
 *   3. resetRegistry() added for test isolation
 *   4. detectFormat() aligned with registered keys
 *   5. createParser() accepts class directly
 */

import { BaseParser } from './BaseParser.js';

let parserClasses = {};

export function registerParser(format, ParserClass) {
  if (typeof format !== 'string' || !format) throw new Error('format must be a non-empty string');
  if (typeof ParserClass !== 'function')      throw new Error('ParserClass must be a constructor');
  parserClasses[format] = ParserClass;
}

export function unregisterParser(format) {
  delete parserClasses[format];
}

export function resetRegistry() {
  parserClasses = {};
}

export function getParser(format) {
  return parserClasses[format];
}

export function listFormats() {
  return Object.keys(parserClasses);
}

export function createParser(format, options = {}) {
  if (typeof format === 'function') {
    return new format(options);
  }

  const ParserClass = parserClasses[format];

  if (!ParserClass) {
    const available = Object.keys(parserClasses).join(', ') || '(none registered)';
    throw new Error(`Unknown format "${format}". Available: ${available}`);
  }

  return new ParserClass(options);
}

export async function loadAndRegisterParsers(opts = {}) {
  const { strict = false } = opts;

  const targets = [
    { format: 'openai-chat',       path: './OpenAIChatCompletionsParser.js', export: 'OpenAIChatCompletionsParser' },
    { format: 'openai-responses',  path: './ResponsesAPIParser.js',          export: 'ResponsesAPIParser' },
    { format: 'delta-encoding-v1', path: './DeltaEncodingV1Parser.js',       export: 'DeltaEncodingV1Parser' },
  ];

  const loaded = [];
  const failed = [];

  for (const { format, path, export: exportName } of targets) {
    try {
      const mod = await import(path);
      const Cls = mod[exportName] ?? mod.default;

      if (!Cls) throw new Error(`Module "${path}" does not export "${exportName}"`);

      registerParser(format, Cls);
      loaded.push(format);
    } catch (error) {
      failed.push({ format, error });
    }
  }

  if (parserClasses['delta-encoding-v1'] && !parserClasses['chatgpt-legacy']) {
    registerParser('chatgpt-legacy', parserClasses['delta-encoding-v1']);
    loaded.push('chatgpt-legacy');
  }

  if (strict && failed.length > 0) {
    const msgs = failed.map(f => `  ${f.format}: ${f.error.message}`).join('\n');
    throw new Error(`Failed to load parsers:\n${msgs}`);
  }

  return { loaded, failed };
}

export function detectFormat(sample) {
  let data;
  try {
    data = JSON.parse(sample);
  } catch {
    return 'openai-chat';
  }

  if (typeof data.type === 'string' && data.type.startsWith('response.')) {
    return 'openai-responses';
  }

  if (Array.isArray(data.choices)) {
    return 'openai-chat';
  }

  if (
    (data.o !== undefined && data.p !== undefined) ||
    (Array.isArray(data) && data.length > 0 &&
     data[0] && typeof data[0] === 'object' && data[0].o !== undefined)
  ) {
    return 'delta-encoding-v1';
  }

  if (data.message?.content?.parts) {
    return 'delta-encoding-v1';
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

  return 'openai-chat';
}

export default {
  registerParser,
  unregisterParser,
  resetRegistry,
  getParser,
  listFormats,
  createParser,
  loadAndRegisterParsers,
  detectFormat,
  detectFormatFromUrl,
};