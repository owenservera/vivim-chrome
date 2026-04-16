import { Logger } from '../logging/Logger.js';

export class MetricCollector {
  constructor(options = {}) {
    this.intervals = options.intervals || ['1m', '5m', '1h', '24h'];
    this.buckets = new Map();
    this.startTime = Date.now();
    this.logger = new Logger('MetricCollector');
    this.initBuckets();
  }

  initBuckets() {
    this.buckets.clear();
    for (const interval of this.intervals) {
      this.buckets.set(interval, {
        hits: 0,
        errors: 0,
        latencySum: 0,
        latencyCounts: 0,
        dataIn: 0,
        dataOut: 0
      });
    }
  }

  record(event) {
    if (!event) return;
    const now = Date.now();
    const elapsed = now - this.startTime;

    for (const interval of this.intervals) {
      const cutoff = this.getIntervalCutoff(interval);

      if (elapsed < cutoff) {
        const bucket = this.buckets.get(interval);
        if (!bucket) continue;

        bucket.hits++;
        if (event.error) bucket.errors++;
        if (typeof event.latency === 'number') {
          bucket.latencySum += event.latency;
          bucket.latencyCounts++;
        }
        if (typeof event.dataIn === 'number') bucket.dataIn += event.dataIn;
        if (typeof event.dataOut === 'number') bucket.dataOut += event.dataOut;
      }
    }
  }

  getIntervalCutoff(interval) {
    switch (interval) {
      case '1m': return 60000;
      case '5m': return 300000;
      case '1h': return 3600000;
      case '24h': return 86400000;
      default: return 60000;
    }
  }

  getIntervalStats(interval) {
    const bucket = this.buckets.get(interval);
    if (!bucket) return null;

    const latencyAvg = bucket.latencyCounts > 0 ? bucket.latencySum / bucket.latencyCounts : 0;
    const errorRate = bucket.hits > 0 ? bucket.errors / bucket.hits : 0;

    return {
      hits: bucket.hits,
      errors: bucket.errors,
      errorRate: errorRate.toFixed(4),
      latencyMs: latencyAvg.toFixed(2),
      dataIn: bucket.dataIn,
      dataOut: bucket.dataOut
    };
  }

  getAll() {
    const stats = {};
    for (const interval of this.intervals) {
      stats[interval] = this.getIntervalStats(interval);
    }
    return stats;
  }

  reset() {
    this.initBuckets();
    this.startTime = Date.now();
    this.logger.info('Metrics reset');
  }
}

export class MetricsAPI {
  constructor() {
    this.collectors = new Map();
    this.streams = new Map();
    this.logger = new Logger('MetricsAPI');
  }

  getCollector(name) {
    if (!this.collectors.has(name)) {
      this.collectors.set(name, new MetricCollector());
    }
    return this.collectors.get(name);
  }

  recordProvider(providerId, event) {
    this.getCollector(`provider:${providerId}`).record(event);
  }

  recordStream(streamId, event) {
    this.getCollector(`stream:${streamId}`).record(event);
    this.streams.set(streamId, { ...event, timestamp: Date.now() });
  }

  recordRequest(url, event) {
    this.getCollector('requests').record(event);
  }

  getProviderStats(providerId) {
    const collector = this.collectors.get(`provider:${providerId}`);
    return collector ? collector.getAll() : null;
  }

  getStreamStats(streamId) {
    const collector = this.collectors.get(`stream:${streamId}`);
    return collector ? collector.getAll() : null;
  }

  getGlobalStats() {
    const collector = this.collectors.get('requests');
    return collector ? collector.getAll() : {};
  }

  getActiveStreams() {
    return Array.from(this.streams.keys());
  }

  resetProvider(providerId) {
    const collector = this.collectors.get(`provider:${providerId}`);
    if (collector) collector.reset();
  }

  snapshot() {
    return {
      global: this.getGlobalStats(),
      providers: Array.from(this.collectors.keys())
        .filter(k => k.startsWith('provider:'))
        .reduce((acc, k) => {
          const id = k.replace('provider:', '');
          acc[id] = this.getProviderStats(id);
          return acc;
        }, {}),
      activeStreams: this.streams.size,
      timestamp: Date.now()
    };
  }
}

export const metricsAPI = new MetricsAPI();