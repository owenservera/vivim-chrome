# VIVIM Sidepanel 10x Design Document

## 1. Overview

### Project Name
VIVIM Sidepanel 10x - Enhanced Chat Mirror Panel

### Project Type
Chrome Extension Sidepanel UI Enhancement

### Core Feature Summary
Transform the basic sidepanel into a full-featured multi-provider chat mirror with rich content rendering, message actions, destination routing, and export capabilities - a 10x improvement over the current POC.

### Target Users
- AI power users who use multiple AI chat providers
- Developers integrating AI into workflows
- Teams exporting AI conversations for documentation

---

## 2. Visual Design

### 2.1 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (48px)                                     │
│ ┌─────────┐  ┌──────────────┐  ┌──────────┐   │
│ │ Brand   │  │ Provider │  │ Destina- │   │
│ │ VIVIM   │  │ Select  │  │ tion ▼  │   │
│ └─────────┘  └──────────────┘  └──────────┘   │
├───────────────────────────────────────────────┤
│ TOOLBAR (36px) - expandable                    │
│ [Search...] [Export ▼] [Theme] [Settings]    │
├─────────────────────────────────────────────┤
│ MESSAGE AREA (flex: 1, scrollable)           │
│ ┌────────────────────────────────────────┐ │
│ │ User message (right, primary)           │ │
│ │ [Copy] [Retry] [Delete]             │ │
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ Assistant (left, secondary)              │ │
│ │ <model:gpt-4> <time> [Copy]      │ │
│ │ ┌────────────────────────────┐      │ │
│ │ │ Markdown rendered      │      │ │
│ │ │ ```code```          │      │ │
│ │ │ **bold**          │      │ │
│ │ └────────────────────────────┘      │ │
│ └────────────────────────────────────────┘ │
│ ...                                      │
├─────────────────────────────────────────────┤
│ INPUT AREA (auto-resize, max 120px)            │
│ ┌───────────────────────┐ ┌─────────┐     │
│ │ Type prompt...      │ │ Send ▼  │     │
│ └───────────────────────┘ └─────────┘     │
├─────────────────────────────────────────────┤
│ FOOTER (32px)                              │
│ [4 messages] [● Connected] [Export ▼]  │
└─────���───────────────────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|---------|
| Compact | <320px | Single column, stacked buttons |
| Default | 320-400px | Full layout |
| Expanded | >400px | Additional actions visible |

### 2.3 Color Palette

#### Dark Theme (Default)
```css
--bg-primary:        #0D0D14;    /* Main background */
--bg-secondary:    #161625;    /* Cards, input */
--bg-tertiary:     #1E1E35;    /* Hover states */
--bg-elevated:    #252540;    /* Modals, dropdowns */

--text-primary:    #E8E8F0;    /* Main text */
--text-secondary:  #A0A0B8;    /* Descriptions */
--text-tertiary:  #686880;    /* Disabled */

--border-default:  #2A2A45;    /* Borders */
--border-focus:  #6C5CE7;    /* Focus ring */

--accent-primary:  #6C5CE7;    /* Primary actions */
--accent-hover:   #5A4BD5;    /* Primary hover */
--accent-accent: #00D2D3;    /* Streaming, active */
--accent-success: #00C853;    /* Connected */
--accent-warning: #FFB300;    /* Warnings */
--accent-error:   #FF5252;    /* Errors */

--provider-chatgpt:      #10A37F;
--provider-claude:      #D4A373;
--provider-gemini:     #8E8E8E;
--provider-copilot:  #0078D4;
--provider-deepseek: #5365F9;
--provider-perplexity:#6366F1;
--provider-grok:    #F59E0B;
--provider-poe:    #EF4444;
--provider-kimi:    #8B5CF6;
--provider-tongyi:  #F97316;
--provider-yuanbao:  #14B8A6;
```

#### Light Theme
```css
--bg-primary:        #FFFFFF;
--bg-secondary:    #F8F9FA;
--bg-tertiary:    #F1F3F5;
--bg-elevated:    #FFFFFF;

--text-primary:    #1A1A2E;
--text-secondary:  #4A4A5A;
--text-tertiary:  #9A9AAA;

--border-default:  #E5E5EA;
--accent-primary:  #5B41DC;
```

### 2.4 Typography

```css
--font-display:    'Inter', -apple-system, sans-serif;
--font-body:     'Inter', -apple-system, sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', monospace;
--font-size-xs:    10px;
--font-size-sm:    12px;
--font-size-base:   13px;
--font-size-lg:    14px;
--font-size-xl:    16px;
--font-size-2xl:  20px;
```

### 2.5 Spacing System

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
```

### 2.6 Components

#### Header Brand
- Height: 48px
- Logo: 20x20 SVG mark
- Brand text: "VIVIM" in accent-primary
- Gap between elements: 8px

#### Provider Selector Dropdown
- Width: 140px
- Shows current provider with colored dot
- Dropdown shows all 13 providers in grid
- Selected: checkmark icon

#### Destination Selector
- Width: 120px
- Options: sidepanel, webhook, websocket
- Icons for each destination type

#### Message Bubble - User
- Background: --accent-primary
- Text: white
- Border-radius: 12px 12px 4px 12px
- Padding: 10px 14px
- Max-width: 85%
- Position: right-aligned

#### Message Bubble - Assistant
- Background: --bg-secondary
- Border: 1px solid --border-default
- Border-left: 3px solid [provider-color]
- Border-radius: 12px 12px 12px 4px
- Padding: 10px 14px

#### Message Actions (hover reveal)
- Opacity: 0 on idle, 1 on hover
- Buttons: Copy, Retry, Delete
- Icon-only with tooltip

#### Input Area
- Auto-resize: 42px min, 120px max
- Placeholder: "Type your prompt..."
- Send button: primary color, disabled when empty

#### Toolbar
- Expandable on click
- Search: magnifying glass icon
- Export: download icon with dropdown
- Theme: sun/moon toggle

---

## 3. Functionality Specification

### 3.1 Core Features

#### Provider Management
| Feature | Description |
|---------|------------|
| Auto-detection | Detect current provider from tab URL |
| Manual switch | Override detected provider |
| Provider-specific model display | Show model name per message |
| Provider icons | Colored icons per provider |

#### Supported Providers (13)
| ID | Provider | Host Pattern |
|----|----------|------------|
| chatgpt | ChatGPT | chatgpt.com, chat.com |
| claude | Claude AI | claude.ai |
| copilot | GitHub Copilot | copilot.microsoft.com |
| gemini | Gemini | gemini.google.com |
| deepseek | DeepSeek | deepseek.com |
| perplexity | Perplexity | perplexity.ai |
| grok | Grok | grok.com |
| poe | Poe | poe.com |
| kimi | Kimi | kimi.moonshot.cn |
| tongyi | Tongyi | tongyi.aliyun.com |
| yuanbao | Yuanbao | yuanbao.tencent.com |
| notebooklm | NotebookLM | notebooklm.google.com |
| googleairesolve | Google AI | ai.google.dev |

#### Message Rendering
| Feature | Implementation |
|---------|--------------|
| Plain text | Default |
| Bold/italic | `**text**`, `*text*` |
| Code inline | `code` |
| Code blocks | ```lang\ncode\n``` with highlight |
| Lists | - item, 1. item |
| Headings | # ## ### |
| Links | [text](url) → clickable |
| Math | $inline$, $$block$$ (KaTeX) |
| Tables | Markdown tables |

#### Message Actions
| Action | Trigger | Result |
|--------|---------|--------|
| Copy single | Click copy icon | Copy message to clipboard |
| Copy all | Export dropdown | Copy all as markdown |
| Delete | Click trash icon | Remove from list |
| Retry | Click retry icon | Re-send prompt |

#### Destination Routing
| Destination | Capability | Config |
|-------------|------------|--------|
| sidepanel | Render locally | None |
| webhook | POST to URL | URL + auth header |
| websocket | Real-time WS | URL + protocol |

#### Export Formats
| Format | Extension | Content |
|---------|----------|---------|
| JSON | .json | Full data with metadata |
| Markdown | .md | Human readable |
| Plain text | .txt | Content only |

### 3.2 User Interactions

#### Hover States
```
Message bubble → Reveal action buttons (copy, retry, delete)
Input → Focus border color change
Button → Background lighten
Dropdown → Highlight option
```

#### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Enter | Send prompt |
| Cmd/Ctrl + Shift + C | Copy last message |
| Cmd/Ctrl + K | Focus search |
| Escape | Close dropdowns |

#### Tab Behavior
```
Multi-tab → Switch message context on tab change
URL change → Re-detect provider
```

### 3.3 Data Handling

#### Message Schema
```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider: string;        // "chatgpt", "claude", etc.
  model?: string;         // "gpt-4", "claude-3", etc.
  timestamp: number;
  conversationId?: string;
  metadata?: {
    tokens?: number;
    finishReason?: string;
    error?: string;
  };
}
```

#### Conversation Schema
```typescript
interface Conversation {
  id: string;
  provider: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}
```

### 3.4 Edge Cases

| Scenario | Handling |
|----------|----------|
| No provider detected | Show "Unknown" with gray dot |
| Network error | Show error banner, allow retry |
| Empty conversation | Show empty state |
| Long messages | Truncate in preview, expand on click |
| Rapid streaming | Debounce UI updates 16ms |
| Provider switch mid-conversation | Clear messages, start fresh |
| Webhook fails | Retry 3x, show error toast |
| WebSocket disconnects | Auto-reconnect, show status |

---

## 4. Acceptance Criteria

### 4.1 Functional Tests

| # | Feature | Success Condition |
|---|---------|---------------|
| F1 | Auto-detect all 13 providers | Each provider URL shows correct name |
| F2 | Switch provider manually | Dropdown changes active detection |
| F3 | Render markdown | Bold, code, lists display correctly |
| F4 | Code highlighting | Syntax colors in code blocks |
| F5 | Copy message | Clipboard contains correct content |
| F6 | Export JSON | Valid JSON download |
| F7 | Export Markdown | Readable .md file |
| F8 | Destination routing | Messages route to selected destination |
| F9 | Delete message | Message removed from list |
| F10 | Search messages | Filter shows matching results |

### 4.2 Visual Checkpoints

| # | Checkpoint | Validation |
|---|-----------|-----------|
| V1 | Header shows brand, provider, destination | All 3 elements visible |
| V2 | Provider dropdown works | Click reveals 13 options |
| V3 | Message bubbles styled correctly | User right, assistant left, colored border |
| V4 | Action buttons appear on hover | Visible on mouse over message |
| V5 | Input auto-resizes | Grows with content up to max |
| V6 | Dark theme applied | Matches color palette |
| V7 | Light theme works | Toggle switches all colors |
| V8 | Status shows connection | Green dot when connected |
| V9 | Export dropdown works | Shows JSON, MD, TXT options |
| V10 | Theme persists | Saved across sidepanel restarts |

### 4.3 Performance Criteria

| Metric | Target |
|--------|-------|
| Initial render | <100ms |
| Message add | <16ms (60fps) |
| Stream update | <16ms |
| Theme switch | <50ms |
| Export 100 messages | <500ms |

---

## 5. Technical Implementation

### 5.1 File Structure
```
sidepanel/
├── sidepanel.html      # Main HTML
├── sidepanel.js       # Logic
├── sidepanel.css    # Extracted styles
├── components/
│   ├── ProviderSelector.js
│   ├── MessageRenderer.js
│   ├── DestinationConfig.js
│   └── ExportManager.js
└── lib/
    ├── marked.min.js     # Markdown parser
    ├── highlight.min.js  # Syntax highlight
    └── katex.min.js    # Math rendering
```

### 5.2 Dependencies

| Library | Purpose | Version |
|---------|---------|---------|
| marked | Markdown parsing | ^12.0 |
| highlight.js | Code highlighting | ^11.9 |
| katex | Math rendering | ^0.16 |

### 5.3 Backward Compatibility

- Keep existing message rendering for old format
- Graceful degradation if libs fail to load
- Preserve existing storage keys