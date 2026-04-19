/**
 * Enhanced Debug Manager - Comprehensive debugging infrastructure
 * Captures connection issues, SSE streams, performance metrics, and errors
 */
import { Logger } from '../logging/Logger.js';

export class DebugManager {
  constructor(options = {}) {
    this.logger = new Logger('DebugManager');
    this.enabled = options.enabled !== false;
    this.maxEntries = options.maxEntries || 1000;
    this.entries = [];
    this.filters = new Set(['all']);
    this.capturedEvents = new Map();
    this.performanceMonitor = new PerformanceMonitor();
    this.errorTracker = new ErrorTracker();
    this.streamCapture = new StreamCapture();
    this.connectionMonitor = new ConnectionMonitor();
    this.persistenceEnabled = options.persistence !== false;
    this.storageKey = options.storageKey || 'vivim_debug_data';
    this.autoSaveInterval = options.autoSaveInterval || 30000; // 30 seconds

    // Bind methods for external use
    this.captureEvent = this.captureEvent.bind(this);
    this.captureError = this.captureError.bind(this);
    this.captureStreamEvent = this.captureStreamEvent.bind(this);
    this.captureConnectionEvent = this.captureConnectionEvent.bind(this);

    // Initialize persistence
    if (this.persistenceEnabled) {
      this.loadPersistedData();
      this.startAutoSave();
    }
  }

  /**
   * Enable/disable debugging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.logger.info('Debug manager enabled');
    } else {
      this.logger.info('Debug manager disabled');
      this.clear();
    }
  }

  /**
   * Capture a debug event
   */
  captureEvent(type, data, metadata = {}) {
    if (!this.enabled) return;

    const entry = {
      id: this.generateId(),
      type,
      timestamp: Date.now(),
      iso: new Date().toISOString(),
      data: this.sanitizeData(data),
      metadata: { ...metadata },
      category: this.categorizeEvent(type),
      severity: this.assessSeverity(type, data)
    };

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    // Update captured events count
    const count = this.capturedEvents.get(type) || 0;
    this.capturedEvents.set(type, count + 1);

    this.logger.debug(`Captured ${type} event:`, entry.id);
  }

  /**
   * Capture error with enhanced tracking
   */
  captureError(error, context = {}) {
    if (!this.enabled) return;

    const errorEntry = this.errorTracker.trackError(error, context);
    this.captureEvent('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...errorEntry
    }, {
      context,
      recoverable: this.errorTracker.isRecoverableError(error),
      category: 'error'
    });
  }

  /**
   * Capture SSE stream events
   */
  captureStreamEvent(eventType, data, streamId) {
    if (!this.enabled) return;

    const streamData = this.streamCapture.processEvent(eventType, data, streamId);
    this.captureEvent(`stream:${eventType}`, streamData, {
      streamId,
      category: 'stream'
    });
  }

  captureSSEBuffer(streamId, buffer, metadata = {}) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.rawBuffer = buffer;
      stream.lastUpdate = Date.now();
    }
  }

  captureJSONParse(streamId, raw, parsed, success, duration = 0) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.parseEvents = stream.parseEvents || [];
      stream.parseEvents.push({
        raw: raw?.substring?.(0, 500) || raw,
        success,
        duration,
        timestamp: Date.now()
      });
    }
  }

  captureDelta(streamId, delta, cumulative, seq) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.chunks = stream.chunks || [];
      stream.chunks.push({ delta, cumulative, seq, timestamp: Date.now() });
      stream.chunksReceived = (stream.chunksReceived || 0) + 1;
    }
  }

  captureStateTransition(streamId, fromState, toState) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.stateTransitions = stream.stateTransitions || [];
      stream.stateTransitions.push({ from: fromState, to: toState, timestamp: Date.now() });
      stream.currentState = toState;
    }
  }

  captureToolCall(streamId, toolCall, status) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.toolCalls = stream.toolCalls || [];
      const existing = stream.toolCalls.find(tc => tc.id === toolCall.id);
      if (existing) {
        existing.status = status;
        existing.function = toolCall.function;
      } else {
        stream.toolCalls.push({ ...toolCall, status, index: stream.toolCalls.length });
      }
    }
  }

  captureAccumulator(streamId, accumulator) {
    if (!this.enabled) return;
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.accumulator = { ...accumulator };
    }
  }

  getStreamById(streamId) {
    return this.streamCapture.streams.get(streamId);
  }

  getStreamChunks(streamId) {
    const stream = this.streamCapture.streams.get(streamId);
    return stream?.chunks || [];
  }

  resetStreamPlayback(streamId) {
    const stream = this.streamCapture.streams.get(streamId);
    if (stream) {
      stream.playbackIndex = 0;
    }
  }

  /**
   * Capture connection-related events
   */
  captureConnectionEvent(eventType, data, provider) {
    if (!this.enabled) return;

    const connectionData = this.connectionMonitor.processEvent(eventType, data, provider);
    this.captureEvent(`connection:${eventType}`, connectionData, {
      provider,
      category: 'connection'
    });
  }

  /**
   * Capture performance metrics
   */
  capturePerformanceMetric(metric, value, context = {}) {
    if (!this.enabled) return;

    const perfData = this.performanceMonitor.recordMetric(metric, value, context);
    this.captureEvent('performance', perfData, {
      metric,
      category: 'performance'
    });
  }

  /**
   * Get filtered entries
   */
  getEntries(filter = 'all', limit = 100) {
    let filtered = this.entries;

    if (filter !== 'all') {
      if (filter === 'errors') {
        filtered = this.entries.filter(e => e.category === 'error');
      } else if (filter === 'streams') {
        filtered = this.entries.filter(e => e.category === 'stream');
      } else if (filter === 'connections') {
        filtered = this.entries.filter(e => e.category === 'connection');
      } else if (filter === 'performance') {
        filtered = this.entries.filter(e => e.category === 'performance');
      } else {
        filtered = this.entries.filter(e => e.type === filter);
      }
    }

    return filtered.slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const stats = {
      totalEntries: this.entries.length,
      eventsByType: Object.fromEntries(this.capturedEvents),
      errors: this.errorTracker.getStats(),
      streams: this.streamCapture.getStats(),
      connections: this.connectionMonitor.getStats(),
      performance: this.performanceMonitor.getStats(),
      timeRange: {
        oldest: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : null,
        newest: this.entries.length > 0 ? this.entries[0].timestamp : null
      }
    };
    return stats;
  }

  /**
   * Export debug data
   */
  exportData(format = 'json') {
    const data = {
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      entries: this.entries
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Simple text format
    return this.entries.map(entry =>
      `[${entry.type.toUpperCase()}] ${new Date(entry.timestamp).toISOString()}\n${JSON.stringify(entry.data, null, 2)}`
    ).join('\n\n---\n\n');
  }

  /**
   * Clear all debug data
   */
  clear() {
    this.entries = [];
    this.capturedEvents.clear();
    this.errorTracker.clear();
    this.streamCapture.clear();
    this.connectionMonitor.clear();
    this.performanceMonitor.clear();

    // Clear persisted data
    if (this.persistenceEnabled && typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(this.storageKey).catch(err =>
        this.logger.warn('Failed to clear persisted debug data:', err)
      );
    }

    this.logger.info('Debug data cleared');
  }

  /**
   * Load persisted debug data
   */
  async loadPersistedData() {
    if (!this.persistenceEnabled || typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const persistedData = result[this.storageKey];

      if (persistedData && persistedData.entries) {
        // Filter out old entries (older than 24 hours)
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        const validEntries = persistedData.entries.filter(entry =>
          entry.timestamp > cutoffTime
        );

        this.entries = validEntries.slice(-this.maxEntries);
        this.logger.info(`Loaded ${this.entries.length} persisted debug entries`);
      }
    } catch (error) {
      this.logger.warn('Failed to load persisted debug data:', error);
    }
  }

  /**
   * Save debug data to persistent storage
   */
  async savePersistedData() {
    if (!this.persistenceEnabled || typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    try {
      const dataToPersist = {
        entries: this.entries.slice(-500), // Keep only last 500 entries for storage efficiency
        timestamp: Date.now(),
        version: '1.0'
      };

      await chrome.storage.local.set({ [this.storageKey]: dataToPersist });
      this.logger.debug('Debug data persisted successfully');
    } catch (error) {
      this.logger.warn('Failed to persist debug data:', error);
    }
  }

  /**
   * Start automatic saving
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.entries.length > 0) {
        this.savePersistedData();
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop automatic saving
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Import debug data from external source
   */
  importData(data) {
    try {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      if (data.entries && Array.isArray(data.entries)) {
        // Merge with existing entries, avoiding duplicates
        const existingIds = new Set(this.entries.map(e => e.id));
        const newEntries = data.entries.filter(e => !existingIds.has(e.id));

        this.entries = [...this.entries, ...newEntries].slice(-this.maxEntries);

        // Rebuild captured events count
        this.capturedEvents.clear();
        this.entries.forEach(entry => {
          const count = this.capturedEvents.get(entry.type) || 0;
          this.capturedEvents.set(entry.type, count + 1);
        });

        this.logger.info(`Imported ${newEntries.length} debug entries`);
        return { success: true, imported: newEntries.length };
      }
    } catch (error) {
      this.logger.error('Failed to import debug data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export debug data with metadata
   */
  exportDataEnhanced(format = 'json') {
    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      stats: this.getStats(),
      entries: this.entries,
      metadata: {
        persistenceEnabled: this.persistenceEnabled,
        maxEntries: this.maxEntries,
        totalCapturedEvents: Array.from(this.capturedEvents.values()).reduce((a, b) => a + b, 0)
      }
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Enhanced text format with better formatting
    return `# VIVIM Enhanced Debug Export
# Generated: ${data.exportedAt}
# Total Events: ${data.stats.totalEntries}
# Errors: ${data.stats.errors.total}
# Active Streams: ${data.stats.streams.activeStreams}

${data.entries.map(entry => `---
[${entry.type.toUpperCase()}] ${new Date(entry.timestamp).toISOString()}
Category: ${entry.category} | Severity: ${entry.severity}
${JSON.stringify(entry.data, null, 2)}
${entry.metadata ? `Metadata: ${JSON.stringify(entry.metadata)}` : ''}
---`).join('\n\n')}`;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Sanitize data for storage
   */
  sanitizeData(data) {
    if (!data) return data;

    // Convert to plain object if needed
    if (data instanceof Error) {
      return {
        message: data.message,
        stack: data.stack,
        name: data.name
      };
    }

    if (typeof data === 'object') {
      // Deep clone and sanitize
      try {
        return JSON.parse(JSON.stringify(data, (key, value) => {
          // Remove circular references and large objects
          if (typeof value === 'object' && value !== null) {
            if (value.constructor && value.constructor.name === 'Response') {
              return '[Response object]';
            }
            if (value.constructor && value.constructor.name === 'Request') {
              return '[Request object]';
            }
          }
          return value;
        }));
      } catch (e) {
        return { error: 'Could not serialize data', type: typeof data };
      }
    }

    return data;
  }

  /**
   * Categorize event type
   */
  categorizeEvent(type) {
    if (type.includes('error') || type.includes('fail')) return 'error';
    if (type.includes('stream')) return 'stream';
    if (type.includes('connect') || type.includes('auth') || type.includes('network')) return 'connection';
    if (type.includes('perf') || type.includes('metric')) return 'performance';
    return 'general';
  }

  /**
   * Assess severity of event
   */
  assessSeverity(type, data) {
    if (type.includes('error') || type.includes('fail')) return 'error';
    if (type.includes('warn')) return 'warning';
    return 'info';
  }
}

/**
 * Performance Monitor - Tracks timing and metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
  }

  startTimer(name, context = {}) {
    this.timers.set(name, {
      start: performance.now(),
      context
    });
  }

  endTimer(name) {
    const timer = this.timers.get(name);
    if (!timer) return null;

    const duration = performance.now() - timer.start;
    this.timers.delete(name);

    this.recordMetric(`${name}_duration`, duration, timer.context);
    return duration;
  }

  recordMetric(name, value, context = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      context
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(metric);

    // Keep only last 100 values
    const values = this.metrics.get(name);
    if (values.length > 100) {
      values.shift();
    }

    return metric;
  }

  getStats() {
    const stats = {};
    for (const [name, values] of this.metrics) {
      const nums = values.map(v => v.value);
      stats[name] = {
        count: nums.length,
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        latest: nums[nums.length - 1]
      };
    }
    return stats;
  }

  clear() {
    this.metrics.clear();
    this.timers.clear();
  }
}

/**
 * Error Tracker - Categorizes and tracks errors
 */
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.errorPatterns = new Map();
  }

  trackError(error, context = {}) {
    const errorEntry = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      timestamp: Date.now(),
      context,
      recoverable: this.isRecoverableError(error),
      category: this.categorizeError(error),
      frequency: 1
    };

    // Check for similar errors
    const pattern = this.getErrorPattern(error);
    if (this.errorPatterns.has(pattern)) {
      const existing = this.errorPatterns.get(pattern);
      existing.frequency++;
      existing.lastSeen = Date.now();
      return { ...errorEntry, pattern, frequency: existing.frequency };
    }

    this.errorPatterns.set(pattern, {
      ...errorEntry,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      frequency: 1
    });

    this.errors.push(errorEntry);
    return errorEntry;
  }

  categorizeError(error) {
    const msg = error.message?.toLowerCase() || '';

    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'network';
    }
    if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('403') || msg.includes('401')) {
      return 'authentication';
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
      return 'rate_limit';
    }
    if (msg.includes('timeout')) {
      return 'timeout';
    }
    if (msg.includes('parse') || msg.includes('json')) {
      return 'parsing';
    }

    return 'unknown';
  }

  isRecoverableError(error) {
    const recoverablePatterns = [
      'network',
      'timeout',
      'rate limit',
      'temporary',
      'retry'
    ];

    const msg = error.message?.toLowerCase() || '';
    return recoverablePatterns.some(pattern => msg.includes(pattern));
  }

  getErrorPattern(error) {
    // Create a pattern from error message and stack
    const msg = error.message?.substring(0, 100) || 'unknown';
    const stack = error.stack?.split('\n')[1]?.trim() || '';
    return `${error.name}:${msg}:${stack}`;
  }

  getStats() {
    const categories = {};
    for (const error of this.errors) {
      categories[error.category] = (categories[error.category] || 0) + 1;
    }

    return {
      total: this.errors.length,
      byCategory: categories,
      patterns: Array.from(this.errorPatterns.values()).map(p => ({
        pattern: p.pattern,
        frequency: p.frequency,
        lastSeen: p.lastSeen,
        category: p.category
      }))
    };
  }

  clear() {
    this.errors = [];
    this.errorPatterns.clear();
  }
}

/**
 * Stream Capture - Detailed SSE stream monitoring
 */
class StreamCapture {
  constructor() {
    this.streams = new Map();
    this.events = [];
  }

  processEvent(eventType, data, streamId) {
    const stream = this.streams.get(streamId) || {
      id: streamId,
      startTime: Date.now(),
      events: [],
      bytesReceived: 0,
      chunksReceived: 0
    };

    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: data,
      sequence: stream.events.length
    };

    stream.events.push(event);

    if (eventType === 'chunk') {
      stream.chunksReceived++;
      if (data.content) {
        stream.bytesReceived += data.content.length;
      }
    }

    if (eventType === 'complete' || eventType === 'error') {
      stream.endTime = Date.now();
      stream.duration = stream.endTime - stream.startTime;
    }

    this.streams.set(streamId, stream);
    this.events.push({ streamId, ...event });

    return {
      ...event,
      streamStats: {
        chunksReceived: stream.chunksReceived,
        bytesReceived: stream.bytesReceived,
        duration: stream.endTime ? stream.endTime - stream.startTime : Date.now() - stream.startTime
      }
    };
  }

  getStats() {
    const stats = {
      totalStreams: this.streams.size,
      totalEvents: this.events.length,
      activeStreams: Array.from(this.streams.values()).filter(s => !s.endTime).length,
      completedStreams: Array.from(this.streams.values()).filter(s => s.endTime).length
    };

    // Calculate averages
    const completed = Array.from(this.streams.values()).filter(s => s.duration);
    if (completed.length > 0) {
      stats.avgDuration = completed.reduce((sum, s) => sum + s.duration, 0) / completed.length;
      stats.avgChunksPerStream = completed.reduce((sum, s) => sum + s.chunksReceived, 0) / completed.length;
      stats.avgBytesPerStream = completed.reduce((sum, s) => sum + s.bytesReceived, 0) / completed.length;
    }

    return stats;
  }

  clear() {
    this.streams.clear();
    this.events = [];
  }
}

/**
 * Connection Monitor - Tracks connection health and issues
 */
class ConnectionMonitor {
  constructor() {
    this.connections = new Map();
    this.events = [];
  }

  processEvent(eventType, data, provider) {
    const connection = this.connections.get(provider) || {
      provider,
      status: 'unknown',
      events: [],
      failures: 0,
      successes: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null
    };

    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: data
    };

    connection.events.push(event);
    connection.lastAttempt = Date.now();

    if (eventType === 'success' || eventType === 'connected') {
      connection.status = 'connected';
      connection.successes++;
      connection.lastSuccess = Date.now();
    } else if (eventType === 'error' || eventType === 'failed') {
      connection.status = 'error';
      connection.failures++;
      connection.lastFailure = Date.now();
    } else if (eventType === 'timeout') {
      connection.status = 'timeout';
      connection.failures++;
      connection.lastFailure = Date.now();
    }

    this.connections.set(provider, connection);
    this.events.push({ provider, ...event });

    return {
      ...event,
      connectionStats: {
        status: connection.status,
        successes: connection.successes,
        failures: connection.failures,
        uptime: connection.lastSuccess ? Date.now() - connection.lastSuccess : 0,
        lastAttempt: connection.lastAttempt
      }
    };
  }

  getStats() {
    const stats = {
      providers: Array.from(this.connections.keys()),
      totalEvents: this.events.length
    };

    for (const [provider, conn] of this.connections) {
      stats[provider] = {
        status: conn.status,
        successRate: conn.successes / (conn.successes + conn.failures),
        totalAttempts: conn.successes + conn.failures,
        lastSuccess: conn.lastSuccess,
        lastFailure: conn.lastFailure,
        events: conn.events.length
      };
    }

    return stats;
  }

  clear() {
    this.connections.clear();
    this.events = [];
  }
}

export default DebugManager;