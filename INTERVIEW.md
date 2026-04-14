# VIVIM POC Interview Workbook

Systematic requirements gathering for full provider/destination coverage.

---

## PART 1: PROVIDER INTERVIEW

For each missing provider, document:

### 1.1 Basic Info
```
Provider: _______________
Host: _______________
API Endpoint: _______________
Documentation: _______________
```

### 1.2 Intercept Pattern
```
Detection URL pattern: _______________
XHR/Fetch intercept needed: [ ] XHR [ ] Fetch
Auth required: [ ] None [ ] Cookie [ ] Token [ ] Bearer
```

### 1.3 Message Format
```
Request payload structure:
{
  _______________
}

Response stream pattern:
[ ] Server-Sent Events (SSE)
[ ] JSON Lines
[ ] WebSocket
[ ] Other: _______________
```

### 1.4 Edge Cases
```
Rate limiting: _______________
Auth expiry handling: _______________
Error codes to handle: _______________
```

### 1.5 Testing Checklist
```
[ ] Manual verification on target site
[ ] Interceptor triggers correctly
[ ] Message format parses correctly
[ ] Stream delivers to destination
[ ] Auth handled gracefully
```

---

## PART 2: DESTINATION INTERVIEW

### 2.1 Webhook Destination
```
Endpoint URL config: _______________
Auth method: [ ] None [ ] Bearer [ ] Basic [ ] API Key
Headers to send: _______________
Retry policy: _______________
Timeout: _______________
Payload format: [ ] JSON [ ] Form [ ] Custom
```

### 2.2 WebSocket Destination
```
Server URL config: _______________
Protocol: _______________
Reconnection: [ ] Auto [ ] Manual [ ] None
Heartbeat: [ ] Yes [ ] No
Message format: _______________
```

### 2.3 File Export Destination (if needed)
```
Output format: [ ] JSON [ ] Markdown [ ] HTML
File location: _______________
Naming convention: _______________
```

---

## PART 3: ARCHITECTURE INTERVIEW

### 3.1 Current POC Architecture
```
Plugin interface location: _______________
Registry location: _______________
Message routing: _______________
```

### 3.2 What's Missing?
```
[ ] Provider auto-discovery
[ ] Runtime provider switching
[ ] Destination config UI
[ ] Error recovery
[ ] Connection state management
```

### 3.3 Extension Points Needed
```
Custom headers for providers: _______________
Provider-specific config: _______________
Destination chaining: _______________
```

---

## PART 4: REFERENCE COMPARISON

### 4.1 chatexporter Features to Match
| Feature | chatexporter | POC Current | Gap |
|---------|------------|-----------|-----|
| Provider count | 18+ | 6 | 12 |
| Intercept method | ? | ? | ? |
| Stream handling | ? | ? | ? |
| Destination types | ? | ? | ? |
| Config UI | ? | ? | ? |
| Error handling | ? | ? | ? |

### 4.2 Must-Have Features (non-negotiable)
```
1. _______________
2. _______________
3. _______________
4. _______________
5. _______________
```

### 4.3 Nice-to-Have Features
```
1. _______________
2. _______________
3. _______________
```

---

## PART 5: TESTING INTERVIEW

### 5.1 Unit Tests Needed
```
Provider unit tests: _______________
Destination unit tests: _______________
Integration tests: _______________
```

### 5.2 Manual Testing Checklist
```
[ ] Each provider intercepts correctly
[ ] Each destination connects
[ ] Cross-provider to any destination works
[ ] Error recovery works
[ ] Reconnection works
```

### 5.3 Build Verification
```
[ ] esbuild succeeds
[ ] No new lint errors
[ ] Extension loads in Chrome
[ ] All providers register
```

---

## INTERVIEW TEMPLATE FIELDS

Use this to fill in each provider:

### Provider: [NAME]
| Field | Value |
|-------|-------|
| Host | |
| API URL | |
| Intercept type | |
| Auth type | |
| Stream format | |
| Test status | |

---

## TO COMPLETE THIS INTERVIEW

1. [ ] Analyze chatexporter source for each provider pattern
2. [ ] Test each existing POC provider
3. [ ] Document all missing provider APIs
4. [ ] Verify destination requirements
5. [ ] Define must-have vs nice-to-have