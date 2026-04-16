# Panel Wiring Documentation - Performance Considerations

## Overview
This document outlines performance optimization strategies and considerations for the side panel's wiring system, ensuring smooth real-time AI streaming experiences even under high load.

## Performance Architecture

### Performance Monitoring Framework
```javascript
// Performance tracking system
const performanceMonitor = {
  metrics: {
    messageRenderTime: [],
    chunkProcessingTime: [],
    domUpdateTime: [],
    memoryUsage: [],
    eventProcessingTime: []
  },

  thresholds: {
    maxMessageRenderTime: 50,    // ms
    maxChunkProcessingTime: 10,  // ms
    maxDOMUpdateTime: 16,        // ms (60fps)
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxEventProcessingTime: 5    // ms
  },

  measure(operation, startTime) {
    const duration = Date.now() - startTime;
    this.metrics[operation].push(duration);

    // Keep only recent measurements
    if (this.metrics[operation].length > 100) {
      this.metrics[operation].shift();
    }

    // Check thresholds
    this.checkThreshold(operation, duration);

    return duration;
  },

  checkThreshold(operation, duration) {
    const threshold = this.thresholds[`max${operation.charAt(0).toUpperCase() + operation.slice(1)}Time`];
    if (threshold && duration > threshold) {
      console.warn(`Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`);
      this.reportPerformanceIssue(operation, duration);
    }
  },

  getAverages() {
    const averages = {};
    for (const [metric, values] of Object.entries(this.metrics)) {
      averages[metric] = values.reduce((a, b) => a + b, 0) / values.length;
    }
    return averages;
  }
};
```

## Streaming Performance Optimization

### Chunk Processing Optimization
```javascript
// Optimized streaming chunk processing
class StreamingOptimizer {
  constructor() {
    this.pendingChunks = [];
    this.processingBatch = false;
    this.batchSize = 5;          // Process 5 chunks at once
    this.batchTimeout = 16;      // 60fps batching
    this.maxQueueSize = 50;      // Prevent memory overflow
  }

  // Queue chunk for processing
  queueChunk(chunk) {
    this.pendingChunks.push(chunk);

    // Prevent queue overflow
    if (this.pendingChunks.length > this.maxQueueSize) {
      console.warn('Chunk queue overflow, dropping old chunks');
      this.pendingChunks.splice(0, this.pendingChunks.length - this.maxQueueSize);
    }

    this.scheduleBatchProcessing();
  }

  // Batch processing scheduler
  scheduleBatchProcessing() {
    if (this.processingBatch) return;

    this.processingBatch = true;
    setTimeout(() => {
      this.processBatch();
    }, this.batchTimeout);
  }

  // Process chunk batch
  async processBatch() {
    const startTime = Date.now();
    const batch = this.pendingChunks.splice(0, this.batchSize);

    // Process batch in parallel
    const promises = batch.map(chunk => this.processChunk(chunk));
    await Promise.all(promises);

    // Single DOM update for entire batch
    this.updateDOMForBatch(batch);

    const processingTime = performanceMonitor.measure('chunkProcessing', startTime);
    this.processingBatch = false;

    // Continue processing if more chunks remain
    if (this.pendingChunks.length > 0) {
      this.scheduleBatchProcessing();
    }
  }

  // Individual chunk processing
  async processChunk(chunk) {
    // Format content
    chunk.formattedContent = this.formatMessage(chunk.content);

    // Extract metadata
    chunk.metadata = this.extractMetadata(chunk);

    // Validate chunk
    this.validateChunk(chunk);
  }

  // Batched DOM update
  updateDOMForBatch(batch) {
    const startTime = Date.now();

    // Single DOM operation for batch
    const fragment = document.createDocumentFragment();

    batch.forEach(chunk => {
      const element = this.createChunkElement(chunk);
      fragment.appendChild(element);
    });

    this.streamingContainer.appendChild(fragment);
    this.scrollToBottom();

    performanceMonitor.measure('domUpdate', startTime);
  }
}
```

### Memory Management Strategies
```javascript
// Memory-efficient message management
class MemoryManager {
  constructor() {
    this.messageCache = new Map();
    this.elementPool = new Map();
    this.maxCachedMessages = 100;
    this.maxPoolSize = 20;
  }

  // Message element pooling
  getMessageElement(type) {
    let pool = this.elementPool.get(type);
    if (!pool || pool.length === 0) {
      return this.createMessageElement(type);
    }
    return pool.pop();
  }

  returnMessageElement(element, type) {
    let pool = this.elementPool.get(type);
    if (!pool) {
      pool = [];
      this.elementPool.set(type, pool);
    }

    if (pool.length < this.maxPoolSize) {
      // Reset element state
      this.resetElement(element);
      pool.push(element);
    }
  }

  // Message content caching
  cacheMessage(messageId, content) {
    if (this.messageCache.size >= this.maxCachedMessages) {
      // Remove oldest entry
      const firstKey = this.messageCache.keys().next().value;
      this.messageCache.delete(firstKey);
    }
    this.messageCache.set(messageId, content);
  }

  getCachedMessage(messageId) {
    return this.messageCache.get(messageId);
  }

  // Memory cleanup
  cleanup() {
    // Clear caches on panel hide
    this.messageCache.clear();

    // Return elements to pool
    this.returnAllElements();

    // Force garbage collection hint
    if (window.gc) window.gc();
  }
}
```

## DOM Performance Optimization

### Virtual Scrolling for Large Conversations
```javascript
// Virtual scrolling implementation
class VirtualScroller {
  constructor(container, itemHeight = 60) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.totalItems = 0;
    this.visibleItems = 20;
    this.scrollTop = 0;
    this.visibleRange = { start: 0, end: this.visibleItems };
  }

  // Update virtual scroll
  updateScroll(scrollTop) {
    this.scrollTop = scrollTop;
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = start + this.visibleItems;

    if (start !== this.visibleRange.start || end !== this.visibleRange.end) {
      this.visibleRange = { start, end };
      this.renderVisibleItems();
    }
  }

  // Render only visible items
  renderVisibleItems() {
    const fragment = document.createDocumentFragment();

    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      const item = this.getItemAtIndex(i);
      if (item) {
        fragment.appendChild(item.element);
      }
    }

    // Update container
    this.container.innerHTML = '';
    this.container.appendChild(fragment);

    // Set container height to show scrollbar
    this.container.style.height = `${this.totalItems * this.itemHeight}px`;
  }

  // Get item at index (lazy loading)
  getItemAtIndex(index) {
    // Check cache first
    if (this.itemCache[index]) {
      return this.itemCache[index];
    }

    // Create item on demand
    const item = this.createItem(index);
    this.itemCache[index] = item;

    return item;
  }
}
```

### Efficient DOM Updates
```javascript
// DOM update batching
class DOMBatchUpdater {
  constructor() {
    this.updates = [];
    this.scheduled = false;
    this.batchTimeout = 16; // 60fps
  }

  // Queue DOM update
  queueUpdate(updateFn) {
    this.updates.push(updateFn);
    this.scheduleBatch();
  }

  // Schedule batch execution
  scheduleBatch() {
    if (this.scheduled) return;

    this.scheduled = true;
    requestAnimationFrame(() => {
      this.executeBatch();
    });
  }

  // Execute all queued updates
  executeBatch() {
    const startTime = Date.now();

    // Execute all updates in batch
    this.updates.forEach(update => update());

    // Clear queue
    this.updates = [];
    this.scheduled = false;

    performanceMonitor.measure('domBatchUpdate', startTime);
  }
}

// Usage
const domUpdater = new DOMBatchUpdater();

// Instead of immediate DOM manipulation
element.textContent = 'new content';

// Queue for batched update
domUpdater.queueUpdate(() => {
  element.textContent = 'new content';
});
```

## Network Performance Optimization

### Connection Pooling
```javascript
// Connection pooling for background communication
class ConnectionPool {
  constructor(maxConnections = 3) {
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
    this.queue = [];
  }

  // Get connection from pool
  async getConnection() {
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return this.createConnection();
    }

    // Wait for available connection
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  // Return connection to pool
  releaseConnection(connection) {
    this.activeConnections--;

    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve(this.createConnection());
      this.activeConnections++;
    }
  }

  // Create new connection
  createConnection() {
    return {
      sendMessage: (message) => chrome.runtime.sendMessage(message),
      disconnect: () => this.releaseConnection(this)
    };
  }
}
```

### Message Batching and Compression
```javascript
// Message batching for high-frequency updates
class MessageBatcher {
  constructor(batchSize = 10, batchTimeout = 100) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
    this.pendingMessages = [];
    this.batchTimer = null;
  }

  // Add message to batch
  addMessage(message) {
    this.pendingMessages.push(message);

    if (this.pendingMessages.length >= this.batchSize) {
      this.flushBatch();
    } else {
      this.scheduleFlush();
    }
  }

  // Schedule batch flush
  scheduleFlush() {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.batchTimeout);
  }

  // Flush pending messages
  flushBatch() {
    if (this.pendingMessages.length === 0) return;

    const batch = {
      type: 'BATCH_UPDATE',
      messages: this.pendingMessages,
      compressed: this.compressBatch(this.pendingMessages)
    };

    // Send batch
    this.sendBatch(batch);

    // Reset
    this.pendingMessages = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Compress batch (simple deduplication)
  compressBatch(messages) {
    // Remove duplicate consecutive updates
    const compressed = [];
    let lastMessage = null;

    messages.forEach(message => {
      if (!this.isDuplicate(message, lastMessage)) {
        compressed.push(message);
        lastMessage = message;
      }
    });

    return compressed;
  }
}
```

## CPU Performance Optimization

### Web Workers for Heavy Processing
```javascript
// Offload heavy processing to web worker
class ProcessingWorker {
  constructor() {
    this.worker = new Worker('processing-worker.js');
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.pendingTasks = new Map();
  }

  // Process message formatting in worker
  formatMessageAsync(content, taskId) {
    this.pendingTasks.set(taskId, { type: 'format' });
    this.worker.postMessage({
      type: 'FORMAT_MESSAGE',
      content: content,
      taskId: taskId
    });
  }

  // Handle worker response
  handleWorkerMessage(event) {
    const { taskId, result } = event.data;
    const task = this.pendingTasks.get(taskId);

    if (task) {
      this.pendingTasks.delete(taskId);
      this.handleTaskResult(task, result);
    }
  }

  // Process result on main thread
  handleTaskResult(task, result) {
    switch (task.type) {
      case 'format':
        this.updateMessageContent(result);
        break;
    }
  }
}
```

### Event Loop Optimization
```javascript
// Prevent event loop blocking
class EventLoopOptimizer {
  constructor() {
    this.tasks = [];
    this.processing = false;
    this.yieldEvery = 10; // Yield every 10 tasks
    this.taskCount = 0;
  }

  // Queue task for execution
  queueTask(task) {
    this.tasks.push(task);
    this.scheduleProcessing();
  }

  // Schedule processing with yielding
  scheduleProcessing() {
    if (this.processing) return;

    this.processing = true;
    setTimeout(() => this.processTasks(), 0);
  }

  // Process tasks with yielding
  async processTasks() {
    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      await task();

      this.taskCount++;
      if (this.taskCount % this.yieldEvery === 0) {
        // Yield control to browser
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.processing = false;
    this.taskCount = 0;
  }
}
```

## Performance Monitoring and Profiling

### Real-time Performance Dashboard
```javascript
// Performance dashboard overlay
class PerformanceDashboard {
  constructor() {
    this.visible = false;
    this.metrics = {};
    this.updateInterval = 1000; // 1 second updates
  }

  show() {
    this.visible = true;
    this.createDashboard();
    this.startMonitoring();
  }

  createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'performance-dashboard';
    dashboard.innerHTML = `
      <div class="perf-metric">Messages/sec: <span id="msg-rate">0</span></div>
      <div class="perf-metric">Avg render time: <span id="render-time">0ms</span></div>
      <div class="perf-metric">Memory usage: <span id="memory-usage">0MB</span></div>
      <div class="perf-metric">Active streams: <span id="active-streams">0</span></div>
    `;
    document.body.appendChild(dashboard);
  }

  startMonitoring() {
    setInterval(() => {
      this.updateMetrics();
      this.updateDisplay();
    }, this.updateInterval);
  }

  updateMetrics() {
    const averages = performanceMonitor.getAverages();
    const memory = performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0;

    this.metrics = {
      messageRate: this.calculateMessageRate(),
      renderTime: averages.messageRenderTime || 0,
      memoryUsage: memory,
      activeStreams: streamingManager ? streamingManager.getActiveStreams().length : 0
    };
  }

  updateDisplay() {
    document.getElementById('msg-rate').textContent = this.metrics.messageRate.toFixed(1);
    document.getElementById('render-time').textContent = this.metrics.renderTime.toFixed(1) + 'ms';
    document.getElementById('memory-usage').textContent = this.metrics.memoryUsage.toFixed(1) + 'MB';
    document.getElementById('active-streams').textContent = this.metrics.activeStreams;
  }
}
```

### Performance Testing Framework
```javascript
// Automated performance testing
class PerformanceTester {
  constructor() {
    this.results = [];
  }

  // Test streaming performance
  async testStreamingPerformance(messageCount = 100, chunkSize = 50) {
    const startTime = Date.now();

    // Generate test messages
    for (let i = 0; i < messageCount; i++) {
      await this.simulateStreamingMessage(chunkSize);
    }

    const totalTime = Date.now() - startTime;
    const avgTimePerMessage = totalTime / messageCount;

    this.results.push({
      test: 'streaming',
      messageCount,
      chunkSize,
      totalTime,
      avgTimePerMessage,
      messagesPerSecond: 1000 / avgTimePerMessage
    });

    return this.results[this.results.length - 1];
  }

  // Simulate streaming message
  async simulateStreamingMessage(chunkSize) {
    const chunks = [];
    for (let i = 0; i < chunkSize; i++) {
      chunks.push(`Chunk ${i} of streaming message content. `);
    }

    // Process chunks
    for (const chunk of chunks) {
      await this.processChunk(chunk);
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network delay
    }
  }

  // Generate performance report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: this.results,
      averages: this.calculateAverages(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }
}
```

## Performance Budgets and Alerts

### Performance Budget Definition
```javascript
// Performance budgets for different operations
const PERFORMANCE_BUDGETS = {
  messageRender: {
    p50: 50,    // 50th percentile <= 50ms
    p95: 100,   // 95th percentile <= 100ms
    p99: 200    // 99th percentile <= 200ms
  },
  chunkProcessing: {
    p50: 5,
    p95: 15,
    p99: 50
  },
  domUpdate: {
    p50: 8,
    p95: 16,
    p99: 32
  }
};
```

### Performance Alert System
```javascript
// Alert on performance budget violations
class PerformanceAlerts {
  constructor() {
    this.alerts = [];
    this.checkInterval = 60000; // Check every minute
  }

  startMonitoring() {
    setInterval(() => {
      this.checkBudgets();
      this.processAlerts();
    }, this.checkInterval);
  }

  checkBudgets() {
    const averages = performanceMonitor.getAverages();

    for (const [operation, budgets] of Object.entries(PERFORMANCE_BUDGETS)) {
      const value = averages[operation];
      if (!value) continue;

      for (const [percentile, threshold] of Object.entries(budgets)) {
        if (value > threshold) {
          this.createAlert(operation, percentile, value, threshold);
        }
      }
    }
  }

  createAlert(operation, percentile, actual, budget) {
    const alert = {
      timestamp: Date.now(),
      operation,
      percentile,
      actual,
      budget,
      severity: this.calculateSeverity(actual, budget)
    };

    this.alerts.push(alert);
    console.warn(`Performance alert: ${operation} ${percentile} is ${actual}ms (budget: ${budget}ms)`);
  }

  calculateSeverity(actual, budget) {
    const ratio = actual / budget;
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'warning';
    return 'info';
  }
}
```

---

*This document provides comprehensive performance optimization strategies for the side panel wiring system, ensuring smooth operation during intensive AI streaming scenarios.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Performance-Considerations.md