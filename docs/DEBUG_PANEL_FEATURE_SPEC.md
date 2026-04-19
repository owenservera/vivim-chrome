# VIVIM Debug Panel - Comprehensive Feature Specification

## Overview

This document describes the full-featured debug panel designed for complete raw parsing debugging of VIVIM extension streaming infrastructure. It enables developers to inspect, trace, and debug SSE stream parsing, delta processing, and tool calling at a granular level.

---

## Architecture

### Component Hierarchy

```
DebugPanel
├── Header (title, actions)
├── Stats Bar (summary metrics)
├── Tabs (7 total)
│   ├── Events (existing)
│   ├── Streams (existing)
│   ├── Connections (existing)
│   ├── Performance (existing)
│   ├── Errors (existing)
│   ├── Study (existing)
│   └── PARSER (NEW) - Full raw parsing debug
├── Search & Filters (enhanced)
├── Main Content Area
│   ├── Events Tab
│   │   ├── Searchable list
│   │   ├── Expandable entries
│   │   ├── Type/Severity filters
│   │   └── NEW: Raw toggle
│   ├── Streams Tab
│   │   ├── Timeline visualization
│   │   └── Summary metrics
│   ├── PARSER Tab (NEW)
│   │   ├── Stream Selector
│   │   ├── Playback Controls
│   │   ├── State Machine Viz
│   │   ├── Raw Buffer Panel
│   │   ├── Parsed Delta Panel
│   │   ├── SSE Event View
│   │   ├── Tool Call Tracker
│   │   └── Accumulator Inspector
├── Action Buttons row
└── Keyboard Shortcuts Hint
```

---

## Tab 7: PARSER - Full Feature Specification

### 7.1 Stream Selector

**Purpose**: Select which stream to inspect

**Features**:
- Dropdown listing all active/completed streams
- Shows stream ID + status + duration
- Auto-selects latest stream
- Filter: All / Active / Completed

**UI Elements**:
- `<select id="parserStreamSelect">`
- Stream ID (truncated to 12 chars)
- Status badge (streaming/complete/error)
- Duration (seconds)

### 7.2 Playback Controls

**Purpose**: Control live stream inspection

**Controls**:
| Button | Shortcut | Function |
|--------|----------|----------|
| ⏸ Pause | `Space` | Freeze stream updates |
| ⏭ Step | `→` | Step to next chunk |
| ⟲ Replay | `R` | Replay from start |
| ⏹ Stop | `S` | Stop stream |
| ⟲⟲ Reset | `Ctrl+R` | Reset to beginning |

**States**:
- `playing` - Live updates enabled
- `paused` - Updates frozen
- `stepping` - Single chunk advancement
- `complete` - Stream finished

### 7.3 State Machine Visualization

**Purpose**: Visual representation of parser state transitions

**States** (from StreamState):
```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│  IDLE   │────▶│ CONNECTING  │────▶│ ROLE_RECEIVED   │
└─────────┘     └──────────────┘     └─────────────────┘
                                              │
                                              ▼
┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│  DONE   │◀────│ FINISHING    │◀────│  STREAMING       │
└─────────┘     └──────────────┘     └─────────────────┘
     ▲                                              │
     │                  ┌──────────────┐              │
     └─────────────────│ TOOL_CALLING │◀─────────────┘
                      └──────────────┘

     ┌─────────┐
     │ ERROR  │ (escape from any state)
     └─────────┘
```

**Features**:
- Highlight current state in green
- Show transition arrows with animation
- Log state transitions with timestamps
- History of last 20 transitions

### 7.4 Raw Buffer Panel

**Purpose**: Show unparsed raw SSE buffer

**Features**:
- Raw input buffer with line numbers
- Syntax highlighting for SSE:
  - `event:` lines (blue)
  - `data:` lines (green)
  - Comments (:) in gray
- Byte offset display
- Search within buffer
- Copy button

**Data Flow**:
```
chunk from network
    │
    ▼
┌─────────────┐
│ Raw Buffer  │ ◀── This panel shows data at this stage
└─────────────┘
    │
    ▼ (after line splitting)
┌─────────────┐
│ SSE Parser  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ JSON Parse  │ ◀── Next panel shows output
└─────────────┘
```

### 7.5 Parsed Delta Panel

**Purpose**: Show parsed delta vs cumulative content

**Views**:
- **Delta view**: Just this chunk's delta
- **Cumulative view**: Full accumulated content
- **Diff view**: Diff highlighted vs previous chunk

**Features**:
- Syntax highlighted content
- Markdown rendering toggle
- Word/character count
- Delta size indicator (+X chars since last chunk)
- Copy single entry button

### 7.6 SSE Event View

**Purpose**: Debug SSE event parsing

**Features**:
- Event type badge (`message` / `error` / `done`)
- Raw data with syntax highlighting
- Parsed JSON tree view
- JSON parse success/failure indicator
- Event sequence number

**Event Log**:
```
[#1] event: message
     data: {"message": {...}}
     parsed: ✓ (23ms)

[#2] event: message  
     data: {"delta": {...}}
     parsed: ✓ (12ms)

[#3] event: message
     data: {"delta": {..."text"
     parsed: ✗ (incomplete JSON)
```

### 7.7 Tool Call Tracker

**Purpose**: Monitor tool_call delta accumulation

**Features**:
- Tool call list with status:
  - `pending` - id/name received, waiting for arguments
  - `streaming` - arguments being built
  - `complete` - full tool call ready
- Arguments progress indicator
- Function name display
- Tool call index

**Data Model**:
```javascript
{
  index: 0,
  id: "call_abc123",
  type: "function",
  function: {
    name: "get_weather",
    arguments: '{"location":"NYC"}'  // accumulates
  },
  status: "complete",  // pending|streaming|complete
  bytesReceived: 45
}
```

### 7.8 Accumulator Inspector

**Purpose**: Inspect internal parser state

**State Properties**:
- `messageParts[]` - Array of content parts
- `currentRole` - Current role value
- `currentModel` - Current model value
- `chunkCount` - Total chunks processed
- `startTime` - When stream started

**Features**:
- Tree view of all properties
- JSON view toggle
- Live updates (when playing)
- Copy state button
- Export state button

---

## Enhanced Events Tab Features

### New: Raw Toggle

**Purpose**: Switch between formatted and raw JSON view

**Options**:
- `Formatted` - Default pretty-printed
- `Raw` - Raw JSON without formatting
- `Diff` - Changes from previous entry

### New: Bookmark/Pin

**Purpose**: Mark important entries

**Features**:
- Star icon to bookmark
- Pinned section at top
- Filter by bookmarks
- Export bookmarks only

---

## Button/Interaction Tooling

### Full Action Bar

| Button | Icon | Function |
|--------|------|----------|
| **Capture** | ⏺ | Start/stop capture |
| **Export** | ↗ | Export data (JSON/CSV/Clip) |
| **Import** | ↙ | Import debug data |
| **Clear** | 🗑 | Clear all data |
| **Copy** | 📋 | Copy to clipboard |
| **Pause** | ⏸ | Freeze updates |
| **Step** | ⏭ | Single step |
| **Replay** | ⟲ | Replay from start |
| **Raw** | `{ }` | Toggle raw/formatted |
| **Pin** | 📌 | Pin selection |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Toggle pause (when panel focused) |
| `→` | Step forward |
| `←` | Step backward |
| `R` | Replay |
| `E` | Expand all |
| `C` | Collapse all |
| `{` | Toggle raw view |
| `Ctrl+F` | Focus search |
| `Esc` | Clear search |
| `1-7` | Switch tabs |

---

## Data Capture Integration

### New Events Captured

| Event | Data | Purpose |
|-------|------|---------|
| `sse:buffer` | Raw SSE buffer | Raw input logging |
| `sse:event` | Event type + data | Event parsing |
| `json:parse:attempt` | Raw data | Parse attempt |
| `json:parse:success` | Parsed object | Parse success |
| `json:parse:error` | Error message | Parse failure |
| `delta:received` | Delta content | Delta received |
| `delta:processed` | Processed content | After reconstruction |
| `toolcall:start` | Tool call start | New tool call |
| `toolcall:delta` | Partial arguments | Tool call arguments |
| `toolcall:complete` | Full call | Complete tool call |
| `state:transition` | From → To | State changes |
| `accumulator:update` | New accumulator state | Internal updates |

---

## Performance Considerations

### Limits
- Streams tracked: 50 max
- Events per stream: 1000 max
- Buffer display: Last 50KB
- State history: Last 50 transitions

### Optimization
- Deferred rendering for large data
- Virtual scrolling for lists
- Throttled updates (100ms)
- Memory cleanup on tab close

---

## Integration Points

### DebugManager Methods (New)

```javascript
class DebugManager {
  // Existing
  captureEvent(type, data, metadata)
  captureStreamEvent(eventType, data, streamId)
  
  // NEW
  captureSSEBuffer(streamId, buffer, metadata)
  captureJSONParse(streamId, raw, parsed, success, duration)
  captureDelta(streamId, delta, cumulative, seq)
  captureStateTransition(streamId, fromState, toState, timestamp)
  captureToolCall(streamId, toolCall, status)
  captureAccumulator(streamId, accumulator)
  
  // Stream playback
  getStreamById(streamId)
  getStreamChunks(streamId)
  resetStreamPlayback(streamId)
}
```

### DebugUIComponents Methods (New)

```javascript
class DebugUIComponents {
  // NEW - Parser Tab
  renderParserTab()
  renderStateMachine(streamId)
  renderRawBuffer(streamId)
  renderParsedDelta(streamId)
  renderSSEEvents(streamId)
  renderToolCalls(streamId)
  renderAccumulator(streamId)
  
  // NEW - Playback
  pausePlayback()
  stepForward()
  replay()
  resetPlayback()
  
  // NEW - Stream management
  setActiveStream(streamId)
  getStreamData(streamId)
}
```

---

## UI/UX Guidelines

### Color Scheme

| Element | Color |
|--------|-------|
| State: IDLE | Gray `#6B7280` |
| State: CONNECTING | Yellow `#F59E0B` |
| State: STREAMING | Green `#10B981` |
| State: TOOL_CALLING | Purple `#8B5CF6` |
| State: ERROR | Red `#EF4444` |
| State: DONE | Blue `#3B82F6` |
| Parse: Success | Green `#10B981` |
| Parse: Failure | Red `#EF4444` |
| Parse: Incomplete | Yellow `#F59E0B` |

### Accessibility

- Full keyboard navigation
- ARIA labels on all buttons
- Screen reader announcements for state changes
- Focus indicators
- High contrast mode support

---

## Acceptance Criteria

### Parser Tab
- [ ] Can select active stream from dropdown
- [ ] State machine shows current state
- [ ] Raw buffer shows SSE data line-by-line
- [ ] Parsed delta shows chunk content
- [ ] SSE events logged with parse status
- [ ] Tool calls tracked with status
- [ ] Accumulator state visible

### Playback Controls
- [ ] Pause freezes updates
- [ ] Step advances single chunk
- [ ] Replay resets to beginning
- [ ] Keyboard shortcuts work

### Enhanced Events Tab
- [ ] Raw toggle works
- [ ] Can bookmark entries
- [ ] Bookmarks persist
- [ ] Can pin entries
- [ ] Export includes metadata

### Action Bar
- [ ] All buttons functional
- [ ] Keyboard shortcuts work
- [ ] Toast notifications appear
- [ ] Export formats work

### Performance
- [ ] No lag with 100+ entries
- [ ] Smooth scrolling
- [ ] Memory stable over time
- [ ] Tab-switch is instant