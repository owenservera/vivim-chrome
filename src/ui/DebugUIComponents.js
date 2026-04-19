export class DebugUIComponents {
  constructor(debugManager, sidePanelController) {
    this.debugManager = debugManager;
    this.controller = sidePanelController;
    this.performanceCharts = new PerformanceCharts();
    this.realtimeMonitor = new RealtimeMonitor();
    
    this.activeTab = 'events';
    this.searchQuery = '';
    this.filters = { type: 'all', severity: 'all', timeRange: 'all' };
    this.expandedEntries = new Set();
    this.capturing = false;
this.shortcuts = {
      'Ctrl+F': 'focusSearch', 'Ctrl+K': 'focusSearch', 'Escape': 'clearSearch',
      '1': 'switchTab:events', '2': 'switchTab:streams', '3': 'switchTab:connections',
      '4': 'switchTab:performance', '5': 'switchTab:errors', '6': 'switchTab:study', '7': 'switchTab:parser',
      'e': 'toggleExpandAll', 'r': 'toggleRealtime', 'c': 'toggleCapture',
      ' ': 'togglePause', 'ArrowRight': 'stepForward', 'ArrowLeft': 'stepBackward'
    };
    
    this.parserState = {
      activeStreamId: null,
      playbackMode: 'playing',
      currentChunkIndex: 0,
      viewMode: 'split',
      streams: new Map(),
      bookmarks: new Set(),
      pinnedEntries: new Set()
    };
  }

  createEnhancedDebugPanel() {
    return `
      <div class="debug-panel-v2">
        <!-- Header -->
        <div class="debug-header">
          <div class="debug-header__title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M2 8h8M2 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Debug Console</span>
          </div>
          <div class="debug-header__actions">
            <button class="debug-icon-btn" id="debugRealtimeBtn" title="Real-time (r)" data-tooltip="Real-time updates">
              <svg class="realtime-icon ${this.realtimeMonitor.active ? 'active' : ''}" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 3v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="debug-icon-btn" id="debugExpandAllBtn" title="Expand/Collapse All (e)" data-tooltip="Expand/Collapse">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="debug-stats-bar" id="debugStats">
          <!-- Populated by updateStats() -->
        </div>

        <!-- Tabs -->
        <div class="debug-tabs" id="debugTabs">
          <button class="debug-tab active" data-tab="events">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 7h6M2 11h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Events</span>
          </button>
          <button class="debug-tab" data-tab="streams">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10c2-3 4-3 4 0s4-3 4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
            </svg>
            <span>Streams</span>
          </button>
          <button class="debug-tab" data-tab="connections">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="3" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="11" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="7" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M3 5v0M11 5v0M7 9V7" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Connections</span>
          </button>
          <button class="debug-tab" data-tab="performance">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 12V8l3-3 3 2 2-6 2 4v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Performance</span>
          </button>
          <button class="debug-tab" data-tab="errors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M7 4v4M7 9v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Errors</span>
          </button>
          <button class="debug-tab" data-tab="study">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 6h10M2 9h6M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="11" cy="11" r="2" fill="#dc3545"/>
            </svg>
            <span>Study</span>
          </button>
          <button class="debug-tab" data-tab="parser">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M4 5h2M4 7h2M4 9h2M8 5h2M8 7h2M8 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Parser</span>
          </button>
        </div>

        <!-- Search & Filters -->
        <div class="debug-search-bar">
          <div class="debug-search">
            <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input type="text" id="debugSearchInput" placeholder="Search events... (Ctrl+F)" />
            <button class="search-clear" id="debugClearSearch" title="Clear search (Esc)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="debug-filters">
            <select id="debugTypeFilter" class="debug-filter-select">
              <option value="all">All Types</option>
              <option value="request">Request</option>
              <option value="response">Response</option>
              <option value="stream">Stream</option>
              <option value="error">Error</option>
            </select>
            <select id="debugSeverityFilter" class="debug-filter-select">
              <option value="all">All Severity</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <select id="debugTimeFilter" class="debug-filter-select">
              <option value="all">All Time</option>
              <option value="5m">Last 5 min</option>
              <option value="15m">Last 15 min</option>
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
            </select>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="debug-content-area">
          <!-- Events Tab -->
          <div class="debug-tab-content active" data-tab="events">
            <div class="debug-events-list" id="debugData">
              <!-- Events populated here -->
            </div>
          </div>

          <!-- Streams Tab -->
          <div class="debug-tab-content" data-tab="streams">
            <div class="debug-streams-container">
              <div class="debug-streams-summary" id="debugStreamsSummary"></div>
              <div class="debug-streams-timeline" id="debugStreamsTimeline"></div>
            </div>
          </div>

          <!-- Connections Tab -->
          <div class="debug-tab-content" data-tab="connections">
            <div class="debug-connections-container">
              <div class="debug-connections-status" id="debugConnectionsStatus"></div>
              <div class="debug-connections-history" id="debugConnectionsHistory"></div>
            </div>
          </div>

          <!-- Performance Tab -->
          <div class="debug-tab-content" data-tab="performance">
            <div class="debug-performance-container">
              <div class="debug-performance-metrics" id="debugPerformanceMetrics"></div>
              <div class="debug-performance-charts" id="debugPerformanceCharts"></div>
            </div>
          </div>

          <!-- Errors Tab -->
          <div class="debug-tab-content" data-tab="errors">
            <div class="debug-errors-container">
              <div class="debug-errors-summary" id="debugErrorsSummary"></div>
              <div class="debug-errors-list" id="debugErrorsList"></div>
            </div>
          </div>

          <!-- Study Tab -->
          <div class="debug-tab-content" data-tab="study">
            <div class="debug-study-container">
              <div class="debug-study-header">
                <button id="studyRefreshBtn" class="debug-btn">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6c0-2.2 1.8-4 4-4M2 6c0 2.2 1.8 4 4 4M10 2v2M10 10v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  Refresh
                </button>
                <button id="studyExportBtn" class="debug-btn">Export</button>
                <button id="studyRunTestsBtn" class="debug-btn debug-btn--primary">Run Tests</button>
              </div>
              <div class="debug-study-summary" id="debugStudySummary"></div>
              <div class="debug-study-insights" id="debugStudyInsights"></div>
              <div class="debug-study-timeline" id="debugStudyTimeline"></div>
            </div>
          </div>

          <!-- Parser Tab -->
          <div class="debug-tab-content" data-tab="parser">
            <div class="debug-parser-container">
              <div class="debug-parser-header">
                <select id="parserStreamSelect" class="debug-filter-select">
                  <option value="">Select Stream...</option>
                </select>
                <div class="debug-parser-playback">
                  <button class="debug-icon-btn" id="parserPauseBtn" title="Pause (Space)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/>
                      <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="debug-icon-btn" id="parserStepBtn" title="Step Forward (→)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 2l6 5-6 5V2z" fill="currentColor"/>
                      <rect x="10" y="2" width="2" height="10" rx="1" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="debug-icon-btn" id="parserReplayBtn" title="Replay (R)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 6c0-2.2 1.8-4 4-4M2 6c0 2.2 1.8 4 4 4M10 2v2M10 10v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button class="debug-icon-btn" id="parserViewBtn" title="Toggle View (Split/Raw/Diff)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M5 5h4M5 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="debug-parser-state-machine" id="parserStateMachine"></div>
              <div class="debug-parser-panels">
                <div class="debug-parser-panel debug-parser-panel--raw" id="parserRawPanel">
                  <div class="panel-header">
                    <span>Raw Buffer</span>
                    <span class="panel-badge" id="rawBufferSize">0 B</span>
                  </div>
                  <pre class="panel-content" id="parserRawBuffer"></pre>
                </div>
                <div class="debug-parser-panel debug-parser-panel--parsed" id="parserParsedPanel">
                  <div class="panel-header">
                    <span>Parsed Delta</span>
                    <span class="panel-badge" id="parsedDeltaSize">+0 chars</span>
                  </div>
                  <pre class="panel-content" id="parserParsedDelta"></pre>
                </div>
              </div>
              <div class="debug-parser-footer">
                <div class="debug-parser-sse-events" id="parserSSEEvents">
                  <div class="section-header">SSE Events</div>
                  <div class="sse-events-list" id="parserSSEEventsList"></div>
                </div>
                <div class="debug-parser-toolcalls" id="parserToolCalls">
                  <div class="section-header">Tool Calls</div>
                  <div class="toolcalls-list" id="parserToolCallsList"></div>
                </div>
                <div class="debug-parser-accumulator" id="parserAccumulator">
                  <div class="section-header">Accumulator</div>
                  <pre class="accumulator-content" id="parserAccumulatorContent"></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="debug-actions">
          <button id="debugCaptureBtn" class="debug-btn debug-btn--primary">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Capture</span>
          </button>
          <button id="debugExportBtn" class="debug-btn" title="Export Data">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 8v2h8v-2M6 2v6M3 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Export</span>
          </button>
          <button id="debugImportBtn" class="debug-btn" title="Import Data">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 8v2h8v-2M6 6V2M3 3l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Import</span>
          </button>
          <button id="debugClearBtn" class="debug-btn debug-btn--danger" title="Clear All">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Clear</span>
          </button>
          <button id="debugCopyAllBtn" class="debug-btn" title="Copy All">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 3V2a1 1 0 00-1-1H4a1 1 0 00-1 1v1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Copy</span>
          </button>
        </div>

        <!-- Keyboard Shortcuts Hint -->
        <div class="debug-shortcuts-hint">
          <span class="shortcut"><kbd>1-7</kbd> Tabs</span>
          <span class="shortcut"><kbd>Ctrl+F</kbd> Search</span>
          <span class="shortcut"><kbd>E</kbd> Expand</span>
          <span class="shortcut"><kbd>R</kbd> Realtime</span>
        </div>
      </div>
    `;
  }

  /**
   * Initialize the enhanced debug UI
   */
  initialize(container) {
    container.innerHTML = this.createEnhancedDebugPanel();
    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.bindParserEvents();
    this.updateAllDisplays();
    this.startRealtimeUpdates();
  }

  /**
   * Bind all events
   */
  bindEvents() {
    // Tab switching
    document.querySelectorAll('.debug-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Search
    const searchInput = document.getElementById('debugSearchInput');
    const clearSearchBtn = document.getElementById('debugClearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.onSearch();
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          this.searchQuery = '';
          this.onSearch();
        }
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        this.onSearch();
      });
    }

    // Filters
    document.getElementById('debugTypeFilter')?.addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.onSearch();
    });
    document.getElementById('debugSeverityFilter')?.addEventListener('change', (e) => {
      this.filters.severity = e.target.value;
      this.onSearch();
    });
    document.getElementById('debugTimeFilter')?.addEventListener('change', (e) => {
      this.filters.timeRange = e.target.value;
      this.onSearch();
    });

    // Control buttons
    document.getElementById('debugCaptureBtn')?.addEventListener('click', () => this.toggleCapture());
    document.getElementById('debugExportBtn')?.addEventListener('click', () => this.showExportMenu());
    document.getElementById('debugImportBtn')?.addEventListener('click', () => this.importDebugData());
    document.getElementById('debugClearBtn')?.addEventListener('click', () => this.clearDebugData());
    document.getElementById('debugCopyAllBtn')?.addEventListener('click', () => this.copyDebugData());

    // Header buttons
    document.getElementById('debugRealtimeBtn')?.addEventListener('click', () => this.toggleRealtime());
    document.getElementById('debugExpandAllBtn')?.addEventListener('click', () => this.toggleExpandAll());

    // Study buttons
    document.getElementById('studyRefreshBtn')?.addEventListener('click', () => this.loadStudyData());
    document.getElementById('studyExportBtn')?.addEventListener('click', () => this.exportStudyData());
    document.getElementById('studyRunTestsBtn')?.addEventListener('click', () => this.runStudyTests());
  }

  exportStudyData() {
    chrome.storage.local.get(null).then(storage => {
      const studyKeys = Object.keys(storage).filter(k => k.startsWith('chatgpt-study-'));
      if (studyKeys.length === 0) return;
      const data = storage[studyKeys.sort().reverse()[0]];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatgpt-study-${Date.now()}.json`;
      a.click();
    });
  }

  async runStudyTests() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'runChatGPTTests', data: {} });
      if (resp?.success) {
        this.controller?.showToast?.('Tests completed');
        this.loadStudyData();
      }
    } catch (err) {
      this.controller?.showToast?.('Tests failed: ' + err.message);
    }
  }

  /**
   * Bind keyboard shortcuts
   */
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in input
      if (e.target.matches('input, textarea')) return;

      const key = e.ctrlKey ? `Ctrl+${e.key.toUpperCase()}` : e.key.toLowerCase();
      const action = this.shortcuts[key];

      if (action) {
        if (action.includes(':')) {
          const [cmd, arg] = action.split(':');
          if (cmd === 'switchTab') this.switchTab(arg);
        } else {
          this[action]?.();
        }
        e.preventDefault();
      }
    });
  }

  /**
   * Switch tab
   */
  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.debug-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.debug-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabName);
    });

    this.updateTabContent(tabName);
  }

  /**
   * Update tab content
   */
  updateTabContent(tabName) {
    switch (tabName) {
      case 'events': this.renderEventsTab(); break;
      case 'streams': this.renderStreamsTab(); break;
      case 'connections': this.renderConnectionsTab(); break;
      case 'performance': this.renderPerformanceTab(); break;
      case 'errors': this.renderErrorsTab(); break;
      case 'study': this.renderStudyTab(); break;
      case 'parser': this.renderParserTab(); break;
    }
  }

  /**
   * Update all displays
   */
  updateAllDisplays() {
    this.updateStats();
    this.updateTabContent(this.activeTab);
  }

  /**
   * Update stats bar
   */
  updateStats() {
    const statsEl = document.getElementById('debugStats');
    if (!statsEl) return;

    const stats = this.debugManager.getStats();
    const hasErrors = stats.errors?.total > 0;

    statsEl.innerHTML = `
      <div class="stat-item ${hasErrors ? 'stat-item--warning' : ''}">
        <div class="stat-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3h8M2 6h6M2 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${stats.totalEntries}</span>
          <span class="stat-label">Events</span>
        </div>
      </div>
      <div class="stat-item ${stats.errors?.total > 0 ? 'stat-item--error' : ''}">
        <div class="stat-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 4v3M6 8v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${stats.errors?.total || 0}</span>
          <span class="stat-label">Errors</span>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 9c2-2 3-2 4 0s4-2 4 0" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${stats.streams?.activeStreams || 0}</span>
          <span class="stat-label">Active Streams</span>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="3" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="9" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 5v1M9 5v1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${Object.keys(stats.connections || {}).filter(k => k !== 'providers' && k !== 'totalEvents').length}</span>
          <span class="stat-label">Connections</span>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4 6h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">${this.formatBytes(stats.memoryUsage || 0)}</span>
          <span class="stat-label">Memory</span>
        </div>
      </div>
    `;
  }

  renderEventsTab() {
    const container = document.getElementById('debugData');
    if (!container) return;

    let entries;
    try {
      entries = this.debugManager.getEntries('all', 500, {
        timeRange: this.filters.timeRange,
        severity: this.filters.severity,
        searchQuery: this.searchQuery
      });
    } catch (err) {
      entries = [];
    }

    if (this.filters.type !== 'all') {
      entries = entries.filter(e => e.type === this.filters.type);
    }

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <div class="empty-state__title">No events found</div>
          <div class="empty-state__desc">${this.searchQuery || this.filters.type !== 'all' || this.filters.severity !== 'all' ? 'Try adjusting your filters' : 'Click "Capture" to start monitoring events'}</div>
        </div>
      `;
      return;
    }

    const pinnedEntries = entries.filter(e => this.parserState.pinnedEntries.has(e.id));
    const otherEntries = entries.filter(e => !this.parserState.pinnedEntries.has(e.id));
    const displayEntries = [...pinnedEntries, ...otherEntries];

    container.innerHTML = displayEntries.map(entry => {
      const isExpanded = this.expandedEntries.has(entry.id);
      const isBookmarked = this.parserState.bookmarks.has(entry.id);
      const isPinned = this.parserState.pinnedEntries.has(entry.id);
      const provider = entry.metadata?.provider ? `<span class="debug-entry__provider">[${entry.metadata.provider}]</span>` : '';
      const streamId = entry.metadata?.streamId ? `<span class="debug-entry__stream" title="${entry.metadata.streamId}">[stream: ${entry.metadata.streamId.slice(0,8)}]</span>` : '';
      const showRaw = entry.showRaw || false;
      const contentDisplay = showRaw && entry.raw ? entry.raw : (isExpanded ? this.formatJSON(entry.data) : this.truncate(JSON.stringify(entry.data), 200));
      
      return `
        <div class="debug-entry ${entry.severity || 'info'} ${entry.type} ${isExpanded ? 'expanded' : ''}" data-id="${entry.id}">
          <div class="debug-entry__header" data-action="toggle">
            <button class="debug-entry__bookmark ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark" title="Bookmark">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5">
                <path d="M2 3h8M2 6h8M2 9h6v6H2z"/>
              </svg>
            </button>
            <button class="debug-entry__pin ${isPinned ? 'pinned' : ''}" data-action="pin" title="${isPinned ? 'Unpin' : 'Pin to top'}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 2h8v3l-1 1-1-1V2M4 6v6"/>
              </svg>
            </button>
            <div class="debug-entry__meta">
              <span class="debug-entry__type">${entry.type?.toUpperCase() || 'EVENT'}</span>
              <span class="debug-entry__severity ${entry.severity || 'info'}">${entry.severity || 'info'}</span>
              ${provider}${streamId}
            </div>
            <div class="debug-entry__time">${this.formatTime(entry.timestamp)}</div>
            <button class="debug-entry__copy" data-action="copy" title="Copy to clipboard">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <path d="M9 3V2a1 1 0 00-1-1H4a1 1 0 00-1 1v1"/>
              </svg>
            </button>
            <button class="debug-entry__expand" data-action="expand" title="${isExpanded ? 'Collapse' : 'Expand'}">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="transform: rotate(${isExpanded ? 180 : 0}deg)">
                <path d="M2 3l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="debug-entry__content">
            <pre>${this.escapeHtml(contentDisplay)}</pre>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.debug-entry__header [data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const entryEl = btn.closest('.debug-entry');
        const id = entryEl?.dataset.id;
        if (!id) return;

        if (action === 'bookmark') {
          if (this.parserState.bookmarks.has(id)) {
            this.parserState.bookmarks.delete(id);
          } else {
            this.parserState.bookmarks.add(id);
          }
        } else if (action === 'pin') {
          if (this.parserState.pinnedEntries.has(id)) {
            this.parserState.pinnedEntries.delete(id);
          } else {
            this.parserState.pinnedEntries.add(id);
          }
        } else if (action === 'copy') {
          const entry = entries.find(e => e.id === id);
          if (entry) {
            const text = entry.raw || JSON.stringify(entry.data, null, 2);
            navigator.clipboard.writeText(text).then(() => {
              this.controller?.showToast?.('Copied to clipboard');
            });
          }
        } else if (action === 'expand') {
          if (this.expandedEntries.has(id)) {
            this.expandedEntries.delete(id);
          } else {
            this.expandedEntries.add(id);
          }
        }
        this.renderEventsTab();
      });
    });
  }

  /**
   * Render streams tab
   */
  renderStreamsTab() {
    const summaryEl = document.getElementById('debugStreamsSummary');
    const timelineEl = document.getElementById('debugStreamsTimeline');

    if (summaryEl) {
      const stats = this.debugManager.streamCapture?.getStats?.() || {};
      summaryEl.innerHTML = `
        <div class="streams-summary">
          <div class="summary-metric">
            <span class="metric-value">${stats.totalStreams || 0}</span>
            <span class="metric-label">Total</span>
          </div>
          <div class="summary-metric">
            <span class="metric-value">${stats.activeStreams || 0}</span>
            <span class="metric-label">Active</span>
          </div>
          <div class="summary-metric">
            <span class="metric-value">${stats.avgDuration ? (stats.avgDuration / 1000).toFixed(1) + 's' : 'N/A'}</span>
            <span class="metric-label">Avg Duration</span>
          </div>
        </div>
      `;
    }

    if (timelineEl) {
      const streams = Array.from(this.debugManager.streamCapture?.streams?.values?.() || [])
        .filter(s => s.events?.length > 0)
        .slice(-10);

      timelineEl.innerHTML = streams.length === 0 ? `
        <div class="empty-state empty-state--small">
          <div class="empty-state__title">No streams yet</div>
        </div>
      ` : streams.map(stream => `
        <div class="stream-timeline-item">
          <div class="stream-header">
            <span class="stream-id">${stream.id?.slice(0, 8) || 'unknown'}...</span>
            <span class="stream-duration">${stream.duration ? (stream.duration / 1000).toFixed(2) + 's' : 'Active'}</span>
          </div>
          <div class="stream-events">
            ${stream.events?.slice(-15).map(event => `
              <div class="stream-event ${event.type}">
                <span class="event-type">${event.type}</span>
                <span class="event-time">${this.formatTime(event.timestamp)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  /**
   * Render connections tab
   */
  renderConnectionsTab() {
    const statusEl = document.getElementById('debugConnectionsStatus');
    const historyEl = document.getElementById('debugConnectionsHistory');

    if (statusEl) {
      const stats = this.debugManager.connectionMonitor?.getStats?.() || {};
      const providers = Object.entries(stats).filter(([k]) => k !== 'providers' && k !== 'totalEvents');
      
      statusEl.innerHTML = providers.length === 0 ? `
        <div class="empty-state empty-state--small">
          <div class="empty-state__title">No connections</div>
        </div>
      ` : providers.map(([provider, data]) => `
        <div class="connection-status-item">
          <div class="provider-name">${provider}</div>
          <div class="connection-metrics">
            <span class="metric ${data.status}">${data.status || 'unknown'}</span>
            <span class="metric">${((data.successRate || 0) * 100).toFixed(0)}%</span>
            <span class="metric">${data.totalAttempts || 0} attempts</span>
          </div>
        </div>
      `).join('');
    }

    if (historyEl) {
      const events = this.debugManager.connectionMonitor?.events?.slice(-30) || [];
      historyEl.innerHTML = events.length === 0 ? '' : events.map(event => {
        const isError = event.type?.includes('failed') || event.type?.includes('error');
        const dataStr = event.data ? this.escapeHtml(this.truncate(JSON.stringify(event.data), 300)) : '';
        return `
        <div class="connection-event ${event.type} ${isError ? 'error' : ''}">
          <div class="event-header">
            <span class="provider">${event.provider}</span>
            <span class="event-type ${isError ? 'error' : ''}">${event.type}</span>
            <span class="timestamp">${this.formatTime(event.timestamp)}</span>
          </div>
          ${dataStr ? `<div class="event-data"><pre>${dataStr}</pre></div>` : ''}
        </div>
      `}).join('');
    }
  }

  /**
   * Render performance tab
   */
  renderPerformanceTab() {
    const metricsEl = document.getElementById('debugPerformanceMetrics');
    const chartsEl = document.getElementById('debugPerformanceCharts');

    if (metricsEl) {
      const perfStats = this.debugManager.performanceMonitor?.getStats?.() || {};
      const entries = Object.entries(perfStats);

      metricsEl.innerHTML = entries.length === 0 ? `
        <div class="empty-state empty-state--small">
          <div class="empty-state__title">No metrics</div>
        </div>
      ` : entries.map(([metric, data]) => `
        <div class="metric-card">
          <div class="metric-name">${metric}</div>
          <div class="metric-bar-container">
            <div class="metric-bar" style="width: ${Math.min((data.avg / (data.max || 1)) * 100, 100)}%"></div>
          </div>
          <div class="metric-values">
            <span>avg: ${data.avg?.toFixed(1) || 0}ms</span>
            <span>min: ${data.min?.toFixed(1) || 0}</span>
            <span>max: ${data.max?.toFixed(1) || 0}</span>
          </div>
        </div>
      `).join('');
    }

    if (chartsEl) {
      chartsEl.innerHTML = this.performanceCharts.renderCharts(this.debugManager.performanceMonitor);
    }
  }

/**
 * Render errors tab
 */
  renderErrorsTab() {
    const summaryEl = document.getElementById('debugErrorsSummary');
    const listEl = document.getElementById('debugErrorsList');

    if (summaryEl) {
      const errorStats = this.debugManager.errorTracker?.getStats?.() || {};
      summaryEl.innerHTML = `
        <div class="errors-summary">
          <div class="summary-metric summary-metric--error">
            <span class="metric-value">${errorStats.total || 0}</span>
            <span class="metric-label">Total Errors</span>
          </div>
        </div>
      `;
    }

    if (listEl) {
      const patterns = Array.from(this.debugManager.errorTracker?.errorPatterns?.values?.() || []).slice(0, 15);
      
      listEl.innerHTML = patterns.length === 0 ? `
        <div class="empty-state empty-state--small">
          <div class="empty-state__title">No error patterns</div>
        </div>
      ` : patterns.map(pattern => `
        <div class="error-pattern">
          <div class="error-header">
            <span class="error-category ${pattern.category}">${pattern.category}</span>
            <span class="error-frequency">x${pattern.frequency}</span>
          </div>
          <div class="error-message">${this.escapeHtml(pattern.message?.slice(0, 200))}</div>
        </div>
      `).join('');
    }
  }

  renderStudyTab() {
    this.loadStudyData();
  }

  async loadStudyData() {
    const summaryEl = document.getElementById('debugStudySummary');
    const insightsEl = document.getElementById('debugStudyInsights');
    const timelineEl = document.getElementById('debugStudyTimeline');
    
    if (!summaryEl) return;

    try {
      const storage = await chrome.storage.local.get(null);
      const studyKeys = Object.keys(storage).filter(k => k.startsWith('chatgpt-study-'));
      
      if (studyKeys.length === 0) {
        summaryEl.innerHTML = '<div class="empty-state"><div class="empty-state__title">No Study Data</div><div class="empty-state__desc">Run ChatGPT interactions to collect data</div></div>';
        return;
      }

      const mostRecentKey = studyKeys.sort().reverse()[0];
      const studyData = storage[mostRecentKey];
      
      if (!studyData) {
        summaryEl.innerHTML = '<div class="empty-state"><div class="empty-state__title">Error loading data</div></div>';
        return;
      }

      summaryEl.innerHTML = this.renderStudyStats(studyData);
      insightsEl.innerHTML = this.renderStudyInsights(studyData);
      timelineEl.innerHTML = this.renderStudyTimeline(studyData);
    } catch (err) {
      summaryEl.innerHTML = `<div class="empty-state"><div class="empty-state__title">Error: ${err.message}</div></div>`;
    }
  }

  renderStudyStats(studyData) {
    const networkEvents = studyData.networkEvents || [];
    const parsingEvents = studyData.parsingEvents || [];
    const uiEvents = studyData.uiEvents || [];
    const errors = studyData.errors || [];
    
    const totalStreams = new Set([...networkEvents.map(e => e.data?.streamId), ...parsingEvents.map(e => e.streamId), ...uiEvents.map(e => e.streamId)]).size;
    const emptyChunks = uiEvents.filter(e => !e.data?.chunk?.content || e.data.chunk.content.trim().length === 0).length;
    const jsonAttempts = parsingEvents.filter(e => e.type === 'json_parse_attempt');
    const parseSuccess = jsonAttempts.filter(e => e.data?.success).length;
    const parseRate = jsonAttempts.length > 0 ? (parseSuccess / jsonAttempts.length) * 100 : 100;

    return `
      <div class="study-stats">
        <div class="stat-card ${totalStreams > 0 ? 'success' : ''}">
          <div class="stat-value">${totalStreams}</div>
          <div class="stat-label">Total Streams</div>
        </div>
        <div class="stat-card ${parseRate < 90 ? 'error' : 'success'}">
          <div class="stat-value">${parseRate.toFixed(1)}%</div>
          <div class="stat-label">Parse Rate</div>
        </div>
        <div class="stat-card ${emptyChunks > 0 ? 'warning' : 'success'}">
          <div class="stat-value">${emptyChunks}</div>
          <div class="stat-label">Empty Chunks</div>
        </div>
        <div class="stat-card ${errors.length > 0 ? 'error' : 'success'}">
          <div class="stat-value">${errors.length}</div>
          <div class="stat-label">Errors</div>
        </div>
      </div>
    `;
  }

  renderStudyInsights(studyData) {
    const networkEvents = studyData.networkEvents || [];
    const parsingEvents = studyData.parsingEvents || [];
    const uiEvents = studyData.uiEvents || [];
    const errors = studyData.errors || [];
    
    const emptyChunks = uiEvents.filter(e => !e.data?.chunk?.content || e.data.chunk.content.trim().length === 0).length;
    const jsonAttempts = parsingEvents.filter(e => e.type === 'json_parse_attempt');
    const parseRate = jsonAttempts.length > 0 ? (jsonAttempts.filter(e => e.data?.success).length / jsonAttempts.length) * 100 : 100;
    const insights = [];

    if (emptyChunks > 0) {
      insights.push({ type: 'issue', title: 'Empty Chunks', desc: `${emptyChunks} empty chunks detected`, rec: 'Review content filtering' });
    }
    if (parseRate < 90) {
      insights.push({ type: 'issue', title: 'Parse Issues', desc: `Success rate: ${parseRate.toFixed(1)}%`, rec: 'Check JSON payloads' });
    }
    if (errors.length > 0) {
      insights.push({ type: 'issue', title: 'Streaming Errors', desc: `${errors.length} errors detected`, rec: 'Review error handling' });
    }
    if (insights.length === 0) {
      insights.push({ type: 'positive', title: 'All Good', desc: 'No issues detected', rec: null });
    }

    return `
      <div class="study-insights">
        ${insights.map(i => `<div class="insight-card ${i.type}"><strong>${i.title}</strong><p>${i.desc}</p>${i.rec ? `<p><em>${i.rec}</em></p>` : ''}</div>`).join('')}
      </div>
    `;
  }

  renderStudyTimeline(studyData) {
    const allEvents = [
      ...(studyData.networkEvents || []).map(e => ({ ...e, cat: 'network' })),
      ...(studyData.parsingEvents || []).map(e => ({ ...e, cat: 'parsing' })),
      ...(studyData.uiEvents || []).map(e => ({ ...e, cat: 'ui' })),
      ...(studyData.errors || []).map(e => ({ ...e, cat: 'error' }))
    ].sort((a, b) => a.timestamp - b.timestamp).slice(-30);

    if (allEvents.length === 0) {
      return '<div class="empty-state"><div class="empty-state__title">No events</div></div>';
    }

    return `
      <div class="study-timeline">
        ${allEvents.map(e => {
          const time = new Date(e.timestamp).toLocaleTimeString();
          const type = e.type?.replace(/_/g, ' ');
          return `<div class="timeline-item ${e.cat}"><div class="time">${time}</div><div class="type">${type}</div></div>`;
        }).join('')}
      </div>
    `;
  }

  renderParserTab() {
    this.updateParserStreamSelect();
    this.renderStateMachine();
    this.renderRawBufferPanel();
    this.renderParsedDeltaPanel();
    this.renderSSEEvents();
    this.renderToolCalls();
    this.renderAccumulator();
  }

  updateParserStreamSelect() {
    const select = document.getElementById('parserStreamSelect');
    if (!select) return;

    const streams = this.debugManager.streamCapture?.streams || new Map();
    const streamOptions = Array.from(streams.keys()).slice(0, 50).map(id => {
      const stream = streams.get(id);
      const status = stream.endTime ? 'complete' : 'active';
      const duration = stream.duration ? (stream.duration / 1000).toFixed(1) + 's' : 'active';
      return `<option value="${id}">${id?.slice(0, 12)}... [${status}] ${duration}</option>`;
    });

    select.innerHTML = streamOptions.length > 0 ? streamOptions.join('') : '<option value="">No streams available</option>';

    if (this.parserState.activeStreamId && !select.querySelector(`option[value="${this.parserState.activeStreamId}"]`)) {
      select.value = this.parserState.activeStreamId;
    }
  }

  renderStateMachine() {
    const container = document.getElementById('parserStateMachine');
    if (!container) return;

    const states = ['IDLE', 'CONNECTING', 'ROLE_RECEIVED', 'STREAMING', 'TOOL_CALLING', 'FINISHING', 'DONE', 'ERROR'];
    const currentState = this.parserState.activeStreamId ? this.parserState.playbackMode.toUpperCase() : 'IDLE';

    const getStateColor = (state) => {
      if (state === currentState) return '#10B981';
      if (states.indexOf(state) < states.indexOf(currentState)) return '#3B82F6';
      return '#6B7280';
    };

    const stateHtml = states.map((state, i) => {
      const color = getStateColor(state);
      const prevState = states[i - 1];
      return `
        ${prevState ? `<span class="state-arrow">→</span>` : ''}
        <span class="state-node" style="color: ${color}; ${state === currentState ? 'font-weight: bold;' : ''}">${state}</span>
      `;
    }).join('');

    container.innerHTML = `<div class="state-machine">${stateHtml}</div>`;
  }

  renderRawBufferPanel() {
    const bufferEl = document.getElementById('parserRawBuffer');
    const sizeEl = document.getElementById('rawBufferSize');
    if (!bufferEl) return;

    const streamData = this.getStreamData();
    const rawBuffer = streamData?.rawBuffer || '';

    bufferEl.textContent = rawBuffer || 'No data';
    if (sizeEl) sizeEl.textContent = this.formatBytes(rawBuffer.length);
  }

  renderParsedDeltaPanel() {
    const deltaEl = document.getElementById('parserParsedDelta');
    const sizeEl = document.getElementById('parsedDeltaSize');
    if (!deltaEl) return;

    try {
      const streamData = this.getStreamData();
      const chunks = streamData?.chunks || [];
      const currentIndex = this.parserState.currentChunkIndex;
      const currentChunk = chunks[currentIndex - 1];
      const prevChunk = chunks[currentIndex - 2];

      let content = '';
      let deltaSize = '+0 chars';

      if (this.parserState.viewMode === 'diff' && prevChunk && currentChunk) {
        const prevText = prevChunk.cumulative || prevChunk.delta || '';
        const currText = currentChunk.cumulative || currentChunk.delta || '';
        content = this.computeDiff(prevText, currText);
        const delta = currText.length - prevText.length;
        deltaSize = delta >= 0 ? `+${delta} chars diff` : `${delta} chars diff`;
      } else if (currentChunk) {
        const rawContent = currentChunk.delta || currentChunk.cumulative || currentChunk.data?.content || '';
        content = this.parserState.viewMode === 'raw'
          ? JSON.stringify(currentChunk, null, 2)
          : rawContent;

        if (prevChunk) {
          const prevText = prevChunk.cumulative || prevChunk.delta || currentChunk.data?.content || '';
          const delta = content.length - prevText.length;
          deltaSize = delta >= 0 ? `+${delta} chars` : `${delta} chars`;
        }
      }

      deltaEl.innerHTML = content || '<span style="color: var(--text-tertiary)">No data</span>';
      if (sizeEl) sizeEl.textContent = deltaSize;
    } catch (err) {
      deltaEl.innerHTML = '<span style="color: var(--text-tertiary)">Error rendering delta</span>';
    }
  }

  computeDiff(oldText, newText) {
    try {
      if (!oldText || !newText) return this.escapeHtml(newText || oldText || '');
      
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      const result = [];
      
      for (let i = 0; i < newLines.length; i++) {
        const newLine = newLines[i];
        const oldLine = oldLines[i];
        
        if (oldLine === newLine) {
          result.push(`<span class="diff-line">${this.escapeHtml(newLine)}</span>`);
        } else if (!oldLine) {
          result.push(`<span class="diff-line diff-added">+ ${this.escapeHtml(newLine)}</span>`);
        } else {
          result.push(`<span class="diff-line diff-removed">- ${this.escapeHtml(oldLine)}</span>`);
          result.push(`<span class="diff-line diff-added">+ ${this.escapeHtml(newLine)}</span>`);
        }
      }
      
      return result.join('\n');
    } catch (err) {
      return this.escapeHtml(newText || oldText || '');
    }
  }

  renderSSEEvents() {
    const listEl = document.getElementById('parserSSEEventsList');
    if (!listEl) return;

    const streamData = this.getStreamData();
    const events = streamData?.events || [];

    if (events.length === 0) {
      listEl.innerHTML = '<div class="empty-state empty-state--small">No events</div>';
      return;
    }

    listEl.innerHTML = events.slice(-20).map((event, i) => {
      const type = event.type || 'message';
      const success = event.parsed !== false;
      const statusClass = success ? 'success' : 'error';
      const statusIcon = success ? '✓' : '✗';
      return `
        <div class="sse-event ${statusClass}">
          <span class="event-seq">#${i + 1}</span>
          <span class="event-type">${type}</span>
          <span class="event-status">${statusIcon}</span>
        </div>
      `;
    }).join('');
  }

  renderToolCalls() {
    const listEl = document.getElementById('parserToolCallsList');
    if (!listEl) return;

    const streamData = this.getStreamData();
    const toolCalls = streamData?.toolCalls || [];

    if (toolCalls.length === 0) {
      listEl.innerHTML = '<div class="empty-state empty-state--small">No tool calls</div>';
      return;
    }

    listEl.innerHTML = toolCalls.map((tc, i) => {
      const status = tc.status || 'pending';
      return `
        <div class="tool-call-item ${status}">
          <span class="tool-index">[${tc.index || i}]</span>
          <span class="tool-name">${tc.function?.name || 'unknown'}</span>
          <span class="tool-status">${status}</span>
        </div>
      `;
    }).join('');
  }

  renderAccumulator() {
    const contentEl = document.getElementById('parserAccumulatorContent');
    if (!contentEl) return;

    const streamData = this.getStreamData();
    const accumulator = streamData?.accumulator || {};

    const display = {
      messageParts: accumulator.messageParts?.slice(0, 3) || [],
      currentRole: accumulator.currentRole?.value,
      currentModel: accumulator.currentModel?.value,
      chunkCount: accumulator.chunkCount || 0
    };

    contentEl.textContent = JSON.stringify(display, null, 2);
  }

  getStreamData() {
    if (!this.parserState.activeStreamId) return null;
    const streams = this.debugManager.streamCapture?.streams || new Map();
    return streams.get(this.parserState.activeStreamId);
  }

  togglePause() {
    this.parserState.playbackMode = this.parserState.playbackMode === 'paused' ? 'playing' : 'paused';
    const btn = document.getElementById('parserPauseBtn');
    if (btn) {
      btn.classList.toggle('active', this.parserState.playbackMode === 'paused');
    }
    this.renderStateMachine();
  }

  stepForward() {
    const streamData = this.getStreamData();
    if (!streamData) return;
    const maxIndex = streamData.chunksReceived || 0;
    if (this.parserState.currentChunkIndex < maxIndex) {
      this.parserState.currentChunkIndex++;
      if (this.parserState.playbackMode !== 'paused') {
        this.parserState.playbackMode = 'stepping';
      }
      this.renderParsedDeltaPanel();
    }
  }

  stepBackward() {
    if (this.parserState.currentChunkIndex > 0) {
      this.parserState.currentChunkIndex--;
      this.renderParsedDeltaPanel();
    }
  }

  replay() {
    this.parserState.currentChunkIndex = 0;
    this.parserState.playbackMode = 'playing';
    this.renderParsedDeltaPanel();
    this.renderStateMachine();
  }

  toggleRawView() {
    const modes = ['split', 'raw', 'diff'];
    const currentIndex = modes.indexOf(this.parserState.viewMode);
    this.parserState.viewMode = modes[(currentIndex + 1) % modes.length];
    const btn = document.getElementById('parserViewBtn');
    if (btn) {
      btn.classList.toggle('active', this.parserState.viewMode !== 'split');
    }
    this.renderRawBufferPanel();
    this.renderParsedDeltaPanel();
  }

  bindParserEvents() {
    const streamSelect = document.getElementById('parserStreamSelect');
    if (streamSelect) {
      streamSelect.addEventListener('change', (e) => {
        this.parserState.activeStreamId = e.target.value;
        this.parserState.currentChunkIndex = 0;
        this.renderParserTab();
      });
    }

    document.getElementById('parserPauseBtn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('parserStepBtn')?.addEventListener('click', () => this.stepForward());
    document.getElementById('parserReplayBtn')?.addEventListener('click', () => this.replay());
    document.getElementById('parserViewBtn')?.addEventListener('click', () => this.toggleRawView());
  }

  /**
   * Search handler
   */
  onSearch() {
    if (this.activeTab === 'events') {
      this.renderEventsTab();
    }
  }

  /**
   * Toggle capture
   */
  toggleCapture() {
    this.capturing = !this.capturing;
    const btn = document.getElementById('debugCaptureBtn');
    if (btn) {
      btn.classList.toggle('active', this.capturing);
      btn.querySelector('span').textContent = this.capturing ? 'Stop' : 'Capture';
    }
    if (this.controller) {
      this.controller.toggleDebugCapture();
    }
  }

  /**
   * Toggle realtime
   */
  toggleRealtime() {
    this.realtimeMonitor.active = !this.realtimeMonitor.active;
    const btn = document.getElementById('debugRealtimeBtn');
    if (btn) {
      btn.classList.toggle('active', this.realtimeMonitor.active);
    }
    if (this.realtimeMonitor.active) {
      this.startRealtimeUpdates();
    }
  }

  /**
   * Toggle expand all
   */
  toggleExpandAll() {
    if (this.expandedEntries.size > 0) {
      this.expandedEntries.clear();
    } else {
      const entries = this.debugManager.getEntries('all', 100);
      for (const e of entries) {
      this.expandedEntries.add(e.id);
    }
    }
    this.renderEventsTab();
  }

  /**
   * Show export menu
   */
  showExportMenu() {
    const existing = document.querySelector('.export-menu-v2');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'export-menu-v2';
    menu.innerHTML = `
      <button class="export-option" data-format="json">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        JSON
      </button>
      <button class="export-option" data-format="csv">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        CSV
      </button>
      <button class="export-option" data-format="clipboard">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Copy to Clipboard
      </button>
    `;

    const exportBtn = document.getElementById('debugExportBtn');
    if (exportBtn) {
      const rect = exportBtn.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.left = `${rect.left}px`;
      menu.style.top = `${rect.bottom + 4}px`;
      document.body.appendChild(menu);

      menu.querySelectorAll('.export-option').forEach(btn => {
        btn.addEventListener('click', () => {
          this.exportDebugData(btn.dataset.format);
          menu.remove();
        });
      });

      setTimeout(() => {
        document.addEventListener('click', function handler(e) {
          if (!menu.contains(e.target) && e.target !== exportBtn) {
            menu.remove();
            document.removeEventListener('click', handler);
          }
        });
      }, 0);
    }
  }

  /**
   * Export debug data
   */
  exportDebugData(format = 'json') {
    const entries = this.debugManager.getEntries('all', 500);

    switch (format) {
      case 'json':
        this.exportJSON(entries);
        break;
      case 'csv':
        this.exportCSV(entries);
        break;
      case 'clipboard':
        this.copyToClipboard(entries);
        break;
    }
  }

  exportJSON(entries) {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.downloadBlob(blob, `vivim-debug-${Date.now()}.json`);
  }

  exportCSV(entries) {
    if (entries.length === 0) return;
    const headers = ['timestamp', 'type', 'severity', 'data'];
    const rows = entries.map(e => [
      new Date(e.timestamp).toISOString(),
      e.type || '',
      e.severity || '',
      (e.raw || '').replace(/"/g, '""')
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, `vivim-debug-${Date.now()}.csv`);
  }

  copyToClipboard(entries) {
    const text = entries.map(e => {
      const timestamp = new Date(e.timestamp).toISOString();
      const severity = e.severity || 'info';
      const category = e.category || 'general';
      const provider = e.metadata?.provider || '';
      const streamId = e.metadata?.streamId || '';
      const dataStr = e.data ? JSON.stringify(e.data, null, 2) : '';
      return `[${e.type.toUpperCase()}] ${timestamp}\nseverity: ${severity} | category: ${category}${provider ? `\nprovider: ${provider}` : ''}${streamId ? `\nstreamId: ${streamId}` : ''}\n${dataStr}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.controller?.showToast?.('Copied to clipboard');
    });
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import debug data
   */
  importDebugData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          this.debugManager.importData?.(JSON.stringify(data));
          this.updateAllDisplays();
          this.controller?.showToast?.(`Imported ${data.length} entries`);
        }
      } catch (err) {
        this.controller?.showToast?.('Import failed: Invalid JSON');
      }
    };
    input.click();
  }

  /**
   * Clear debug data
   */
  clearDebugData() {
    if (confirm('Clear all debug data?')) {
      this.debugManager.clear?.();
      this.expandedEntries.clear();
      this.updateAllDisplays();
      this.controller?.showToast?.('Debug data cleared');
    }
  }

  /**
   * Copy debug data
   */
  copyDebugData() {
    const entries = this.debugManager.getEntries(this.filters.type, 500);
    if (entries.length === 0) {
      this.controller?.showToast?.('No data to copy');
      return;
    }
    const text = entries.map(e => {
      const timestamp = new Date(e.timestamp).toISOString();
      const severity = e.severity || 'info';
      const category = e.category || 'general';
      const provider = e.metadata?.provider || '';
      const streamId = e.metadata?.streamId || '';
      const dataStr = e.data ? JSON.stringify(e.data, null, 2) : '';
      return `[${e.type.toUpperCase()}] ${timestamp}\nseverity: ${severity} | category: ${category}${provider ? `\nprovider: ${provider}` : ''}${streamId ? `\nstreamId: ${streamId}` : ''}\n${dataStr}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.controller?.showToast?.(`Copied ${entries.length} entries`);
    });
  }

  startRealtimeUpdates() {
    this.stopRealtimeUpdates();
    this.realtimeInterval = setInterval(() => {
      if (this.realtimeMonitor.active !== false) {
        this.updateAllDisplays();
      }
    }, 1000);
  }

  stopRealtimeUpdates() {
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
      this.realtimeInterval = null;
    }
  }

  destroy() {
    this.stopRealtimeUpdates();
    this.expandedEntries.clear();
    this.parserState.bookmarks.clear();
    this.parserState.pinnedEntries.clear();
    this.realtimeMonitor.active = false;
    this.debugManager?.destroy?.();
  }

  /** Utilities */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatJSON(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  truncate(str, len) {
    if (!str) return '';
    str = typeof str === 'string' ? str : JSON.stringify(str);
    return str.length > len ? str.slice(0, len) + '...' : str;
  }
}

/**
 * Performance Charts Component
 */
class PerformanceCharts {
  renderCharts(performanceMonitor) {
    const metrics = performanceMonitor?.getStats?.() || {};
    const entries = Object.entries(metrics);

    if (entries.length === 0) {
      return '<div class="chart-empty">No performance data</div>';
    }

    return `
      <div class="performance-charts">
        <div class="chart-title">Performance Overview</div>
        <div class="chart-content">
          ${entries.map(([name, data]) => `
            <div class="chart-metric">
              <div class="metric-bar" style="width: ${Math.min((data.avg / (data.max || 1)) * 100, 100)}%"></div>
              <div class="metric-label">${name}: ${data.avg?.toFixed(1) || 0}ms</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

/**
 * Real-time Monitor Component
 */
class RealtimeMonitor {
  constructor() {
    this.active = true;
    this.activeStreams = new Set();
    this.connectionStatus = new Map();
  }

  updateStreamStatus(streamId, status) {
    if (status === 'active') {
      this.activeStreams.add(streamId);
    } else {
      this.activeStreams.delete(streamId);
    }
  }

  updateConnectionStatus(provider, status) {
    this.connectionStatus.set(provider, status);
  }

  getStatus() {
    return {
      activeStreams: this.activeStreams.size,
      connections: Object.fromEntries(this.connectionStatus)
    };
  }
}

export default DebugUIComponents;