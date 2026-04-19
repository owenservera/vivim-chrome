/**
 * ChatGPT Data Feed Study Module
 * Comprehensive data collection for debugging ChatGPT streaming issues
 */

import { Logger } from '../../core/logging/Logger.js';

export class ChatGPTDataFeedStudy {
  constructor(options = {}) {
    this.logger = new Logger('ChatGPTDataFeedStudy');
    this.enabled = options.enabled || false;
    this.dataBuffer = [];
    this.sessionId = this.generateSessionId();
    this.maxBufferSize = options.maxBufferSize || 1000;
    this.flushInterval = options.flushInterval || 10000; // 10 seconds
    this.flushTimer = null;

    this.studyData = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      networkEvents: [],
      parsingEvents: [],
      uiEvents: [],
      errors: [],
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        extensionVersion: chrome.runtime?.getManifest?.()?.version || '0.0.0'
      }
    };

    if (this.enabled) {
      this.startCollection();
    }
  }

  generateSessionId() {
    return `chatgpt-study-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startCollection() {
    this.logger.info(`Starting ChatGPT data feed study: ${this.sessionId}`);
    this.flushTimer = setInterval(() => this.flushBuffer(), this.flushInterval);
  }

  stopCollection() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushBuffer(); // Final flush
    this.logger.info(`Stopped ChatGPT data feed study: ${this.sessionId}`);
  }

  /**
   * Capture raw network response data
   */
  captureNetworkEvent(eventType, data) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      type: eventType,
      data: {
        ...data,
        // Don't log sensitive auth headers
        headers: this.sanitizeHeaders(data.headers),
        body: data.body ? this.truncateString(data.body, 10000) : null
      }
    };

    this.studyData.networkEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture raw streaming data before parsing
   */
  captureRawStreamData(streamId, rawData, metadata = {}) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      streamId,
      type: 'raw_stream_data',
      data: {
        rawData: this.truncateString(rawData, 50000), // Limit to 50KB per event
        byteLength: rawData.length,
        metadata
      }
    };

    this.studyData.parsingEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture SSE event parsing
   */
  captureSSEEvent(streamId, eventType, eventData, rawData) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      streamId,
      type: 'sse_event',
      data: {
        eventType,
        eventData: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
        rawData: this.truncateString(rawData, 10000),
        parsedSuccessfully: eventData !== null
      }
    };

    this.studyData.parsingEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture JSON payload parsing attempts
   */
  captureJSONParseAttempt(streamId, rawPayload, parsedPayload, success, error = null) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      streamId,
      type: 'json_parse_attempt',
      data: {
        rawPayload: this.truncateString(rawPayload, 10000),
        payloadLength: rawPayload.length,
        success,
        error: error ? error.message : null,
        parsedPayload: success ? this.summarizePayload(parsedPayload) : null
      }
    };

    this.studyData.parsingEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture delta processing events
   */
  captureDeltaProcessing(streamId, operation, payload, result) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      streamId,
      type: 'delta_processing',
      data: {
        operation,
        payloadType: Array.isArray(payload) ? 'array' : typeof payload,
        payloadSummary: this.summarizePayload(payload),
        result: result ? 'success' : 'failed',
        contentChanged: result
      }
    };

    this.studyData.parsingEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture chunk emission to UI
   */
  captureChunkEmission(streamId, chunk, accumulatedContent = null) {
    if (!this.enabled) return;

    const event = {
      timestamp: Date.now(),
      streamId,
      type: 'chunk_emission',
      data: {
        chunk: {
          content: chunk.content ? this.truncateString(chunk.content, 1000) : '',
          contentLength: chunk.content?.length || 0,
          role: chunk.role,
          model: chunk.model,
          seq: chunk.seq,
          cumulative: chunk.cumulative,
          isFinal: chunk.isFinal
        },
        accumulatedLength: accumulatedContent?.length || 0,
        metadata: chunk.metadata || {}
      }
    };

    this.studyData.uiEvents.push(event);
    this.checkBufferSize();
  }

  /**
   * Capture errors with full context
   */
  captureError(streamId, error, context = {}) {
    if (!this.enabled) return;

    const errorEvent = {
      timestamp: Date.now(),
      streamId,
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context: {
          ...context,
          url: context.url,
          method: context.method,
          responseStatus: context.responseStatus
        }
      }
    };

    this.studyData.errors.push(errorEvent);
    this.checkBufferSize();
  }

  /**
   * Sanitize headers to remove sensitive data
   */
  sanitizeHeaders(headers) {
    if (!headers) return {};

    const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token'];
    const sanitized = {};

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Truncate strings to prevent memory issues
   */
  truncateString(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + `... [TRUNCATED ${str.length - maxLength} chars]`;
  }

  /**
   * Create summary of complex payloads for logging
   */
  summarizePayload(payload) {
    if (!payload) return null;

    if (Array.isArray(payload)) {
      return {
        type: 'array',
        length: payload.length,
        items: payload.slice(0, 3).map(item => this.summarizeObject(item))
      };
    }

    if (typeof payload === 'object') {
      return this.summarizeObject(payload);
    }

    return payload;
  }

  summarizeObject(obj) {
    const keys = Object.keys(obj);
    return {
      type: 'object',
      keys: keys,
      keyCount: keys.length,
      hasNested: keys.some(key => typeof obj[key] === 'object'),
      sampleValues: keys.slice(0, 5).reduce((acc, key) => {
        acc[key] = typeof obj[key] === 'string' ? this.truncateString(obj[key], 100) :
                   Array.isArray(obj[key]) ? `[Array(${obj[key].length})]` :
                   typeof obj[key];
        return acc;
      }, {})
    };
  }

  /**
   * Check buffer size and flush if needed
   */
  checkBufferSize() {
    const totalEvents = this.studyData.networkEvents.length +
                       this.studyData.parsingEvents.length +
                       this.studyData.uiEvents.length +
                       this.studyData.errors.length;

    if (totalEvents >= this.maxBufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Flush data to storage
   */
  async flushBuffer() {
    if (!this.enabled) return;

    try {
      const dataToFlush = {
        ...this.studyData,
        endTime: Date.now(),
        duration: Date.now() - this.studyData.startTime,
        totalEvents: this.studyData.networkEvents.length +
                    this.studyData.parsingEvents.length +
                    this.studyData.uiEvents.length +
                    this.studyData.errors.length
      };

      // Store in chrome storage
      const key = `chatgpt-study-${this.sessionId}`;
      await chrome.storage.local.set({ [key]: dataToFlush });

      // Also save as downloadable file in study-data directory (for development access)
      await this.saveToStudyDirectory(dataToFlush);

      this.logger.debug(`Flushed study data: ${dataToFlush.totalEvents} events`);

      // Reset events but keep metadata
      this.studyData.networkEvents = [];
      this.studyData.parsingEvents = [];
      this.studyData.uiEvents = [];
      this.studyData.errors = [];

    } catch (error) {
      this.logger.error('Failed to flush study data:', error);
    }
  }

  /**
   * Save data to study directory for development access
   */
  async saveToStudyDirectory(data) {
    try {
      // In a real implementation, this would save to the file system
      // For now, we'll store additional metadata in chrome storage
      const fileKey = `chatgpt-study-file-${this.sessionId}`;
      const fileData = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        data: data,
        filePath: `study-data/chatgpt-study-${this.sessionId}.json`,
        instructions: 'This data is also available in Chrome storage and can be exported via the debug dashboard'
      };

      await chrome.storage.local.set({ [fileKey]: fileData });
      this.logger.debug(`Saved study file metadata: ${fileKey}`);
    } catch (error) {
      this.logger.warn('Failed to save study directory data:', error);
    }
  }

  /**
   * Export study data for analysis
   */
  async exportData() {
    // Flush any remaining data
    await this.flushBuffer();

    // Get all stored study sessions
    const storage = await chrome.storage.local.get(null);
    const studyKeys = Object.keys(storage).filter(key => key.startsWith('chatgpt-study-'));

    const allData = {};
    for (const key of studyKeys) {
      allData[key] = storage[key];
    }

    return {
      sessions: allData,
      exportTime: Date.now(),
      totalSessions: studyKeys.length
    };
  }

  /**
   * Enable/disable the study
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.startCollection();
    } else {
      this.stopCollection();
    }
  }

  /**
   * Get current study status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      sessionId: this.sessionId,
      startTime: this.studyData.startTime,
      networkEvents: this.studyData.networkEvents.length,
      parsingEvents: this.studyData.parsingEvents.length,
      uiEvents: this.studyData.uiEvents.length,
      errors: this.studyData.errors.length,
      totalEvents: this.studyData.networkEvents.length +
                  this.studyData.parsingEvents.length +
                  this.studyData.uiEvents.length +
                  this.studyData.errors.length
    };
  }

  /**
   * Export study data for external analysis
   */
  async exportForAnalysis() {
    await this.flushBuffer(); // Ensure all data is flushed

    const analysisData = {
      study: {
        sessionId: this.sessionId,
        startTime: this.studyData.startTime,
        endTime: Date.now(),
        duration: Date.now() - this.studyData.startTime,
        metadata: this.studyData.metadata
      },
      summary: this.generateSummary(),
      rawData: this.studyData,
      insights: this.generateInsights()
    };

    // Save to study-data directory (development access)
    await this.saveAnalysisFile(analysisData);

    // Convert to downloadable format
    const blob = new Blob([JSON.stringify(analysisData, null, 2)], {
      type: 'application/json'
    });

    // Trigger download to user's Downloads folder
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatgpt-study-${this.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.logger.info(`Exported study data to Downloads folder: chatgpt-study-${this.sessionId}.json`);
    return analysisData;
  }

  /**
   * Save analysis file to study directory
   */
  async saveAnalysisFile(analysisData) {
    try {
      const fileName = `chatgpt-study-analysis-${this.sessionId}.json`;
      const fileKey = `study-analysis-${this.sessionId}`;

      const fileData = {
        fileName,
        filePath: `study-data/${fileName}`,
        sessionId: this.sessionId,
        created: Date.now(),
        data: analysisData,
        description: 'Complete analysis export with summary, insights, and raw data'
      };

      await chrome.storage.local.set({ [fileKey]: fileData });
      this.logger.info(`Saved analysis file: ${fileName}`);
    } catch (error) {
      this.logger.warn('Failed to save analysis file:', error);
    }
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const networkEvents = this.studyData.networkEvents;
    const parsingEvents = this.studyData.parsingEvents;
    const uiEvents = this.studyData.uiEvents;
    const errors = this.studyData.errors;

    const streamIds = new Set();
    networkEvents.forEach(e => { if (e.data.streamId) streamIds.add(e.data.streamId); });
    parsingEvents.forEach(e => { streamIds.add(e.streamId); });
    uiEvents.forEach(e => { streamIds.add(e.streamId); });
    errors.forEach(e => { streamIds.add(e.streamId); });

    // Analyze streaming patterns
    const streamsWithContent = uiEvents.filter(e =>
      e.data.chunk?.content && e.data.chunk.content.trim().length > 0
    );

    const emptyChunks = uiEvents.filter(e =>
      !e.data.chunk?.content || e.data.chunk.content.trim().length === 0
    );

    // Analyze parsing success
    const jsonParseAttempts = parsingEvents.filter(e => e.type === 'json_parse_attempt');
    const successfulParses = jsonParseAttempts.filter(e => e.data.success);
    const failedParses = jsonParseAttempts.filter(e => !e.data.success);

    // Analyze delta processing
    const deltaEvents = parsingEvents.filter(e => e.type === 'delta_processing');
    const successfulDeltas = deltaEvents.filter(e => e.data.result === 'success');

    return {
      totalStreams: streamIds.size,
      networkEvents: networkEvents.length,
      parsingEvents: parsingEvents.length,
      uiEvents: uiEvents.length,
      errors: errors.length,
      streaming: {
        streamsWithContent: streamsWithContent.length,
        emptyChunks: emptyChunks.length,
        avgContentLength: streamsWithContent.length > 0 ?
          streamsWithContent.reduce((sum, e) => sum + (e.data.chunk?.contentLength || 0), 0) / streamsWithContent.length : 0
      },
      parsing: {
        jsonParseAttempts: jsonParseAttempts.length,
        successfulParses: successfulParses.length,
        failedParses: failedParses.length,
        parseSuccessRate: jsonParseAttempts.length > 0 ? (successfulParses.length / jsonParseAttempts.length) * 100 : 0,
        deltaProcessingEvents: deltaEvents.length,
        successfulDeltaProcessing: successfulDeltas.length
      },
      errorsByPhase: this.groupErrorsByPhase()
    };
  }

  /**
   * Group errors by processing phase
   */
  groupErrorsByPhase() {
    const phaseGroups = {};

    this.studyData.errors.forEach(error => {
      const phase = error.data.context?.phase || 'unknown';
      if (!phaseGroups[phase]) {
        phaseGroups[phase] = [];
      }
      phaseGroups[phase].push(error);
    });

    // Convert to summary
    const summary = {};
    Object.keys(phaseGroups).forEach(phase => {
      summary[phase] = {
        count: phaseGroups[phase].length,
        sampleErrors: phaseGroups[phase].slice(0, 3).map(e => ({
          message: e.data.message,
          timestamp: e.timestamp
        }))
      };
    });

    return summary;
  }

  /**
   * Generate insights from the data
   */
  generateInsights() {
    const insights = [];
    const summary = this.generateSummary();

    // Check for content-type filtering issues
    const nonStreamingResponses = this.studyData.networkEvents.filter(e =>
      e.type === 'non_streaming_response_filtered'
    );

    if (nonStreamingResponses.length > 0) {
      insights.push({
        type: 'positive',
        title: 'Content-Type Filtering Working',
        description: `${nonStreamingResponses.length} non-streaming responses were properly filtered`,
        data: nonStreamingResponses.length
      });
    }

    // Check for empty bubble issues
    if (summary.streaming.emptyChunks > 0) {
      const emptyPercentage = (summary.streaming.emptyChunks / summary.uiEvents) * 100;
      insights.push({
        type: 'issue',
        title: 'Empty Chunks Detected',
        description: `${summary.streaming.emptyChunks} empty chunks (${emptyPercentage.toFixed(1)}% of total)`,
        severity: emptyPercentage > 10 ? 'high' : 'medium',
        recommendation: 'Review content filtering and delta processing logic'
      });
    }

    // Check JSON parsing success rate
    if (summary.parsing.parseSuccessRate < 90) {
      insights.push({
        type: 'issue',
        title: 'JSON Parsing Issues',
        description: `Parse success rate: ${summary.parsing.parseSuccessRate.toFixed(1)}%`,
        severity: summary.parsing.parseSuccessRate < 70 ? 'high' : 'medium',
        recommendation: 'Investigate malformed JSON payloads or parser logic'
      });
    }

    // Check for delta processing issues
    const deltaSuccessRate = summary.parsing.deltaProcessingEvents > 0 ?
      (summary.parsing.successfulDeltaProcessing / summary.parsing.deltaProcessingEvents) * 100 : 100;

    if (deltaSuccessRate < 95) {
      insights.push({
        type: 'issue',
        title: 'Delta Processing Issues',
        description: `Delta processing success rate: ${deltaSuccessRate.toFixed(1)}%`,
        severity: 'high',
        recommendation: 'Review array-based patch handling in processDeltaEncodingPayload'
      });
    }

    // Check error distribution
    const errorPhases = Object.keys(summary.errorsByPhase);
    if (errorPhases.length > 0) {
      insights.push({
        type: 'issue',
        title: 'Errors by Phase',
        description: `Errors occurred in phases: ${errorPhases.join(', ')}`,
        severity: 'medium',
        recommendation: 'Review error handling in identified phases'
      });
    }

    // Performance insights
    if (summary.streaming.avgContentLength > 0) {
      insights.push({
        type: 'info',
        title: 'Content Size Analysis',
        description: `Average chunk content length: ${summary.streaming.avgContentLength.toFixed(0)} characters`,
        data: summary.streaming.avgContentLength
      });
    }

    return insights;
  }

  /**
   * Generate troubleshooting guide based on findings
   */
  generateTroubleshootingGuide() {
    const summary = this.generateSummary();
    const insights = this.generateInsights();

    return {
      detectedIssues: insights.filter(i => i.type === 'issue'),
      recommendations: this.generateRecommendations(),
      nextSteps: [
        'Run test scenarios to validate fixes',
        'Monitor error rates in production',
        'Implement additional logging for edge cases',
        'Consider A/B testing for parser improvements'
      ],
      dataCollection: {
        totalEvents: summary.networkEvents + summary.parsingEvents + summary.uiEvents + summary.errors,
        sessionDuration: Date.now() - this.studyData.startTime,
        exportRecommended: summary.totalStreams > 0
      }
    };
  }

  /**
   * Generate specific recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();

    if (summary.streaming.emptyChunks > summary.streaming.streamsWithContent * 0.1) {
      recommendations.push({
        priority: 'high',
        issue: 'Excessive empty chunks',
        action: 'Implement stricter content validation before emitting chunks',
        code: 'Check chunk.content && chunk.content.trim().length > 0 before emitChunk()'
      });
    }

    if (summary.parsing.parseSuccessRate < 85) {
      recommendations.push({
        priority: 'high',
        issue: 'JSON parsing failures',
        action: 'Add better error handling for malformed SSE data',
        code: 'Validate JSON structure before processing in processEventPayload()'
      });
    }

    if (summary.parsing.deltaProcessingEvents > 0 && summary.parsing.successfulDeltaProcessing < summary.parsing.deltaProcessingEvents) {
      recommendations.push({
        priority: 'high',
        issue: 'Delta processing failures',
        action: 'Fix array-based patch iteration in processDeltaEncodingPayload()',
        code: 'Ensure proper handling of Array.isArray(payload) in delta processing'
      });
    }

    return recommendations;
  }
}

export default ChatGPTDataFeedStudy;