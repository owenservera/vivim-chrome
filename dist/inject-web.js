var injectWeb = (function () {
  "use strict";

  // ═══════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════

  function y(o) {
    return o == null || typeof o == "function" ? { main: o } : o;
  }

  const q = "web-bridge",
    k = "__handshake__";

  // ═══════════════════════════════════════════════════════
  // Bridge (message bus — unchanged)
  // ═══════════════════════════════════════════════════════

  class A {
    constructor(t, e = {}) {
      this.messageHandlers = new Map();
      this.pendingRequests = new Map();
      this.isReady = !1;
      this.handshakeAttempts = 0;
      this.options = {
        requestTimeout: 3e4,
        handshakeTimeout: 500,
        handshakeRetryInterval: 1e3,
        maxHandshakeAttempts: 10,
      };
      this.handleMessage = (i) => {
        const s = i.data;
        !s ||
          typeof s != "object" ||
          s.type !== this.messageType ||
          (this.isAllowedId(s.communicationId) &&
            (s.action && this.handleRequestMessage(s),
            s.requestId && this.handleResponseMessage(s)));
      };
      this.communicationId = t;
      this.messageType = e.messageType || q;
      this.allowedIds = new Set(e.allowedIds || []);
      Object.assign(this.options, e);
      this.setupMessageListener();
      this.setupHandshakeHandler();
    }
    addAllowedId(t) { this.allowedIds.add(t); }
    removeAllowedId(t) { this.allowedIds.delete(t); }
    isAllowedId(t) { return this.allowedIds.size === 0 || this.allowedIds.has(t); }
    generateId() { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
    async ensureReady() {
      if (!this.isReady) {
        if (this.readyPromise) return this.readyPromise;
        this.readyPromise = this.performHandshakeWithRetry();
        try { await this.readyPromise; } finally { this.readyPromise = void 0; }
      }
    }
    async performHandshakeWithRetry() {
      return new Promise((t, e) => {
        const i = async () => {
          try {
            await this.sendSingleHandshakeRequest();
            this.isReady = !0;
            this.stopHandshakeRetry();
            t();
          } catch (s) {
            if (this.handshakeAttempts++, this.handshakeAttempts >= this.options.maxHandshakeAttempts) {
              this.stopHandshakeRetry();
              e(new Error(`建联失败: ${s}`));
              return;
            }
            this.handshakeRetryInterval = setTimeout(i, this.options.handshakeRetryInterval);
          }
        };
        i();
      });
    }
    async sendSingleHandshakeRequest() {
      return new Promise((t, e) => {
        const i = this.generateId(),
          s = setTimeout(() => { this.pendingRequests.delete(i); e(new Error("握手超时")); }, this.options.handshakeTimeout);
        this.pendingRequests.set(i, { resolve: t, reject: e, timeout: s });
        const n = { type: this.messageType, communicationId: this.communicationId, id: i, action: k, data: { timestamp: Date.now() }, needResponse: !0, timestamp: Date.now() };
        globalThis.postMessage(n, "*");
      });
    }
    stopHandshakeRetry() { this.handshakeRetryInterval && (clearTimeout(this.handshakeRetryInterval), this.handshakeRetryInterval = void 0); }
    send(t, e) { const i = { type: this.messageType, communicationId: this.communicationId, id: this.generateId(), action: t, data: e, needResponse: !1, timestamp: Date.now() }; globalThis.postMessage(i, "*"); }
    async invoke(t, e) { return await this.ensureReady(), this.invokeRequest(t, e); }
    async invokeRequest(t, e) {
      return new Promise((i, s) => {
        const n = this.generateId(),
          r = setTimeout(() => { this.pendingRequests.delete(n); s(new Error(`请求超时: ${t}`)); }, this.options.requestTimeout);
        this.pendingRequests.set(n, { resolve: i, reject: s, timeout: r });
        const a = { type: this.messageType, communicationId: this.communicationId, id: n, action: t, data: e, needResponse: !0, timestamp: Date.now() };
        globalThis.postMessage(a, "*");
      });
    }
    handle(t, e) { return this.messageHandlers.set(t, e), () => { this.messageHandlers.delete(t); }; }
    getReady() { return this.isReady; }
    destroy() { this.stopHandshakeRetry(); this.messageHandlers.clear(); this.clearPendingRequests(); globalThis.removeEventListener("message", this.handleMessage); }
    setupMessageListener() { this.handleMessage = this.handleMessage.bind(this); globalThis.addEventListener("message", this.handleMessage); }
    async handleRequestMessage(t) {
      const { action: e, data: i, needResponse: s, id: n } = t;
      try {
        const r = this.messageHandlers.get(e);
        if (!r) { s && this.sendResponse(n, !1, void 0, `未找到处理器: ${e}`); return; }
        let a = r(i);
        a && typeof a.then == "function" && (a = await a);
        s && this.sendResponse(n, !0, a);
      } catch (r) {
        if (console.error(`处理消息错误 [${e}]:`, r), s) { const a = r instanceof Error ? r.message : String(r); this.sendResponse(n, !1, void 0, a); }
      }
    }
    handleResponseMessage(t) {
      const { requestId: e, success: i, data: s, error: n } = t,
        r = this.pendingRequests.get(e);
      r && (clearTimeout(r.timeout), this.pendingRequests.delete(e), i ? r.resolve(s) : r.reject(new Error(n || "未知错误")));
    }
    sendResponse(t, e, i, s) { const n = { type: this.messageType, communicationId: this.communicationId, id: this.generateId(), requestId: t, success: e, data: i, error: s, timestamp: Date.now() }; globalThis.postMessage(n, "*"); }
    setupHandshakeHandler() { this.handle(k, (t) => ({ success: !0, timestamp: Date.now() })); }
    clearPendingRequests() { this.pendingRequests.forEach(({ reject: t, timeout: e }) => { clearTimeout(e); t(new Error("连接已断开")); }); this.pendingRequests.clear(); }
  }

  function L(o, t = {}) { return new A(o, t); }

  // ═══════════════════════════════════════════════════════
  // Data stores (unchanged)
  // ═══════════════════════════════════════════════════════

  class f {
    static reqId = null;
    static updatedAt = null;
    static extHeaders = {};
    static setReqId(t) { t && (this.reqId = t, this.updatedAt = Date.now()); }
    static getLatest() { return { reqId: this.reqId, updatedAt: this.updatedAt }; }
    static setExtHeaders(t) { this.extHeaders = { ...this.extHeaders, ...t }; }
    static getExtHeaders() { return this.extHeaders; }
  }

  class H {
    static authorization = null;
    static userIdentityType = null;
    static updatedAt = null;
    static setAuthData(t, e) { t && (this.authorization = t, e !== void 0 && (this.userIdentityType = e), this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, userIdentityType: this.userIdentityType, updatedAt: this.updatedAt }; }
  }
  window.CopilotAuthStore = H;

  class g {
    static authorization = null;
    static updatedAt = null;
    static extraHeaders = {};
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static setExtraHeaders(t) { this.extraHeaders = t, this.updatedAt = Date.now(); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt, extraHeaders: Object.keys(this.extraHeaders).length > 0 ? this.extraHeaders : void 0 }; }
  }
  window.ChatGPTAuthStore = g;

  const X = ["chatgpt-", "oai-"];

  class w {
    static url = null;
    static updatedAt = null;
    static setUrl(t) { t && (this.url = t, this.updatedAt = Date.now()); }
    static getLatest() { return { url: this.url, updatedAt: this.updatedAt }; }
  }

  class l {
    static reqId = null;
    static atToken = null;
    static conversationUuid = null;
    static updatedAt = null;
    static setReqId(t) { t && (this.reqId = t, this.updatedAt = Date.now()); }
    static setAtToken(t) { t && (this.atToken = t, this.updatedAt = Date.now()); }
    static setConversationUuid(t) { t && (this.conversationUuid = t, this.updatedAt = Date.now()); }
    static getLatest() { return { reqId: this.reqId, atToken: this.atToken, conversationUuid: this.conversationUuid, updatedAt: this.updatedAt }; }
  }

  class c {
    static authorization = null;
    static extraHeaders = {};
    static listMessagesUrl = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static setExtraHeaders(t) { this.extraHeaders = { ...this.extraHeaders, ...t }, this.updatedAt = Date.now(); }
    static setListMessagesUrl(t) { t && (this.listMessagesUrl = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, extraHeaders: this.extraHeaders, listMessagesUrl: this.listMessagesUrl, updatedAt: this.updatedAt }; }
  }
  window.KimiAuthStore = c;

  // ═══════════════════════════════════════════════════════
  // XMLHttpRequest interceptors (unchanged — they don't stack)
  // ═══════════════════════════════════════════════════════

  class I {
    originalXHROpen = null;
    originalXHRSend = null;
    isHooked = !1;
    targetUrl = "/_/BardChatUi/data/batchexecute";
    start() { this.isHooked || (this.hookXHR(), this.isHooked = !0); }
    stop() { this.isHooked && (this.unhookXHR(), this.isHooked = !1); }
    isGeminiAPIRequest(t) { return t.includes(this.targetUrl); }
    hasTargetRpcids(t) { try { return new URL(t, window.location.origin).searchParams.get("rpcids") === "hNvQHb"; } catch { return !1; } }
    hookXHR() {
      this.originalXHROpen = XMLHttpRequest.prototype.open;
      this.originalXHRSend = XMLHttpRequest.prototype.send;
      const t = this;
      XMLHttpRequest.prototype.open = function (e, i, s, n, r) {
        this._interceptor_url = i;
        this._interceptor_headers = {};
        const a = this.setRequestHeader.bind(this);
        return this.setRequestHeader = function (h, u) { h.toLowerCase().startsWith("x-goog-ext-") && (this._interceptor_headers[h] = u); a(h, u); }, t.originalXHROpen.call(this, e, i, s !== !1, n || null, r || null);
      };
      XMLHttpRequest.prototype.send = function (e) {
        const i = this._interceptor_url, s = this._interceptor_headers;
        if (i && t.isGeminiAPIRequest(i)) { try { const r = new URL(i, window.location.origin).searchParams.get("_reqid"); r && f.setReqId(r); } catch {} i && t.hasTargetRpcids(i) && s && Object.keys(s).length > 0 && f.setExtHeaders(s); }
        return t.originalXHRSend.call(this, e);
      };
    }
    unhookXHR() { this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen); this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend); }
  }

  class x {
    originalXHROpen = null;
    originalXHRSend = null;
    isHooked = !1;
    targetUrl = "/_/LabsTailwindUi/data/batchexecute";
    start() { this.isHooked || (this.hookXHR(), this.isHooked = !0); }
    stop() { this.isHooked && (this.unhookXHR(), this.isHooked = !1); }
    isNotebookLMAPIRequest(t) { return t.includes(this.targetUrl); }
    hasTargetRpcids(t) { try { const i = new URL(t, window.location.origin).searchParams.get("rpcids"); return i === "VfAZjd" || i === "khqZz"; } catch { return !1; } }
    hookXHR() {
      this.originalXHROpen = XMLHttpRequest.prototype.open;
      this.originalXHRSend = XMLHttpRequest.prototype.send;
      const t = this;
      XMLHttpRequest.prototype.open = function (e, i, s, n, r) { return this._interceptor_url = i, t.originalXHROpen.call(this, e, i, s !== !1, n || null, r || null); };
      XMLHttpRequest.prototype.send = function (e) {
        const i = this._interceptor_url;
        if (i && t.isNotebookLMAPIRequest(i) && t.hasTargetRpcids(i)) {
          try { const n = new URL(i, window.location.origin).searchParams.get("_reqid"); n && l.setReqId(n); } catch {}
          if (typeof e == "string") { if (e.includes("at=")) try { const n = new URLSearchParams(e).get("at"); n && l.setAtToken(n); } catch {} } else if (e instanceof URLSearchParams) { const s = e.get("at"); s && l.setAtToken(s); } else if (e instanceof FormData) { const s = e.get("at"); s && typeof s == "string" && l.setAtToken(s); }
          try { if (new URL(i, window.location.origin).searchParams.get("rpcids") === "khqZz") { let r = null; if (typeof e == "string" && e.includes("f.req=")) r = new URLSearchParams(e).get("f.req"); else if (e instanceof URLSearchParams) r = e.get("f.req"); else if (e instanceof FormData) { const a = e.get("f.req"); r = typeof a == "string" ? a : null; } if (r) { const h = JSON.parse(r)?.[0]?.[0]?.[1]; if (h) { const p = JSON.parse(h)?.[3]; p && typeof p == "string" && l.setConversationUuid(p); } } } } catch {}
        }
        return t.originalXHRSend.call(this, e);
      };
    }
    unhookXHR() { this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen); this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend); }
  }

  class S {
    originalXHROpen = null;
    originalXHRSend = null;
    isHooked = !1;
    targetSuffix = "MakerSuiteService/ResolveDriveResource";
    start() { this.isHooked || (this.hookXHR(), this.isHooked = !0); }
    stop() { this.isHooked && (this.unhookXHR(), this.isHooked = !1); }
    isTargetRequest(t) { const e = typeof t == "string" ? t : t.toString(); return e.endsWith(this.targetSuffix) || e.includes(this.targetSuffix + "?") || e.includes(this.targetSuffix + "$"); }
    hookXHR() {
      this.originalXHROpen = XMLHttpRequest.prototype.open;
      this.originalXHRSend = XMLHttpRequest.prototype.send;
      const t = this;
      XMLHttpRequest.prototype.open = function (e, i, s, n, r) { return this._interceptor_url = i, t.originalXHROpen.call(this, e, i, s !== !1, n || null, r || null); };
      XMLHttpRequest.prototype.send = function (e) { const i = this._interceptor_url; return i && t.isTargetRequest(i) && w.setUrl(i), t.originalXHRSend.call(this, e); };
    }
    unhookXHR() { this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen); this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend); }
  }

  // ═══════════════════════════════════════════════════════
  // Header utilities (shared by plugins)
  // ═══════════════════════════════════════════════════════

  function extractHeaders(input, init) {
    if (init?.headers) return normalizeHeaders(init.headers);
    if (input instanceof Request) return normalizeHeaders(input.headers);
    return {};
  }

  function normalizeHeaders(h) {
    const out = {};
    if (!h) return out;
    if (h instanceof Headers) { h.forEach((v, k) => { out[k] = v; }); return out; }
    if (Array.isArray(h)) { for (const [k, v] of h) out[k] = v; return out; }
    if (h && typeof h === "object") { Object.assign(out, h); return out; }
    return out;
  }

  function resolveUrl(input) {
    try {
      return typeof input === "string" ? input
        : input instanceof URL ? input.href
        : input?.url || "";
    } catch { return ""; }
  }

  // ═══════════════════════════════════════════════════════
  // Plugin interface (base class)
  // ═══════════════════════════════════════════════════════

  class Plugin {
    get name() { return "BasePlugin"; }
    matchRequest(ctx) { return false; }
    onRequest(ctx) {}
    matchResponse(ctx) { return false; }
    onResponse(ctx) {}
  }

  // ═══════════════════════════════════════════════════════
  // ChatGPT Plugin
  // ═══════════════════════════════════════════════════════

  class ChatGPTPlugin extends Plugin {
    get name() { return "ChatGPT"; }
    strictBypass = ["/backend-api/connectors/check", "/backend-api/rollback"];

    matchRequest(ctx) {
      return ctx.url?.includes("/backend-api/");
    }

    onRequest(ctx) {
      if (this.strictBypass.some(p => ctx.url.includes(p))) return;

      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) g.setAuthData(auth);

      const extras = {};
      for (const [k, v] of Object.entries(ctx.headers)) {
        const lower = k.toLowerCase();
        if (X.some(p => lower.startsWith(p))) extras[k] = v;
      }
      Object.keys(extras).length > 0 && g.setExtraHeaders(extras);
    }

    matchResponse(ctx) {
      // Only intercept the streaming conversation endpoint (POST request)
      if (this.strictBypass.some(p => ctx.url.includes(p))) return false;
      
      // Match both old and new ChatGPT streaming endpoints:
      // - /backend-api/conversation (old)
      // - /backend-api/f/conversation (new - "f" prefix)
      const isStreamingEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);
      
      if (isStreamingEndpoint) {
        console.log("[VIVIM inject] 🎯 matchResponse STREAMING:", ctx.url);
      }
      
      return !!isStreamingEndpoint;
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) {
        console.log("[VIVIM inject] ⚠️ No clone or body available, skipping");
        return;
      }

      try {
        if (!ctx.response.ok) {
          console.log("[VIVIM inject] ⚠️ Response not OK:", ctx.response.status);
          return;
        }

        console.log("[VIVIM inject] 🎯 Intercepted conversation response (delta encoding):", ctx.url);

        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let eventCount = 0;
        let appendCount = 0;

        // Delta encoding state
        let reconstructedText = "";
        let currentModel = "unknown";
        let currentRole = null;
        let streamEnded = false;

        // SSE event parsing state
        let currentEvent = "message"; // default
        let eventData = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // keep incomplete line

          for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === "") {
              // Blank line = end of SSE event, process accumulated data
              if (eventData) {
                eventCount++;

                if (currentEvent === "delta_encoding") {
                  // Just the version: data: "v1"
                  console.log("[VIVIM inject] 🔧 Delta encoding version:", eventData);
                } else if (currentEvent === "delta") {
                  try {
                    const payload = JSON.parse(eventData);
                    const op = payload.o;
                    const path = payload.p;
                    const value = payload.v;

                    // Log first few events for debugging
                    if (eventCount <= 5) {
                      console.log(`[VIVIM inject] 📦 Delta #${eventCount}:`, { op, path, valueType: typeof value });
                    }

                    // Track model from metadata
                    if (path === "/message/metadata" && op === "add" && value?.model_slug) {
                      currentModel = value.model_slug;
                    }
                    if (path === "/message/author/role") {
                      currentRole = value;
                    }

                    // Handle batched patch operations
                    if (op === "patch" && Array.isArray(value)) {
                      for (const subOp of value) {
                        const subPath = subOp.p;
                        const subOpType = subOp.o;
                        const subValue = subOp.v;

                        // Track role
                        if (subPath === "/message/author/role") {
                          currentRole = subValue;
                        }

                        // Track model
                        if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
                          currentModel = subValue.model_slug;
                        }

                        // Append text content
                        if (subPath === "/message/content/parts/0" && subOpType === "append") {
                          reconstructedText += subValue;
                          appendCount++;

                          // Send chunk to bridge
                          if (appendCount % 3 === 0 && window.__VIVIM_BRIDGE && reconstructedText) {
                            window.__VIVIM_BRIDGE.send("chatChunk", {
                              role: currentRole || "assistant",
                              content: reconstructedText,
                              model: currentModel,
                              url: ctx.url
                            });
                          }
                        }
                      }
                    } else if (op === "append" && path === "/message/content/parts/0") {
                      // Single append operation
                      reconstructedText += value;
                      appendCount++;

                      // Send chunk every few appends
                      if (appendCount % 3 === 0 && window.__VIVIM_BRIDGE && reconstructedText) {
                        window.__VIVIM_BRIDGE.send("chatChunk", {
                          role: currentRole || "assistant",
                          content: reconstructedText,
                          model: currentModel,
                          url: ctx.url
                        });
                      }
                    }

                    // Check for stream end
                    if (path === "/message/status" && (op === "replace" || value === "finished_successfully")) {
                      streamEnded = true;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }

              // Reset for next event
              currentEvent = "message";
              eventData = "";
            } else if (trimmed.startsWith("event: ")) {
              currentEvent = trimmed.slice(7).trim();
            } else if (trimmed.startsWith("data: ")) {
              // Fix #6: SSE spec — multiple data: lines must be joined with \n
              eventData = eventData ? eventData + "\n" + trimmed.slice(6) : trimmed.slice(6);
            }
          }
        }

        // Fix #7: Process remaining buffer after stream ends
        if (buffer.trim()) {
          const remainingLines = buffer.split('\n');
          for (const line of remainingLines) {
            const trimmed = line.trim();
            if (trimmed === "") {
              if (eventData && currentEvent === "delta") {
                eventCount++;
                try {
                  processDeltaPayload(JSON.parse(eventData));
                } catch (e) {}
              }
              currentEvent = "message";
              eventData = "";
            } else if (trimmed.startsWith("event: ")) {
              currentEvent = trimmed.slice(7).trim();
            } else if (trimmed.startsWith("data: ")) {
              eventData = eventData ? eventData + "\n" + trimmed.slice(6) : trimmed.slice(6);
            }
          }
        }

        function processDeltaPayload(payload) {
          const op = payload.o;
          const path = payload.p;
          const value = payload.v;

          // Track model from metadata
          if (path === "/message/metadata" && op === "add" && value?.model_slug) {
            currentModel = value.model_slug;
          }
          if (path === "/message/author/role") {
            currentRole = value;
          }

          // Handle batched patch operations
          if (op === "patch" && Array.isArray(value)) {
            for (const subOp of value) {
              const subPath = subOp.p;
              const subOpType = subOp.o;
              const subValue = subOp.v;

              if (subPath === "/message/author/role") {
                currentRole = subValue;
              }
              if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
                currentModel = subValue.model_slug;
              }
              if (subPath === "/message/content/parts/0" && subOpType === "append") {
                reconstructedText += subValue;
                appendCount++;
              }
              // Fix #10: break early on stream end
              if (subPath === "/message/status" && subOpType === "replace" && subValue === "finished_successfully") {
                streamEnded = true;
              }
            }
          } else if (op === "append" && path === "/message/content/parts/0") {
            reconstructedText += value;
            appendCount++;
          }
          if (path === "/message/status" && op === "replace" && value === "finished_successfully") {
            streamEnded = true;
          }
        }

        // Send final reconstructed message
        if (reconstructedText && window.__VIVIM_BRIDGE) {
          console.log(`[VIVIM inject] 📤 Sending final message: ${reconstructedText.length} chars, ${appendCount} appends`);
          window.__VIVIM_BRIDGE.send("chatChunk", {
            role: currentRole || "assistant",
            content: reconstructedText,
            model: currentModel,
            url: ctx.url
          });
        }

        // Signal stream complete
        console.log(`[VIVIM inject] ✅ Stream finished — ${eventCount} events, ${appendCount} text appends, ${reconstructedText.length} chars`);
        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {
        console.warn("[VIVIM inject] Stream read error:", e);
        // Still try to send complete so sidepanel exits streaming state
        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // Copilot Plugin
  // ═══════════════════════════════════════════════════════

  class CopilotPlugin extends Plugin {
    get name() { return "Copilot"; }

    matchRequest(ctx) {
      return ctx.url?.includes("copilot.microsoft.com");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      const identity = ctx.headers["X-Useridentitytype"] || ctx.headers["x-useridentitytype"];
      if (auth) H.setAuthData(auth, identity);
    }
  }

  // ═══════════════════════════════════════════════════════
  // Kimi Plugin
  // ═══════════════════════════════════════════════════════

  class KimiPlugin extends Plugin {
    get name() { return "Kimi"; }
    extraHeaderKeys = ["x-language", "x-msh-device-id", "x-msh-platform", "x-msh-session-id", "x-msh-version", "x-traffic-id", "r-timezone"];

    matchRequest(ctx) {
      return ctx.url?.includes("/apiv2/kimi.gateway.chat")
        && ctx.url?.endsWith("/ListMessages");
    }

    onRequest(ctx) {
      c.setListMessagesUrl(ctx.url);

      const auth = ctx.headers["authorization"] || ctx.headers["Authorization"];
      if (auth) c.setAuthData(auth);

      const extras = {};
      for (const [k, v] of Object.entries(ctx.headers)) {
        if (this.extraHeaderKeys.includes(k.toLowerCase())) extras[k] = v;
      }
      Object.keys(extras).length > 0 && c.setExtraHeaders(extras);
    }
  }

  // ═══════════════════════════════════════════════════════
  // SINGLE global fetch interceptor — dual-phase
  // ═══════════════════════════════════════════════════════

  class FetchInterceptor {
    constructor() {
      this.plugins = [];
      this.isHooked = !1;
      this.originalFetch = null;
    }

    register(plugin) { this.plugins.push(plugin); }

    runRequestPlugins(ctx) {
      for (const plugin of this.plugins) {
        if (plugin.matchRequest?.(ctx)) {
          try { plugin.onRequest?.(ctx); } catch (e) { /* silent per plugin */ }
        }
      }
    }

    runResponsePlugins(ctx) {
      // Run all response plugins in parallel — fire-and-forget
      const promises = [];
      for (const plugin of this.plugins) {
        if (plugin.matchResponse?.(ctx)) {
          promises.push(
            Promise.resolve().then(() => plugin.onResponse?.(ctx))
              .catch(() => {})
          );
        }
      }
      return Promise.all(promises);
    }

    start() {
      if (this.isHooked) return;
      this.isHooked = !0;
      this.originalFetch = window.fetch;
      const self = this;

      window.fetch = async function (input, init) {
        const url = resolveUrl(input);

        // ── REQUEST PHASE (sync) ──

        const requestCtx = {
          phase: "request",
          url,
          input,
          init,
          headers: extractHeaders(input, init),
          timestamp: Date.now()
        };

        self.runRequestPlugins(requestCtx);

        // ── ORIGINAL FETCH ──

        let response;
        try {
          response = await self.originalFetch.call(this, input, init);
        } catch (err) {
          throw err; // never swallow network errors
        }

        // ── RESPONSE PHASE (async, on clone) ──

        const clone = safeCloneResponse(response);

        const responseCtx = {
          phase: "response",
          url,
          request: requestCtx,
          response,
          clone,
          timestamp: Date.now()
        };

        // Fire-and-forget — does NOT block returning response
        self.runResponsePlugins(responseCtx).catch(() => {});

        return response; // original, untouched
      };
    }

    stop() {
      this.originalFetch && (window.fetch = this.originalFetch, this.isHooked = !1, this.originalFetch = null);
    }
  }

  function safeCloneResponse(response) {
    try { return response.clone(); } catch { return null; }
  }

  // ═══════════════════════════════════════════════════════
  // Main bootstrap
  // ═══════════════════════════════════════════════════════

  const b = y(() => {
    const o = L("inject-chat-web", { allowedIds: ["saveai-extension-content"] });
    window.__VIVIM_BRIDGE = o;
    o.handle("getGeminiGlobalData", () => window.WIZ_global_data);
    o.handle("getGoogleAiKeys", () => window.AF_initDataKeys);
    o.handle("getCopilotAuthHeader", () => H.getLatest());
    o.handle("getChatGPTAuthHeader", () => g.getLatest());
    o.handle("getGeminiLatestReqId", () => f.getLatest());
    o.handle("getGeminiExtHeaders", () => f.getExtHeaders());
    o.handle("getGoogleAiResolveUrl", () => w.getLatest());
    o.handle("getNotebookLMLatestReqId", () => l.getLatest());
    o.handle("getKimiAuthHeader", () => c.getLatest());

    // ── Single fetch interceptor with plugin pipeline ──

    const fetchInterceptor = new FetchInterceptor();
    fetchInterceptor.register(new ChatGPTPlugin());
    fetchInterceptor.register(new CopilotPlugin());
    fetchInterceptor.register(new KimiPlugin());
    fetchInterceptor.start();

    // XHR interceptors (these don't stack — prototype-patch once)
    const t = () => { const d = new I; d.start(); window.addEventListener("beforeunload", () => { d.stop(); }); };
    const s = () => { const d = new S; d.start(); window.addEventListener("beforeunload", () => { d.stop(); }); };
    const n = () => { const d = new x; d.start(); window.addEventListener("beforeunload", () => { d.stop(); }); };

    const a = document.URL.includes("https://gemini.google.com");
    const u = document.URL.includes("https://chatgpt.com");
    const P = document.URL.includes("https://notebooklm.google.com");

    a && t();
    u && s();
    P && n();
  });

  function D() {}
  function R(o, ...t) {}
  const v = {
    debug: (...o) => R(console.debug, ...o),
    log: (...o) => R(console.log, ...o),
    warn: (...o) => R(console.warn, ...o),
    error: (...o) => R(console.error, ...o),
  };

  return (async () => {
    try { return await b.main(); } catch (o) { throw v.error('The unlisted script "inject-web" crashed on startup!', o), o; }
  })();
})();
injectWeb;
