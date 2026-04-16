import { Logger } from '../logging/Logger.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.halfOpenAttempts = 0;
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.logger = new Logger(`CircuitBreaker:${this.name}`);
  }

  getState() {
    return this.state;
  }

  canAttempt() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        this.logger.info('State changed: half-open');
        return true;
      }
      return false;
    }
    return this.state === 'half-open';
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.logger.info('State changed: closed (recovered)');
      }
    } else if (this.state === 'closed') {
      this.failures = 0;
    }
  }

  recordFailure(error = null) {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      this.halfOpenAttempts = 0;
      this.logger.warn('State changed: open (half-open failure)');
    } else if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.logger.warn(`State changed: open (${this.failures} failures)`);
    }
  }

  async execute(operation) {
    if (!this.canAttempt()) {
      throw new Error(`CircuitBreaker:${this.name} is open`);
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
    this.logger = new Logger('CircuitBreakerRegistry');
  }

  getOrCreate(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  get(name) {
    return this.breakers.get(name);
  }

  getAllStats() {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}