import { Logger } from '../logging/Logger.js';

const DANGEROUS_TAGS = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'BASE', 'LINK', 'META', 'STYLE'];
const DANGEROUS_ATTRS = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'javascript:', 'data:'];
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'];

export class InputSanitizer {
  constructor(options = {}) {
    this.allowLists = options.allowLists || false;
    this.maxLength = options.maxLength || 100000;
    this.stripScripts = options.stripScripts !== false;
    this.logger = new Logger('InputSanitizer');
  }

  hashContent(content) {
    if (!content) return '';
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  normalizeWhitespace(content) {
    if (typeof content !== 'string') return '';
    return content.replace(/\s+/g, ' ').trim();
  }

  escapeHtml(content) {
    if (typeof content !== 'string') return '';
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return content.replace(/[&<>"'/]/g, char => escapeMap[char]);
  }

  unescapeHtml(content) {
    if (typeof content !== 'string') return '';
    const unescapeMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/'
    };
    return content.replace(/&(amp|lt|gt|quot|#x27|#x2F);/g, entity => unescapeMap[entity] || entity);
  }

  stripDangerousHtml(content) {
    if (typeof content !== 'string') return '';
    let result = content;

    for (const tag of DANGEROUS_TAGS) {
      const tagRegex = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
      result = result.replace(tagRegex, '');
    }

    for (const attr of DANGEROUS_ATTRS) {
      const attrRegex = new RegExp(`${attr}=['"][^'"]*['"]`, 'gi');
      result = result.replace(attrRegex, '');
    }

    return result;
  }

  sanitizeForStorage(content) {
    if (typeof content !== 'string') return '';
    let result = content;
    
    result = this.normalizeWhitespace(result);
    result = this.escapeHtml(result);
    result = this.stripDangerousHtml(result);
    
    if (result.length > this.maxLength) {
      result = result.substring(0, this.maxLength);
    }
    
    return result;
  }

  sanitizeForDisplay(content) {
    if (typeof content !== 'string') return '';
    let result = content;
    
    result = this.escapeHtml(result);
    
    if (!this.allowLists) {
      result = this.stripDangerousHtml(result);
    }
    
    return result;
  }

  validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  sanitizeUrl(url, defaultUrl = 'about:blank') {
    if (!url || typeof url !== 'string') return defaultUrl;
    
    try {
      const parsed = new URL(url);
      if (!DANGEROUS_PROTOCOLS.includes(parsed.protocol)) {
        return url;
      }
    } catch {}
    
    return defaultUrl;
  }

  checkHarmfulPatterns(content) {
    const harmfulPatterns = [
      /<script[\s>]/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /innerHTML\s*=/i,
      /document\.cookie/i,
      /window\.location/i
    ];
    
    for (const pattern of harmfulPatterns) {
      if (pattern.test(content)) {
        return { safe: false, pattern: pattern.source };
      }
    }
    
    return { safe: true };
  }

  sanitize(content, options = {}) {
    if (!content) return '';
    
    let result = content;
    
    if (options.mode === 'display') {
      result = this.sanitizeForDisplay(content);
    } else if (options.mode === 'storage') {
      result = this.sanitizeForStorage(content);
    } else if (options.mode === 'url') {
      result = this.sanitizeUrl(content);
    } else if (options.mode === 'strict') {
      result = this.stripDangerousHtml(content);
      result = this.escapeHtml(result);
    } else {
      result = this.sanitizeForStorage(content);
    }
    
    if (options.checkPatterns !== false) {
      const check = this.checkHarmfulPatterns(result);
      if (!check.safe) {
        this.logger.warn(`Harmful pattern detected: ${check.pattern}`);
      }
    }
    
    return result;
  }
}

export const sanitizer = new InputSanitizer();