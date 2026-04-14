// VIVIM Telemetry Service
// Privacy-first telemetry with consent management

(function (global) {
  'use strict';

  // ============================================================
  // CONSTANTS & CONFIG
  // ============================================================

  const TELEMETRY_VERSION = '1.0.0';
  const STORAGE_KEYS = {
    CONSENT: 'vivim_telemetry_consent',
    EVENTS: 'vivim_telemetry_events',
    SETTINGS: 'vivim_telemetry_settings'
  };

  const DEFAULT_CONSENT = {
    analytics: false,        // Anonymous usage data
    personalization: false,   // Tailored experience
    errorReporting: true,  // Error/crash reports (minimal data)
    performance: true     // Performance metrics
  };

  const DEFAULT_SETTINGS = {
    retentionDays: 30,
    sampleRate: 1.0,      // 100% - can be reduced for privacy
    maxEventsPerSession: 1000,
    enableDebug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  let consent = { ...DEFAULT_CONSENT };
  let settings = { ...DEFAULT_SETTINGS };
  let sessionEvents = [];
  let sessionId = generateSessionId();
  let initialized = false;

  // ============================================================
  // UTILITIES
  // ============================================================

  function generateSessionId() {
    return 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }

  function generateEventId() {
    return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }

  function generateTraceId() {
    return 'trc_' + Math.random().toString(36).slice(2, 18);
  }

  function getTimestamp() {
    return new Date().toISOString();
  }

  function getContext() {
    const ctx = {
      session_id: sessionId,
      timestamp: getTimestamp()
    };
    
    try {
      if (typeof window !== 'undefined' && window && window.location) {
        ctx.page_url = window.location.href;
      }
    } catch (e) {}
    
    try {
      if (typeof navigator !== 'undefined' && navigator && navigator.userAgent) {
        ctx.user_agent = navigator.userAgent;
      }
    } catch (e) {}
    
    return ctx;
  }

  // ============================================================
  // STORAGE
  // ============================================================

  async function Storage() {
    return chrome.storage;
  }

  async function loadConsent() {
    try {
      const storage = await Storage();
      const result = await storage.local.get(STORAGE_KEYS.CONSENT);
      if (result[STORAGE_KEYS.CONSENT]) {
        consent = { ...DEFAULT_CONSENT, ...result[STORAGE_KEYS.CONSENT] };
      }
    } catch (e) {
      console.warn('[Telemetry] Failed to load consent:', e);
    }
  }

  async function saveConsent() {
    try {
      const storage = await Storage();
      await storage.local.set({ [STORAGE_KEYS.CONSENT]: consent });
    } catch (e) {
      console.warn('[Telemetry] Failed to save consent:', e);
    }
  }

  async function loadSettings() {
    try {
      const storage = await Storage();
      const result = await storage.local.get(STORAGE_KEYS.SETTINGS);
      if (result[STORAGE_KEYS.SETTINGS]) {
        settings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
      }
    } catch (e) {
      console.warn('[Telemetry] Failed to load settings:', e);
    }
  }

  async function saveSettings() {
    try {
      const storage = await Storage();
      await storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    } catch (e) {
      console.warn('[Telemetry] Failed to save settings:', e);
    }
  }

  async function loadEvents() {
    try {
      const storage = await Storage();
      const result = await storage.local.get(STORAGE_KEYS.EVENTS);
      return result[STORAGE_KEYS.EVENTS] || [];
    } catch (e) {
      console.warn('[Telemetry] Failed to load events:', e);
      return [];
    }
  }

  async function saveEvents(events) {
    try {
      const storage = await Storage();
      const bytesUsed = await storage.local.getBytesInUse(STORAGE_KEYS.EVENTS).catch(() => 0);
      
      if (bytesUsed > 4 * 1024 * 1024) {
        console.warn('[Telemetry] Storage quota exceeded, trimming events');
        events = events.slice(-1000);
      }
      
      await storage.local.set({ [STORAGE_KEYS.EVENTS]: events });
    } catch (e) {
      console.warn('[Telemetry] Failed to save events:', e);
    }
  }

  // ============================================================
  // CONSENT MANAGEMENT
  // ============================================================

  function getConsent() {
    return { ...consent };
  }

  function setConsent(newConsent) {
    consent = { ...consent, ...newConsent };
    saveConsent();
    return consent;
  }

  function hasConsent(category) {
    return consent[category] === true;
  }

  // ============================================================
  // EVENT TRACKING
  // ============================================================

  function shouldTrack() {
    return initialized && consent.analytics;
  }

  function track(eventName, properties = {}, options = {}) {
    if (!initialized) {
      console.warn('[Telemetry] Not initialized');
      return null;
    }

    if (typeof eventName !== 'string' || !eventName) {
      console.warn('[Telemetry] Invalid eventName');
      return null;
    }

    if (typeof properties !== 'object' || properties === null) {
      properties = {};
    }

    if (typeof options !== 'object' || options === null) {
      options = {};
    }

    if (options.error && !consent.errorReporting) {
      return null;
    }
    if (options.performance && !consent.performance) {
      return null;
    }
    if (!options.error && !options.performance && !consent.analytics) {
      return null;
    }

    // Sampling check for analytics events
    if (!options.error && !options.performance && Math.random() > settings.sampleRate) {
      return null;
    }

    // Check session limit
    if (sessionEvents.length >= settings.maxEventsPerSession) {
      sessionEvents.shift(); // Remove oldest
    }

    const event = {
      id: generateEventId(),
      name: eventName,
      timestamp: getTimestamp(),
      trace_id: options.traceId || generateTraceId(),
      properties: sanitizeProperties(properties),
      context: options.includeContext !== false ? getContext() : undefined,
      type: options.error ? 'error' : options.performance ? 'performance' : 'analytics'
    };

    sessionEvents.push(event);

    // Auto-save periodically
    if (sessionEvents.length % 10 === 0) {
      flushEvents();
    }

    return event;
  }

  function sanitizeProperties(props) {
    // Remove PII and sensitive data
    const sanitized = {};
    const piiPatterns = /email|password|token|secret|key|ssn|card|credit|debit|phone|address|name/i;

    for (const key in props) {
      if (piiPatterns.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof props[key] === 'string' && props[key].length > 500) {
        sanitized[key] = props[key].slice(0, 500) + '...[truncated]';
      } else {
        sanitized[key] = props[key];
      }
    }

    return sanitized;
  }

  // Convenience tracking methods
  function trackFeatureUsed(featureName, properties = {}) {
    return track('feature_used', { feature_name: featureName, ...properties });
  }

  function trackError(error, context = {}) {
    const err = error instanceof Error ? error : new Error(String(error));
    const stack = err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : '';
    
    return track('error', {
      error_type: err.name || 'Error',
      error_message: err.message || String(error),
      stack: stack,
      ...context
    }, { error: true });
  }

  function trackPerformance(name, metrics) {
    return track('performance', {
      metric_name: name,
      ...metrics
    }, { performance: true });
  }

  function trackSecurity(eventType, details = {}) {
    return track('security', {
      event_type: eventType,
      ...details
    }, { error: true }); // Treat security events as errors for consent
  }

  function trackPageView(pageName, properties = {}) {
    return track('page_view', { page: pageName, ...properties });
  }

  function trackAction(action, properties = {}) {
    return track('action', { action, ...properties });
  }

  // ============================================================
  // FLUSH & EXPORT
  // ============================================================

  async function flushEvents() {
    if (sessionEvents.length === 0) return;

    try {
      const storage = await Storage();
      const existing = await loadEvents();
      const allEvents = [...existing, ...sessionEvents];

      // Apply retention policy
      const cutoff = Date.now() - (settings.retentionDays * 24 * 60 * 60 * 1000);
      const filtered = allEvents.filter(e => new Date(e.timestamp).getTime() > cutoff);

      // Limit total stored events
      const limited = filtered.slice(-5000);

      await saveEvents(limited);
      sessionEvents = [];
    } catch (e) {
      console.warn('[Telemetry] Failed to flush events:', e);
    }
  }

  async function getEvents(options = {}) {
    const events = await loadEvents();

    let filtered = events;

    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    if (options.from) {
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= options.from);
    }
    if (options.to) {
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= options.to);
    }
    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  async function exportEvents(format = 'json') {
    const events = await getEvents();

    if (format === 'csv') {
      if (events.length === 0) return '';

      const headers = ['id', 'name', 'timestamp', 'type', 'properties'];
      const rows = events.map(e => [
        e.id,
        e.name,
        e.timestamp,
        e.type,
        JSON.stringify(e.properties)
      ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    return JSON.stringify(events, null, 2);
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  async function getStats() {
    const events = await loadEvents();

    const stats = {
      total_events: events.length,
      by_type: {},
      by_feature: {},
      date_range: null,
      session_count: 0
    };

    if (events.length === 0) return stats;

    // Count by type
    for (const e of events) {
      stats.by_type[e.type] = (stats.by_type[e.type] || 0) + 1;

      if (e.properties?.feature_name) {
        stats.by_feature[e.properties.feature_name] = (stats.by_feature[e.properties.feature_name] || 0) + 1;
      }
    }

    // Date range
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    stats.date_range = {
      oldest: new Date(Math.min(...timestamps)).toISOString(),
      newest: new Date(Math.max(...timestamps)).toISOString()
    };

    // Session count (unique trace_ids)
    stats.session_count = new Set(events.map(e => e.context?.session_id)).size;

    return stats;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function init(options = {}) {
    if (initialized) {
      console.warn('[Telemetry] Already initialized');
      return;
    }

    settings = { ...settings, ...options };
    await loadSettings();
    await loadConsent();

    // Set up automatic flush
    setInterval(flushEvents, 60000); // Every minute

    // Set up storage listener for other contexts
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (changes[STORAGE_KEYS.CONSENT]) {
          consent = { ...DEFAULT_CONSENT, ...changes[STORAGE_KEYS.CONSENT].newValue };
        }
      });
    }

    initialized = true;
    console.log('[Telemetry] Initialized v' + TELEMETRY_VERSION, { consent, settings });
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  async function clearAllData() {
    try {
      const storage = await Storage();
      await storage.local.remove([STORAGE_KEYS.EVENTS, STORAGE_KEYS.CONSENT, STORAGE_KEYS.SETTINGS]);
      sessionEvents = [];
      consent = { ...DEFAULT_CONSENT };
      settings = { ...DEFAULT_SETTINGS };
      console.log('[Telemetry] All data cleared');
    } catch (e) {
      console.warn('[Telemetry] Failed to clear data:', e);
    }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  const Telemetry = {
    // Initialization
    init,
    version: TELEMETRY_VERSION,

    // Consent
    getConsent,
    setConsent,
    hasConsent,

    // Tracking
    track,
    trackFeatureUsed,
    trackError,
    trackPerformance,
    trackSecurity,
    trackPageView,
    trackAction,

    // Data management
    flushEvents,
    getEvents,
    exportEvents,
    getStats,
    clearAllData,

    // Settings
    getSettings: () => ({ ...settings }),
    setSettings: (s) => { settings = { ...settings, ...s }; saveSettings(); return settings; }
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Telemetry;
  } else if (typeof global !== 'undefined') {
    global.VIVIMTelemetry = Telemetry;
  } else if (typeof window !== 'undefined') {
    window.VIVIMTelemetry = Telemetry;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);