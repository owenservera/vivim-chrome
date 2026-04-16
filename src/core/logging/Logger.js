/**
 * Unified Logging Utility
 * Provides consistent formatting and level-based filtering
 */
export class Logger {
  constructor(component, options = {}) {
    this.component = component;
    this.enabled = options.enabled !== false;
    this.prefix = `[${component}]`;
  }

  log(...args) {
    if (!this.enabled) return;
    console.log(this.prefix, ...args);
  }

  info(...args) {
    if (!this.enabled) return;
    console.info(this.prefix, ...args);
  }

  warn(...args) {
    if (!this.enabled) return;
    console.warn(this.prefix, ...args);
  }

  error(...args) {
    if (!this.enabled) return;
    console.error(this.prefix, ...args);
  }

  debug(...args) {
    if (!this.enabled) return;
    // Only log debug in development (optional check)
    console.debug(this.prefix, ...args);
  }

  /**
   * Create a child logger for a specific sub-component
   */
  child(subComponent) {
    return new Logger(`${this.component}:${subComponent}`, { enabled: this.enabled });
  }
}

// Default global logger
export const logger = new Logger('VIVIM');
