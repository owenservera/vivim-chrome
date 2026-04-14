(function () {
  'use strict';

  const TEMPLATE = `
    <div class="vivim-privacy-dashboard" id="vivim-privacy-dashboard">
      <div class="vpd-header">
        <h2>Privacy & Telemetry</h2>
        <button class="vpd-close" data-action="close">&times;</button>
      </div>

      <div class="vpd-tabs">
        <button class="vpd-tab active" data-tab="overview">Overview</button>
        <button class="vpd-tab" data-tab="consent">Consent</button>
        <button class="vpd-tab" data-tab="data">Your Data</button>
        <button class="vpd-tab" data-tab="settings">Settings</button>
      </div>

      <div class="vpd-content">
        <div class="vpd-panel active" id="vpd-panel-overview">
          <div class="vpd-stats-grid">
            <div class="vpd-stat-card">
              <div class="vpd-stat-value" id="vpd-stat-events">0</div>
              <div class="vpd-stat-label">Events Tracked</div>
            </div>
            <div class="vpd-stat-card">
              <div class="vpd-stat-value" id="vpd-stat-sessions">0</div>
              <div class="vpd-stat-label">Sessions</div>
            </div>
            <div class="vpd-stat-card">
              <div class="vpd-stat-value" id="vpd-stat-features">0</div>
              <div class="vpd-stat-label">Features Used</div>
            </div>
            <div class="vpd-stat-card">
              <div class="vpd-stat-value" id="vpd-stat-days">0</div>
              <div class="vpd-stat-label">Days of Data</div>
            </div>
          </div>

          <div class="vpd-section">
            <h3>What We Collect</h3>
            <ul class="vpd-data-list">
              <li>
                <span class="vpd-icon">📊</span>
                <div>
                  <strong>Feature Usage</strong>
                  <p>Which features you use to improve our product</p>
                </div>
              </li>
              <li>
                <span class="vpd-icon">⚡</span>
                <div>
                  <strong>Performance</strong>
                  <p>Load times and responsiveness data</p>
                </div>
              </li>
              <li>
                <span class="vpd-icon">🐛</span>
                <div>
                  <strong>Errors</strong>
                  <p>Crash reports to fix bugs</p>
                </div>
              </li>
            </ul>
          </div>

          <div class="vpd-section">
            <h3>We Don't Collect</h3>
            <ul class="vpd-data-list vpd-negative">
              <li>
                <span class="vpd-icon">❌</span>
                <div>
                  <strong>Personal Identifiers</strong>
                  <p>Your name, email, or account info</p>
                </div>
              </li>
              <li>
                <span class="vpd-icon">❌</span>
                <div>
                  <strong>Conversation Content</strong>
                  <p>What you type or receive from AI</p>
                </div>
              </li>
              <li>
                <span class="vpd-icon">❌</span>
                <div>
                  <strong>Browsing History</strong>
                  <p>Websites outside this extension</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="vpd-panel" id="vpd-panel-consent">
          <div class="vpd-consent-list">
            <div class="vpd-consent-item">
              <div class="vpd-consent-info">
                <h4>Analytics</h4>
                <p>Anonymous usage data to improve the product</p>
              </div>
              <label class="vpd-toggle">
                <input type="checkbox" id="vpd-consent-analytics" />
                <span class="vpd-toggle-slider"></span>
              </label>
            </div>

            <div class="vpd-consent-item">
              <div class="vpd-consent-info">
                <h4>Personalization</h4>
                <p>Tailored experience based on your usage</p>
              </div>
              <label class="vpd-toggle">
                <input type="checkbox" id="vpd-consent-personalization" />
                <span class="vpd-toggle-slider"></span>
              </label>
            </div>

            <div class="vpd-consent-item">
              <div class="vpd-consent-info">
                <h4>Error Reporting</h4>
                <p>Automatic crash and error reports</p>
              </div>
              <label class="vpd-toggle">
                <input type="checkbox" id="vpd-consent-error" />
                <span class="vpd-toggle-slider"></span>
              </label>
            </div>

            <div class="vpd-consent-item">
              <div class="vpd-consent-info">
                <h4>Performance Metrics</h4>
                <p>Load times and performance data</p>
              </div>
              <label class="vpd-toggle">
                <input type="checkbox" id="vpd-consent-performance" />
                <span class="vpd-toggle-slider"></span>
              </label>
            </div>
          </div>

          <button class="vpd-btn vpd-btn-primary" id="vpd-save-consent">Save Preferences</button>
        </div>

        <div class="vpd-panel" id="vpd-panel-data">
          <div class="vpd-section">
            <h3>Your Telemetry Data</h3>
            <p class="vpd-description">
              Download all telemetry data we've collected. This does NOT include your messages, conversations, or personal information.
            </p>

            <div class="vpd-export-options">
              <button class="vpd-btn" data-export="json">
                <span class="vpd-icon">📄</span> Export JSON
              </button>
              <button class="vpd-btn" data-export="csv">
                <span class="vpd-icon">📊</span> Export CSV
              </button>
            </div>
          </div>

          <div class="vpd-section">
            <h3>Delete Your Data</h3>
            <p class="vpd-description vpd-warning">
              This will permanently delete all telemetry data associated with this browser. This action cannot be undone.
            </p>

            <button class="vpd-btn vpd-btn-danger" id="vpd-delete-data">
              <span class="vpd-icon">🗑️</span> Delete All Data
            </button>
          </div>
        </div>

        <div class="vpd-panel" id="vpd-panel-settings">
          <div class="vpd-setting-group">
            <label>
              <span>Data Retention (days)</span>
              <input type="number" id="vpd-setting-retention" min="1" max="365" value="30" />
            </label>
          </div>

          <div class="vpd-setting-group">
            <label>
              <span>Sampling Rate</span>
              <select id="vpd-setting-sample">
                <option value="1.0">100% (all events)</option>
                <option value="0.5">50%</option>
                <option value="0.1">10%</option>
                <option value="0.01">1%</option>
              </select>
            </label>
          </div>

          <div class="vpd-setting-group">
            <label class="vpd-checkbox">
              <input type="checkbox" id="vpd-setting-debug" />
              <span>Enable debug logging</span>
            </label>
          </div>

          <button class="vpd-btn vpd-btn-primary" id="vpd-save-settings">Save Settings</button>
        </div>
      </div>

      <div class="vpd-footer">
        <span>v<span id="vpd-version">1.0.0</span></span>
        <a href="#" data-action="privacy">Privacy Policy</a>
      </div>
    </div>
  `;

  const STYLES = `
    .vivim-privacy-dashboard {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e5e5e5;
      border-radius: 12px;
      overflow: hidden;
      max-width: 480px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .vpd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #333;
    }

    .vpd-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .vpd-close {
      background: none;
      border: none;
      color: #888;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .vpd-close:hover {
      color: #fff;
    }

    .vpd-tabs {
      display: flex;
      border-bottom: 1px solid #333;
      padding: 0 12px;
    }

    .vpd-tab {
      background: none;
      border: none;
      color: #888;
      padding: 12px 16px;
      font-size: 13px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .vpd-tab:hover {
      color: #e5e5e5;
    }

    .vpd-tab.active {
      color: #10b981;
      border-bottom-color: #10b981;
    }

    .vpd-content {
      padding: 20px;
      min-height: 380px;
    }

    .vpd-panel {
      display: none;
    }

    .vpd-panel.active {
      display: block;
    }

    .vpd-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .vpd-stat-card {
      background: #252525;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }

    .vpd-stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #10b981;
    }

    .vpd-stat-label {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    .vpd-section {
      margin-bottom: 24px;
    }

    .vpd-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .vpd-data-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .vpd-data-list li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #333;
    }

    .vpd-data-list li:last-child {
      border-bottom: none;
    }

    .vpd-icon {
      font-size: 20px;
      width: 32px;
      text-align: center;
    }

    .vpd-data-list strong {
      display: block;
      margin-bottom: 4px;
    }

    .vpd-data-list p {
      margin: 0;
      font-size: 13px;
      color: #888;
    }

    .vpd-negative .vpd-icon {
      opacity: 0.5;
    }

    .vpd-consent-list {
      margin-bottom: 20px;
    }

    .vpd-consent-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #333;
    }

    .vpd-consent-item:last-child {
      border-bottom: none;
    }

    .vpd-consent-info h4 {
      margin: 0 0 4px;
      font-size: 14px;
    }

    .vpd-consent-info p {
      margin: 0;
      font-size: 12px;
      color: #888;
    }

    .vpd-toggle {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 26px;
    }

    .vpd-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .vpd-toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: #444;
      border-radius: 26px;
      transition: 0.3s;
    }

    .vpd-toggle-slider::before {
      position: absolute;
      content: '';
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.3s;
    }

    .vpd-toggle input:checked + .vpd-toggle-slider {
      background: #10b981;
    }

    .vpd-toggle input:checked + .vpd-toggle-slider::before {
      transform: translateX(22px);
    }

    .vpd-description {
      font-size: 13px;
      color: #888;
      margin: 0 0 16px;
    }

    .vpd-warning {
      color: #f59e0b;
    }

    .vpd-export-options {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .vpd-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: 1px solid #444;
      border-radius: 6px;
      background: #252525;
      color: #e5e5e5;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .vpd-btn:hover {
      background: #333;
      border-color: #555;
    }

    .vpd-btn-primary {
      background: #10b981;
      border-color: #10b981;
      color: #fff;
    }

    .vpd-btn-primary:hover {
      background: #059669;
      border-color: #059669;
    }

    .vpd-btn-danger {
      background: #dc2626;
      border-color: #dc2626;
      color: #fff;
    }

    .vpd-btn-danger:hover {
      background: #b91c1c;
      border-color: #b91c1c;
    }

    .vpd-setting-group {
      margin-bottom: 16px;
    }

    .vpd-setting-group label {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .vpd-setting-group input[type="number"],
    .vpd-setting-group select {
      background: #252525;
      border: 1px solid #444;
      border-radius: 6px;
      color: #e5e5e5;
      padding: 8px 12px;
      font-size: 13px;
      width: 120px;
    }

    .vpd-checkbox {
      justify-content: flex-start !important;
      gap: 8px;
      cursor: pointer;
    }

    .vpd-checkbox input {
      width: 18px;
      height: 18px;
    }

    .vpd-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid #333;
      font-size: 12px;
      color: #666;
    }

    .vpd-footer a {
      color: #888;
      text-decoration: none;
    }

    .vpd-footer a:hover {
      color: #10b981;
    }
  `;

  class PrivacyDashboard {
    constructor(container, telemetry) {
      this.telemetry = telemetry;
      this.container = container;
      this.injectStyles();
      this.render();
      this.bindEvents();
      this.loadData();
    }

    injectStyles() {
      if (document.getElementById('vpd-styles')) return;
      const style = document.createElement('style');
      style.id = 'vpd-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    render() {
      this.container.innerHTML = TEMPLATE;
      document.getElementById('vpd-version').textContent = this.telemetry.version;
    }

    bindEvents() {
      const root = document.getElementById('vivim-privacy-dashboard');

      root.querySelectorAll('.vpd-tab').forEach(tab => {
        tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
      });

      root.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
      root.querySelector('[data-action="privacy"]').addEventListener('click', (e) => {
        e.preventDefault();
        this.showPrivacyPolicy();
      });

      root.querySelector('#vpd-save-consent').addEventListener('click', () => this.saveConsent());
      root.querySelector('#vpd-save-settings').addEventListener('click', () => this.saveSettings());

      root.querySelectorAll('[data-export]').forEach(btn => {
        btn.addEventListener('click', () => this.exportData(btn.dataset.export));
      });

      root.querySelector('#vpd-delete-data').addEventListener('click', () => this.deleteData());
    }

    async loadData() {
      try {
        const stats = await this.telemetry.getStats();

        document.getElementById('vpd-stat-events').textContent = stats.total_events;
        document.getElementById('vpd-stat-sessions').textContent = stats.session_count;
        document.getElementById('vpd-stat-features').textContent = Object.keys(stats.by_feature).length;

        if (stats.date_range) {
          const oldest = new Date(stats.date_range.oldest);
          const newest = new Date(stats.date_range.newest);
          const days = Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)) || 1;
          document.getElementById('vpd-stat-days').textContent = days;
        }

        const consent = this.telemetry.getConsent();
        document.getElementById('vpd-consent-analytics').checked = consent.analytics;
        document.getElementById('vpd-consent-personalization').checked = consent.personalization;
        document.getElementById('vpd-consent-error').checked = consent.errorReporting;
        document.getElementById('vpd-consent-performance').checked = consent.performance;

        const settings = this.telemetry.getSettings();
        document.getElementById('vpd-setting-retention').value = settings.retentionDays;
        document.getElementById('vpd-setting-sample').value = settings.sampleRate;
        document.getElementById('vpd-setting-debug').checked = settings.enableDebug;
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    switchTab(tabName) {
      const root = document.getElementById('vivim-privacy-dashboard');
      root.querySelectorAll('.vpd-tab').forEach(t => { t.classList.remove('active'); });
      root.querySelectorAll('.vpd-panel').forEach(p => { p.classList.remove('active'); });

      root.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
      root.querySelector(`#vpd-panel-${tabName}`).classList.add('active');
    }

    async saveConsent() {
      const consent = {
        analytics: document.getElementById('vpd-consent-analytics').checked,
        personalization: document.getElementById('vpd-consent-personalization').checked,
        errorReporting: document.getElementById('vpd-consent-error').checked,
        performance: document.getElementById('vpd-consent-performance').checked
      };

      this.telemetry.setConsent(consent);
      this.showNotification('Preferences saved');
    }

    async saveSettings() {
      const settings = {
        retentionDays: parseInt(document.getElementById('vpd-setting-retention').value) || 30,
        sampleRate: parseFloat(document.getElementById('vpd-setting-sample').value) || 1,
        enableDebug: document.getElementById('vpd-setting-debug').checked
      };

      this.telemetry.setSettings(settings);
      this.showNotification('Settings saved');
    }

    async exportData(format) {
      const data = await this.telemetry.exportEvents(format);

      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `vivim-telemetry-${format}-${Date.now()}.${format}`;
      a.click();

      URL.revokeObjectURL(url);
      this.showNotification(`Exported as ${format.toUpperCase()}`);
    }

    async deleteData() {
      if (!confirm('Are you sure you want to delete all telemetry data? This cannot be undone.')) {
        return;
      }

      await this.telemetry.clearAllData();
      await this.loadData();
      this.showNotification('All data deleted');
    }

    showNotification(message) {
      const root = document.getElementById('vivim-privacy-dashboard');
      const existing = root.querySelector('.vpd-notification');

      if (existing) existing.remove();

      const notification = document.createElement('div');
      notification.className = 'vpd-notification';
      notification.textContent = message;
      notification.style.cssText = `
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        animation: fadeIn 0.2s;
      `;

      root.querySelector('.vpd-content').appendChild(notification);

      setTimeout(() => notification.remove(), 2000);
    }

    showPrivacyPolicy() {
      alert('Privacy Policy\n\nVIVIM collects anonymous usage data to improve the product.\n\nWe do NOT collect:\n- Personal information\n- Conversation content\n- Web browsing history\n\nData is stored locally and can be deleted at any time.');
    }

    close() {
      this.container.innerHTML = '';
    }
  }

  window.VIVIMPrivacyDashboard = PrivacyDashboard;
})();