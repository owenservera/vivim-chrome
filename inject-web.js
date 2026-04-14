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
            console.log("[VIVIM:INJECT] ✅ Handshake successful", { communicationId: this.communicationId, timestamp: Date.now() });
            t();
          } catch (s) {
            if (this.handshakeAttempts++, this.handshakeAttempts >= this.options.maxHandshakeAttempts) {
              this.stopHandshakeRetry();
              console.error("[VIVIM:INJECT] ❌ Handshake failed", { error: s, attempts: this.handshakeAttempts, timestamp: Date.now() });
              e(new Error(`建联失败: ${s}`));
              return;
            }
            console.log("[VIVIM:INJECT] 🔄 Retrying handshake", { attempt: this.handshakeAttempts, maxAttempts: this.options.maxHandshakeAttempts, timestamp: Date.now() });
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
        console.log("[VIVIM:INJECT] 📤 Handshake request sent", { communicationId: this.communicationId, requestId: i, timestamp: Date.now() });
        globalThis.postMessage(n, "*");
      });
    }
    stopHandshakeRetry() { this.handshakeRetryInterval && (clearTimeout(this.handshakeRetryInterval), this.handshakeRetryInterval = void 0); }
    send(t, e) { 
      if (!this.isReady) {
        console.log("[VIVIM:INJECT] ⏳ Auto-waiting for handshake before send...", { action: t, timestamp: Date.now() });
        this.ensureReady().then(() => {
          console.log("[VIVIM:INJECT] ✅ Handshake complete, sending queued message", { action: t, timestamp: Date.now() });
          const i = { type: this.messageType, communicationId: this.communicationId, id: this.generateId(), action: t, data: e, needResponse: !1, timestamp: Date.now() }; 
          console.log("[VIVIM:INJECT] 📤 send() executing", { action: t, communicationId: this.communicationId, timestamp: Date.now() });
          globalThis.postMessage(i, "*"); 
        });
        return;
      }
      const i = { type: this.messageType, communicationId: this.communicationId, id: this.generateId(), action: t, data: e, needResponse: !1, timestamp: Date.now() }; 
      console.log("[VIVIM:INJECT] 📤 send() executing (sync)", { action: t, communicationId: this.communicationId, timestamp: Date.now() });
      globalThis.postMessage(i, "*"); 
    }
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
  // Claude Auth Store (claude.ai)
  // ═══════════════════════════════════════════════════════

  class ClaudeAuthStore {
    static authorization = null;
    static sessionKey = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static setSessionKey(t) { t && (this.sessionKey = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, sessionKey: this.sessionKey, updatedAt: this.updatedAt }; }
  }
  window.ClaudeAuthStore = ClaudeAuthStore;

  // ═══════════════════════════════════════════════════════
  // DeepSeek Auth Store (deepseek.com)
  // ═══════════════════════════════════════════════════════

  class DeepSeekAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.DeepSeekAuthStore = DeepSeekAuthStore;

  // ═══════════════════════════════════════════════════════
  // Perplexity Auth Store (perplexity.ai)
  // ═══════════════════════════════════════════════════════

  class PerplexityAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.PerplexityAuthStore = PerplexityAuthStore;

  class GrokAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.GrokAuthStore = GrokAuthStore;

  class PoeAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.PoeAuthStore = PoeAuthStore;

  class TongyiAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.TongyiAuthStore = TongyiAuthStore;

  class YuanbaoAuthStore {
    static authorization = null;
    static updatedAt = null;
    static setAuthData(t) { t && (this.authorization = t, this.updatedAt = Date.now()); }
    static getLatest() { return { authorization: this.authorization, updatedAt: this.updatedAt }; }
  }
  window.YuanbaoAuthStore = YuanbaoAuthStore;

  // ═══════════════════════════════════════════════════════════
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
  // Plugin interface (base class) — supports fetch + XHR
  // ═══════════════════════════════════════════════════════

  class Plugin {
    get name() { return "BasePlugin"; }
    // Protocol: 'fetch' | 'xhr' | 'both'
    get protocol() { return 'fetch'; }
    matchRequest(ctx) { return false; }
    onRequest(ctx) {}
    matchResponse(ctx) { return false; }
    onResponse(ctx) {}
  }

  class GeminiPlugin extends Plugin {
    get name() { return "Gemini"; }
    get protocol() { return 'xhr'; }
    targetUrl = "/_/BardChatUi/data/batchexecute";

    matchRequest(ctx) {
      return ctx.url?.includes(this.targetUrl);
    }

    onRequest(ctx) {
      try {
        const reqId = new URL(ctx.url, window.location.origin).searchParams.get("_reqid");
        reqId && f.setReqId(reqId);
      } catch {}

      try {
        const hasRpcid = new URL(ctx.url, window.location.origin).searchParams.get("rpcids") === "hNvQHb";
        if (hasRpcid && ctx.headers) {
          const extHeaders = {};
          for (const [k, v] of Object.entries(ctx.headers)) {
            if (k.toLowerCase().startsWith("x-goog-ext-")) extHeaders[k] = v;
          }
          Object.keys(extHeaders).length > 0 && f.setExtHeaders(extHeaders);
        }
      } catch {}
    }
  }

  class NotebookLMPlugin extends Plugin {
    get name() { return "NotebookLM"; }
    get protocol() { return 'xhr'; }
    targetUrl = "/_/LabsTailwindUi/data/batchexecute";

    matchRequest(ctx) {
      try {
        const rpcid = new URL(ctx.url, window.location.origin).searchParams.get("rpcids");
        return ctx.url?.includes(this.targetUrl) && (rpcid === "VfAZjd" || rpcid === "khqZz");
      } catch { return false; }
    }

    onRequest(ctx) {
      try {
        const reqId = new URL(ctx.url, window.location.origin).searchParams.get("_reqid");
        reqId && l.setReqId(reqId);
      } catch {}

      const body = ctx.body;
      if (!body) return;

      let atToken = null;
      if (typeof body === "string" && body.includes("at=")) {
        atToken = new URLSearchParams(body).get("at");
      } else if (body instanceof URLSearchParams) {
        atToken = body.get("at");
      } else if (body instanceof FormData) {
        const at = body.get("at");
        atToken = typeof at === "string" ? at : null;
      }
      atToken && l.setAtToken(atToken);

      try {
        const rpcid = new URL(ctx.url, window.location.origin).searchParams.get("rpcids");
        if (rpcid === "khqZz") {
          let fReq = null;
          if (typeof body === "string" && body.includes("f.req=")) {
            fReq = new URLSearchParams(body).get("f.req");
          } else if (body instanceof URLSearchParams) {
            fReq = body.get("f.req");
          } else if (body instanceof FormData) {
            const f = body.get("f.req");
            fReq = typeof f === "string" ? f : null;
          }
          if (fReq) {
            const parsed = JSON.parse(fReq)?.[0]?.[0]?.[1];
            if (parsed) {
              const convUuid = JSON.parse(parsed)?.[3];
              convUuid && typeof convUuid === "string" && l.setConversationUuid(convUuid);
            }
          }
        }
      } catch {}
    }
  }

  class GoogleAIResolvePlugin extends Plugin {
    get name() { return "GoogleAIResolve"; }
    get protocol() { return 'xhr'; }
    targetSuffix = "MakerSuiteService/ResolveDriveResource";

    matchRequest(ctx) {
      const url = typeof ctx.url === "string" ? ctx.url : ctx.url?.toString() || "";
      return url.endsWith(this.targetSuffix) || url.includes(this.targetSuffix + "?") || url.includes(this.targetSuffix + "$");
    }

    onRequest(ctx) {
      const url = typeof ctx.url === "string" ? ctx.url : ctx.url?.toString() || "";
      url && w.setUrl(url);
    }
  }

  // ═══════════════════════════════════════════════════════
  // XHR Interceptor wrapper — routes XHR to plugins
  // ═══════════════════════════════════════════════════════

  class XHRInterceptor {
    constructor() {
      this.plugins = [];
      this.initialized = false;
    }

    register(plugin) { this.plugins.push(plugin); }

    // Initialize once — prototype patch both open() and send()
    start() {
      if (this.initialized) return;
      this.initialized = true;

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      const self = this;

      // Hook open() — capture URL + method
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._xhr_url = url;
        this._xhr_method = method;
        this._xhr_headers = {};
        // Wrap setRequestHeader to capture headers
        const originalSetHeader = this.setRequestHeader.bind(this);
        this.setRequestHeader = function (key, value) {
          this._xhr_headers[key.toLowerCase()] = value;
          originalSetHeader(key, value);
        };
        return originalOpen.call(this, method, url, ...rest);
      };

      // Hook send() — run plugins before request
      XMLHttpRequest.prototype.send = function (body) {
        const ctx = {
          protocol: 'xhr',
          method: this._xhr_method,
          url: this._xhr_url,
          headers: { ...this._xhr_headers },
          body: body,
          xhr: this, // reference to XHR instance
          timestamp: Date.now()
        };

        // Run request plugins
        for (const plugin of self.plugins) {
          if (plugin.protocol !== 'xhr' && plugin.protocol !== 'both') continue;
          if (plugin.matchRequest?.(ctx)) {
            try { plugin.onRequest?.(ctx); } catch (e) { /* silent */ }
          }
        }

        // Continue with original send
        return originalSend.call(this, body);
      };

      console.log("[VIVIM inject] XHR interceptor started");
    }

    stop() {
      // Restore original prototypes (simplified)
      this.initialized = false;
    }
  }

  // Singleton XHR interceptor
  const xhrInterceptor = new XHRInterceptor();

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

      // Handle user prompt intercept
      const isConversationEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);
      if (isConversationEndpoint && ctx.init?.body && window.__VIVIM_BRIDGE) {
        try {
          const bodyStr = typeof ctx.init.body === 'string' ? ctx.init.body : new TextDecoder().decode(ctx.init.body);
          const payload = JSON.parse(bodyStr);
          if (payload.messages && Array.isArray(payload.messages)) {
            // Find the last user message
            const userMessages = payload.messages.filter(m => m.author?.role === 'user');
            const userMessage = userMessages[userMessages.length - 1];
            if (userMessage && userMessage.content?.parts) {
               // Safely extract string parts (e.g. ignore multimodal visual objects)
const content = userMessage.content.parts
                  .filter(p => typeof p === 'string')
                  .join('\n');
                if (content) {
                  console.log("[VIVIM:INJECT] 📤 userPrompt sent", { 
                    role: "user", 
                    contentLength: content.length, 
                    conversationId: payload.conversation_id,
                    timestamp: Date.now(),
                    url: ctx.url?.slice(0, 80)
                  });
                  window.__VIVIM_BRIDGE.send("userPrompt", {
                    role: "user",
                    content: content,
                    conversationId: payload.conversation_id || null
                  });
                  console.log("[VIVIM:INJECT] ✅ userPrompt sent to bridge");
                }
            }
          }
        } catch (e) {
          console.warn("[VIVIM inject] Failed to parse ChatGPT request body:", e);
        }
      }
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
        let chunkSequence = 0; // Fix #12: sequence number for ordering guarantee
        const streamId = "stream_" + Date.now() + "_" + Math.floor(Math.random()*1000);

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

                        // Append or Replace text content
                        if (subPath === "/message/content/parts/0") {
                          if (subOpType === "append") {
                            reconstructedText += subValue;
                            appendCount++;
                            chunkSequence++;
                          } else if (subOpType === "replace" || subOpType === "add") {
                            reconstructedText = subValue;
                            appendCount++;
                            chunkSequence++;
                          }

                          // Send chunk to bridge on every content update with sequence number
if (window.__VIVIM_BRIDGE && reconstructedText) {
        console.log("[VIVIM:INJECT] 📤 chatChunk sent", { 
          seq: chunkSequence, 
          contentLength: reconstructedText.length, 
          model: currentModel, 
          url: ctx.url?.slice(0, 50),
          timestamp: Date.now(),
          contentPreview: reconstructedText.slice(0, 100)
        });
        window.__VIVIM_BRIDGE.send("chatChunk", {
                              role: currentRole || "assistant",
                              content: reconstructedText,
                              model: currentModel,
                              url: ctx.url,
                              seq: chunkSequence,
                              streamId: streamId,
                              cumulative: true
                            });
                          }
                        }
                      }
                    } else if (path === "/message/content/parts/0") {
                      // Single append/replace operation
                      if (op === "append") {
                        reconstructedText += value;
                        appendCount++;
                        chunkSequence++;
                      } else if (op === "replace" || op === "add") {
                        reconstructedText = value;
                        appendCount++;
                        chunkSequence++;
                      }

                      // Send chunk on every update with sequence number
                      if (window.__VIVIM_BRIDGE && reconstructedText) {
                        window.__VIVIM_BRIDGE.send("chatChunk", {
                          role: currentRole || "assistant",
                          content: reconstructedText,
                          model: currentModel,
                          url: ctx.url,
                          seq: chunkSequence,
                          streamId: streamId,
                          cumulative: true
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
          if (eventData && currentEvent === "delta") {
            eventCount++;
            try {
              processDeltaPayload(JSON.parse(eventData));
            } catch (e) {}
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
              if (subPath === "/message/content/parts/0") {
                if (subOpType === "append") {
                  reconstructedText += subValue;
                  appendCount++;
                  chunkSequence++;
                } else if (subOpType === "replace" || subOpType === "add") {
                  reconstructedText = subValue;
                  appendCount++;
                  chunkSequence++;
                }
              }
              // Fix #10: break early on stream end
              if (subPath === "/message/status" && subOpType === "replace" && subValue === "finished_successfully") {
                streamEnded = true;
              }
            }
          } else if (path === "/message/content/parts/0") {
            if (op === "append") {
              reconstructedText += value;
              appendCount++;
              chunkSequence++;
            } else if (op === "replace" || op === "add") {
              reconstructedText = value;
              appendCount++;
              chunkSequence++;
            }
          }
          if (path === "/message/status" && op === "replace" && value === "finished_successfully") {
            streamEnded = true;
          }
        }

        // Send final reconstructed message
        if (reconstructedText && window.__VIVIM_BRIDGE) {
          chunkSequence++;
          console.log(`[VIVIM inject] 📤 Sending final message: ${reconstructedText.length} chars, ${appendCount} appends, seq=${chunkSequence}`);
          window.__VIVIM_BRIDGE.send("chatChunk", {
            role: currentRole || "assistant",
            content: reconstructedText,
            model: currentModel,
            url: ctx.url,
            seq: chunkSequence,
            streamId: streamId,
            cumulative: true
          });
        }

        // Signal stream complete
        console.log(`[VIVIM inject] ✅ Stream finished — ${eventCount} events, ${appendCount} text appends, ${reconstructedText.length} chars`);
        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { streamId, timestamp: Date.now() });
        }
      } catch (e) {
        console.warn("[VIVIM inject] Stream read error:", e);
        // Still try to send complete so sidepanel exits streaming state
        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { streamId, timestamp: Date.now() });
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

  // Claude Plugin (claude.ai web)
  class ClaudePlugin extends Plugin {
    get name() { return "Claude"; }

    matchRequest(ctx) {
      return ctx.url?.includes("claude.ai");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) ClaudeAuthStore.setAuthData(auth);

      const sessionKey = ctx.headers["x-session-key"] || ctx.headers["x-session-key"];
      if (sessionKey) ClaudeAuthStore.setSessionKey(sessionKey);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("claude.ai");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.delta?.text) {
                  fullContent += event.delta.text;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: event.model || "claude",
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  // DeepSeek Plugin (deepseek.com)
  class DeepSeekPlugin extends Plugin {
    get name() { return "DeepSeek"; }

    matchRequest(ctx) {
      return ctx.url?.includes("deepseek.com");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) DeepSeekAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("deepseek.com");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";
        let currentModel = "deepseek-chat";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (event.model) currentModel = event.model;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: currentModel,
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  // Perplexity Plugin (perplexity.ai)
  class PerplexityPlugin extends Plugin {
    get name() { return "Perplexity"; }

    matchRequest(ctx) {
      return ctx.url?.includes("perplexity.ai");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) PerplexityAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("perplexity.ai");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";
        let currentModel = "sonar";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (event.model) currentModel = event.model;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: currentModel,
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  class GrokPlugin extends Plugin {
    get name() { return "Grok"; }

    matchRequest(ctx) {
      return ctx.url?.includes("grok.com") || ctx.url?.includes("api.x.ai");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) GrokAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("grok.com") || ctx.url?.includes("api.x.ai");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";
        let currentModel = "grok-4";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (event.model) currentModel = event.model;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: currentModel,
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  class PoePlugin extends Plugin {
    get name() { return "Poe"; }

    matchRequest(ctx) {
      return ctx.url?.includes("poe.com");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) PoeAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("poe.com");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: event.model || "poe",
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  class TongyiPlugin extends Plugin {
    get name() { return "Tongyi"; }

    matchRequest(ctx) {
      return ctx.url?.includes("tongyi.aliyun.com") || ctx.url?.includes("dashscope");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) TongyiAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("tongyi.aliyun.com") || ctx.url?.includes("dashscope");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";
        let currentModel = "qwen-plus";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (event.model) currentModel = event.model;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: currentModel,
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  class YuanbaoPlugin extends Plugin {
    get name() { return "Yuanbao"; }

    matchRequest(ctx) {
      return ctx.url?.includes("yuanbao.tencent.com") || ctx.url?.includes("hunyuan");
    }

    onRequest(ctx) {
      const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
      if (auth) YuanbaoAuthStore.setAuthData(auth);
    }

    matchResponse(ctx) {
      return ctx.url?.includes("yuanbao.tencent.com") || ctx.url?.includes("hunyuan");
    }

    async onResponse(ctx) {
      const clone = ctx.clone;
      if (!clone || !clone.body) return;

      try {
        const reader = clone.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (event.choices?.[0]?.delta?.content) {
                  fullContent += event.choices[0].delta.content;
                  if (window.__VIVIM_BRIDGE) {
                    window.__VIVIM_BRIDGE.send("chatChunk", {
                      role: "assistant",
                      content: fullContent,
                      model: event.model || "hunyuan",
                      url: ctx.url,
                    });
                  }
                }
              } catch {}
            }
          }
        }

        if (window.__VIVIM_BRIDGE) {
          window.__VIVIM_BRIDGE.send("streamComplete", { timestamp: Date.now() });
        }
      } catch (e) {}
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
      console.log("[VIVIM:INJECT] 🔗 Fetch interceptor STARTED, originalFetch:", typeof self.originalFetch);

      window.fetch = async function (input, init) {
        const url = resolveUrl(input);
        console.log("[VIVIM:INJECT] 🔗 fetch() intercepted:", url?.slice(0, 60), "plugins:", self.plugins.length);

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
  // StreamDestination interface
  // ═══════════════════════════════════════════════════════

  class StreamDestination {
    get id() { return "base"; }
    get capabilities() { return { receivesStreaming: false, receivesComplete: false, canSendPrompts: false }; }
    onChunk(msg) {}
    onComplete(conversationId) {}
    onError(conversationId, error) {}
    sendPrompt(conversationId, prompt) { return Promise.reject(new Error("Not implemented")); }
    dispose() {}
  }

  class DestinationRegistry {
    #destinations = new Map();

    register(dest) {
      this.#destinations.set(dest.id, dest);
    }

    unregister(id) {
      const dest = this.#destinations.get(id);
      if (dest) {
        dest.dispose();
        this.#destinations.delete(id);
      }
    }

    get(id) { return this.#destinations.get(id); }

    getAll() { return Array.from(this.#destinations.values()); }

    broadcastChunk(msg) {
      for (const dest of this.#destinations.values()) {
        if (dest.capabilities.receivesStreaming) {
          try { dest.onChunk(msg); } catch (e) { /* silent */ }
        }
      }
    }

    broadcastComplete(conversationId) {
      for (const dest of this.#destinations.values()) {
        if (dest.capabilities.receivesComplete) {
          try { dest.onComplete(conversationId); } catch (e) { /* silent */ }
        }
      }
    }

    broadcastError(conversationId, error) {
      for (const dest of this.#destinations.values()) {
        try { dest.onError(conversationId, error); } catch (e) { /* silent */ }
      }
    }
  }

  // Singleton
  const destinationRegistry = new DestinationRegistry();

  // ═══════════════════════════════════════════════════════
  // WebSocket Destination (stub for external tools)
  // ═══════════════════════════════════════════════════════

  class WebSocketDestination extends StreamDestination {
    #socket = null;
    #url = null;
    #protocol = null;
    #reconnectAttempts = 0;
    #maxReconnectAttempts = 5;
    #reconnectDelay = 1000;
    #heartbeatInterval = null;
    #heartbeatTimeout = 30000;
    #lastMessageTime = 0;
    #buffer = [];
    #connected = false;

    constructor(config = {}) {
      super();
      this.#url = config.url || "ws://localhost:8080";
      this.#protocol = config.protocol || null;
      this.#maxReconnectAttempts = config.maxReconnectAttempts || 5;
      this.#reconnectDelay = config.reconnectDelay || 1000;
      this.#heartbeatTimeout = config.heartbeatTimeout || 30000;
    }

    get id() { return "websocket"; }
    get capabilities() { return { receivesStreaming: true, receivesComplete: true, canSendPrompts: true }; }

    configure(config) {
      if (config.url) {
        this.#url = config.url;
        if (this.#socket) {
          this.#socket.close();
          this.#connect();
        }
      }
      if (config.protocol) this.#protocol = config.protocol;
      if (config.maxReconnectAttempts) this.#maxReconnectAttempts = config.maxReconnectAttempts;
      if (config.reconnectDelay) this.#reconnectDelay = config.reconnectDelay;
    }

    connect() {
      this.#connect();
    }

    #connect() {
      try {
        const options = this.#protocol ? { protocol: this.#protocol } : undefined;
        this.#socket = new WebSocket(this.#url, options);

        this.#socket.onopen = () => {
          this.#connected = true;
          this.#reconnectAttempts = 0;
          this.#startHeartbeat();
          this.#flushBuffer();
        };

        this.#socket.onclose = (e) => {
          this.#connected = false;
          this.#stopHeartbeat();
          this.#scheduleReconnect();
        };

        this.#socket.onerror = (e) => {
          this.#connected = false;
        };

        this.#socket.onmessage = (e) => {
          this.#lastMessageTime = Date.now();
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "pong") return;
            if (window.__VIVIM_BRIDGE) {
              window.__VIVIM_BRIDGE.send("wsMessage", msg);
            }
          } catch {}
        };
      } catch (e) {
        console.warn("[VIVIM] WebSocket connect error:", e);
      }
    }

    #startHeartbeat() {
      this.#heartbeatInterval = setInterval(() => {
        if (this.#socket?.readyState === WebSocket.OPEN) {
          this.#socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        }
      }, this.#heartbeatTimeout);
    }

    #stopHeartbeat() {
      if (this.#heartbeatInterval) {
        clearInterval(this.#heartbeatInterval);
        this.#heartbeatInterval = null;
      }
    }

    #scheduleReconnect() {
      if (this.#reconnectAttempts >= this.#maxReconnectAttempts) return;
      this.#reconnectAttempts++;
      const delay = this.#reconnectDelay * Math.pow(2, this.#reconnectAttempts - 1);
      setTimeout(() => this.#connect(), delay);
    }

    #flushBuffer() {
      while (this.#buffer.length > 0 && this.#socket?.readyState === WebSocket.OPEN) {
        const msg = this.#buffer.shift();
        this.#socket.send(msg);
      }
    }

    onChunk(msg) {
      const payload = JSON.stringify({ type: "chunk", data: msg, timestamp: Date.now() });
      if (this.#socket?.readyState === WebSocket.OPEN) {
        this.#socket.send(payload);
      } else {
        this.#buffer.push(payload);
      }
    }

    onComplete(msg) {
      const payload = JSON.stringify({
        type: "complete",
        conversationId: msg?.conversationId || null,
        content: msg?.content || "",
        timestamp: Date.now(),
      });
      if (this.#socket?.readyState === WebSocket.OPEN) {
        this.#socket.send(payload);
      } else {
        this.#buffer.push(payload);
      }
    }

    sendPrompt(conversationId, prompt) {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ type: "prompt", conversationId, prompt, timestamp: Date.now() });
        if (this.#socket?.readyState === WebSocket.OPEN) {
          this.#socket.send(payload);
          resolve();
        } else {
          reject(new Error("WebSocket not connected"));
        }
      });
    }

    dispose() {
      this.#stopHeartbeat();
      this.#buffer = [];
      if (this.#socket) {
        this.#socket.close();
        this.#socket = null;
      }
      this.#connected = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // Webhook Destination (stub for external endpoints)
  // ═══════════════════════════════════════════════════════

  class WebhookDestination extends StreamDestination {
    #url = null;
    #authHeader = null;
    #retryCount = 0;
    #maxRetries = 3;
    #timeout = 10000;

    constructor(config = {}) {
      super();
      this.#url = config.url || null;
      this.#authHeader = config.authHeader || null;
      this.#maxRetries = config.maxRetries || 3;
      this.#timeout = config.timeout || 10000;
    }

    get id() { return "webhook"; }
    get capabilities() { return { receivesStreaming: false, receivesComplete: true, canSendPrompts: false }; }

    configure(config) {
      if (config.url) this.#url = config.url;
      if (config.authHeader) this.#authHeader = config.authHeader;
      if (config.maxRetries) this.#maxRetries = config.maxRetries;
      if (config.timeout) this.#timeout = config.timeout;
    }

    async onChunk(msg) {}

    async onComplete(msg) {
      if (!this.#url) return;

      const payload = {
        type: "complete",
        conversationId: msg?.conversationId || null,
        timestamp: Date.now(),
        provider: msg?.model || "unknown",
        content: msg?.content || "",
      };

      await this.#sendWithRetry(payload);
    }

    async #sendWithRetry(payload, attempt = 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.#timeout);

      const headers = { "Content-Type": "application/json" };
      if (this.#authHeader) {
        if (this.#authHeader.startsWith("Bearer ")) {
          headers["Authorization"] = this.#authHeader;
        } else if (this.#authHeader.startsWith("Basic ")) {
          headers["Authorization"] = this.#authHeader;
        } else {
          headers["X-API-Key"] = this.#authHeader;
        }
      }

      try {
        const response = await fetch(this.#url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok && attempt < this.#maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          return this.#sendWithRetry(payload, attempt + 1);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (attempt < this.#maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          return this.#sendWithRetry(payload, attempt + 1);
        }
      }
    }

    dispose() {}
  }

  // ═══════════════════════════════════════════════════════
  // Main bootstrap
  // ═══════════════════════════════════════════════════════

  const b = y(() => {
    console.log("[VIVIM:INJECT] 🚀 Initializing VIVIM injection script...");
    const o = L("inject-chat-web", { allowedIds: ["saveai-extension-content"] });
    window.__VIVIM_BRIDGE = o;
    console.log("[VIVIM:INJECT] ✅ __VIVIM_BRIDGE created and ready");
    o.handle("getGeminiGlobalData", () => window.WIZ_global_data);
    o.handle("getGoogleAiKeys", () => window.AF_initDataKeys);
    o.handle("getCopilotAuthHeader", () => H.getLatest());
    o.handle("getChatGPTAuthHeader", () => g.getLatest());
    o.handle("getGeminiLatestReqId", () => f.getLatest());
    o.handle("getGeminiExtHeaders", () => f.getExtHeaders());
    o.handle("getGoogleAiResolveUrl", () => w.getLatest());
    o.handle("getNotebookLMLatestReqId", () => l.getLatest());
    o.handle("getKimiAuthHeader", () => c.getLatest());
    o.handle("getClaudeAuthHeader", () => ClaudeAuthStore.getLatest());
    o.handle("getDeepSeekAuthHeader", () => DeepSeekAuthStore.getLatest());
    o.handle("getPerplexityAuthHeader", () => PerplexityAuthStore.getLatest());
    o.handle("getGrokAuthHeader", () => GrokAuthStore.getLatest());
    o.handle("getPoeAuthHeader", () => PoeAuthStore.getLatest());
    o.handle("getTongyiAuthHeader", () => TongyiAuthStore.getLatest());
    o.handle("getYuanbaoAuthHeader", () => YuanbaoAuthStore.getLatest());

    // ── Fetch interceptor with fetch-based plugins ──
    console.log("[VIVIM:INJECT] 🔧 Setting up fetch interceptor with 10 plugins...");

    const fetchInterceptor = new FetchInterceptor();
    fetchInterceptor.register(new ChatGPTPlugin());
    console.log("[VIVIM:INJECT]   ✓ ChatGPTPlugin registered");
    fetchInterceptor.register(new CopilotPlugin());
    console.log("[VIVIM:INJECT]   ✓ CopilotPlugin registered");
    fetchInterceptor.register(new KimiPlugin());
    console.log("[VIVIM:INJECT]   ✓ KimiPlugin registered");
    fetchInterceptor.register(new ClaudePlugin());
    console.log("[VIVIM:INJECT]   ✓ ClaudePlugin registered");
    fetchInterceptor.register(new DeepSeekPlugin());
    console.log("[VIVIM:INJECT]   ✓ DeepSeekPlugin registered");
    fetchInterceptor.register(new PerplexityPlugin());
    console.log("[VIVIM:INJECT]   ✓ PerplexityPlugin registered");
    fetchInterceptor.register(new GrokPlugin());
    console.log("[VIVIM:INJECT]   ✓ GrokPlugin registered");
    fetchInterceptor.register(new PoePlugin());
    console.log("[VIVIM:INJECT]   ✓ PoePlugin registered");
    fetchInterceptor.register(new TongyiPlugin());
    console.log("[VIVIM:INJECT]   ✓ TongyiPlugin registered");
    fetchInterceptor.register(new YuanbaoPlugin());
    console.log("[VIVIM:INJECT]   ✓ YuanbaoPlugin registered");
    fetchInterceptor.start();
    console.log("[VIVIM:INJECT] ✅ Fetch interceptor started (10 plugins active)");

    // ── XHR interceptor with XHR-based plugins ──
    console.log("[VIVIM:INJECT] 🔧 Setting up XHR interceptor with 3 plugins...");
    xhrInterceptor.register(new GeminiPlugin());
    console.log("[VIVIM:INJECT]   ✓ GeminiPlugin registered");
    xhrInterceptor.register(new NotebookLMPlugin());
    console.log("[VIVIM:INJECT]   ✓ NotebookLMPlugin registered");
    xhrInterceptor.register(new GoogleAIResolvePlugin());
    console.log("[VIVIM:INJECT]   ✓ GoogleAIResolvePlugin registered");

    const a = document.URL.includes("https://gemini.google.com");
    const P = document.URL.includes("https://notebooklm.google.com");

    if (a || P) {
      xhrInterceptor.start();
      console.log("[VIVIM:INJECT] ✅ XHR interceptor started (3 plugins active)");
    }

    console.log("[VIVIM:INJECT] 🎉 VIVIM injection fully initialized!");
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
