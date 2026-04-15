# VIVIM Browser Extension — Visual Design Guide

> **Version**: 1.0.0 | **Date**: April 2026  
> **Companion to**: [01-SYSTEM-OVERVIEW.md](./01-SYSTEM-OVERVIEW.md) | [02-FEATURES-AND-INTERACTIONS.md](./02-FEATURES-AND-INTERACTIONS.md)

---

## 1. Design Philosophy

The VIVIM extension UI is designed to feel like a **natural continuation of the VIVIM ecosystem** — not a separate product. It inherits the PWA's visual language but adapts it for the constrained, task-focused context of a browser extension.

### Core Principles

| Principle | Application |
|---|---|
| **Minimal Intrusion** | The FAB and badge are the only on-page elements; never obscure AI platform content |
| **Contextual Density** | Side panel packs maximum information into limited space without feeling cramped |
| **Progressive Disclosure** | Show summary first, expand for detail; never overwhelm |
| **Ambient Awareness** | Badge and FAB provide passive status without demanding attention |
| **Dark-First** | Most AI platforms use dark themes; VIVIM should blend seamlessly |
| **Platform Respect** | Extension styles never leak into or conflict with host page styles |

---

## 2. Color System

### Brand Palette

```css
:root {
  /* Primary — VIVIM Brand */
  --vivim-primary:        #6C5CE7;  /* Electric Violet */
  --vivim-primary-hover:  #5A4BD5;
  --vivim-primary-active: #4A3BC3;
  --vivim-primary-subtle: #6C5CE720;
  
  /* Accent — Knowledge/Intelligence */
  --vivim-accent:         #00D2D3;  /* Cyan Pulse */
  --vivim-accent-hover:   #00B8B9;
  --vivim-accent-subtle:  #00D2D320;
  
  /* Success */
  --vivim-success:        #00C853;
  --vivim-success-subtle: #00C85320;
  
  /* Warning */
  --vivim-warning:        #FFA726;
  --vivim-warning-subtle: #FFA72620;
  
  /* Error */
  --vivim-error:          #FF5252;
  --vivim-error-subtle:   #FF525220;
  
  /* Info */
  --vivim-info:           #448AFF;
  --vivim-info-subtle:    #448AFF20;
}
```

### Dark Theme (Default)

```css
[data-theme="dark"] {
  --bg-primary:       #0D0D14;     /* Near-black with subtle purple tint */
  --bg-secondary:     #161625;     /* Card/surface background */
  --bg-tertiary:      #1E1E35;     /* Elevated surfaces */
  --bg-hover:         #252540;     /* Hover state */
  --bg-active:        #2D2D50;     /* Active/pressed state */
  
  --text-primary:     #E8E8F0;     /* Primary text */
  --text-secondary:   #A0A0B8;     /* Secondary/muted text */
  --text-tertiary:    #686880;     /* Disabled/hint text */
  
  --border-primary:   #2A2A45;     /* Default borders */
  --border-hover:     #3A3A55;     /* Hover state borders */
  --border-focus:     var(--vivim-primary);
  
  --shadow-sm:        0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:        0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg:        0 8px 32px rgba(0,0,0,0.6);
  --shadow-glow:      0 0 20px var(--vivim-primary-subtle);
}
```

### Light Theme

```css
[data-theme="light"] {
  --bg-primary:       #FAFAFE;
  --bg-secondary:     #FFFFFF;
  --bg-tertiary:      #F0F0F8;
  --bg-hover:         #E8E8F0;
  --bg-active:        #D8D8E8;
  
  --text-primary:     #1A1A2E;
  --text-secondary:   #555570;
  --text-tertiary:    #9090A5;
  
  --border-primary:   #E0E0EC;
  --border-hover:     #C8C8D8;
  --border-focus:     var(--vivim-primary);
  
  --shadow-sm:        0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:        0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg:        0 8px 32px rgba(0,0,0,0.16);
  --shadow-glow:      0 0 20px var(--vivim-primary-subtle);
}
```

---

## 3. Typography

```css
:root {
  /* Font Stack — matches PWA */
  --font-sans:     'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:     'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  
  /* Scale */
  --text-xs:       0.6875rem;    /* 11px */
  --text-sm:       0.75rem;      /* 12px */
  --text-base:     0.8125rem;    /* 13px — default for extension */
  --text-md:       0.875rem;     /* 14px */
  --text-lg:       1rem;         /* 16px */
  --text-xl:       1.125rem;     /* 18px */
  --text-2xl:      1.375rem;     /* 22px */
  
  /* Weights */
  --weight-normal:  400;
  --weight-medium:  500;
  --weight-semibold: 600;
  --weight-bold:    700;
  
  /* Line Heights */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

> **Note**: Extension text is 1-2px smaller than PWA to accommodate the side panel's narrower viewport (400px vs full desktop).

---

## 4. Spacing & Layout

```css
:root {
  /* Spacing Scale */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  
  /* Border Radius */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-full: 9999px;
  
  /* Side Panel Dimensions */
  --panel-width:     400px;     /* Default Chrome side panel width */
  --panel-min-width: 320px;
  --panel-max-width: 500px;
  --header-height:   48px;
  --tab-bar-height:  40px;
}
```

---

## 5. Component Design

### 5.1 — FAB (Floating Action Button)

The FAB is the extension's only presence on AI platform pages. It must be:
- Unobtrusive but discoverable
- Visually consistent across all platforms
- Never overlapping platform-specific UI elements

```
┌──────────────────────────────────┐
│                                  │
│   AI Platform Page Content       │
│                                  │
│                                  │
│                                  │
│                                  │
│                         ┌──────┐ │
│                         │  V   │ │  ← FAB (40x40px)
│                         │  ✨  │ │     Position: fixed
│                         └──────┘ │     Bottom: 24px
│                                  │     Right: 24px
└──────────────────────────────────┘
```

**States**:

| State | Visual | Description |
|---|---|---|
| **Idle** | Translucent icon, 40x40px, rounded | Default dormant state |
| **Hover** | Scale 1.1, glow shadow, opacity 1.0 | Mouse over |
| **Ready** | Pulsing border animation (primary color) | Conversation detected, ready to capture |
| **Saving** | Spinning loader inside icon | Capture in progress |
| **Saved** | Green checkmark, then fade back to idle | Success (3s duration) |
| **Error** | Red exclamation, shake animation | Capture failed |
| **Queued** | Clock icon with count badge | Items in offline queue |

**CSS**:
```css
.vivim-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-primary);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  z-index: 2147483647;  /* Maximum z-index */
  opacity: 0.7;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vivim-fab:hover {
  opacity: 1;
  transform: scale(1.1);
  box-shadow: var(--shadow-glow);
  border-color: var(--vivim-primary);
}

.vivim-fab--ready {
  border-color: var(--vivim-primary);
  animation: vivim-pulse 2s infinite;
}

.vivim-fab--saving {
  opacity: 1;
  pointer-events: none;
}

.vivim-fab--saved {
  border-color: var(--vivim-success);
  animation: vivim-check 0.4s ease-out;
}

@keyframes vivim-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--vivim-primary-subtle); }
  50% { box-shadow: 0 0 0 8px transparent; }
}

@keyframes vivim-check {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

**Important**: All FAB styles must use a unique namespace prefix (`vivim-`) and `!important` overrides where necessary to prevent host page CSS from interfering. Plasmo handles Shadow DOM isolation for content script UIs.

---

### 5.2 — Side Panel Layout

```
┌─────────────────────────────────────────┐ 400px
│ ┌─────────────────────────────────────┐ │
│ │  🟣 VIVIM         ⚙️ Settings      │ │ Header (48px)
│ └─────────────────────────────────────┘ │
│ ┌──────┬──────┬──────┐                  │
│ │Capture│History│Brain │                 │ Tab Bar (40px)
│ └──────┴──────┴──────┘                  │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │   Tab Content Area                  │ │ Content Area
│ │   (scrollable)                      │ │ (fills remaining)
│ │                                     │ │
│ │                                     │ │
│ │                                     │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │  Status bar: Connected • 3 saved    │ │ Footer (32px)
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### 5.3 — Conversation Preview Card

```css
.conversation-preview {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.conversation-preview__header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.conversation-preview__platform-icon {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
}

.conversation-preview__title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-preview__meta {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  display: flex;
  gap: var(--space-3);
}
```

---

### 5.4 — Message Card

```
┌─────────────────────────────────────┐
│ ☑ 👤 User                    2:34pm │
│ ────────────────────────────────── │
│ How do I create a custom React     │
│ hook for debouncing input values?  │
│                                     │
│ I want it to be generic and work   │
│ with TypeScript.                    │
│                              █ 87w │
└─────────────────────────────────────┘
```

```css
.message-card {
  padding: var(--space-3);
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}

.message-card--user {
  border-left-color: var(--vivim-primary);
}

.message-card--assistant {
  border-left-color: var(--vivim-accent);
}

.message-card--selected {
  background: var(--vivim-primary-subtle);
}

.message-card:hover {
  background: var(--bg-hover);
}

.message-card__role-icon {
  width: 16px;
  height: 16px;
}

.message-card__content {
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: var(--leading-normal);
}

.message-card__code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  overflow-x: auto;
}
```

---

### 5.5 — Progress Bar

```css
.progress-container {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--vivim-primary),
    var(--vivim-accent)
  );
  border-radius: var(--radius-full);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.15),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

---

### 5.6 — ACU Preview Pill

```css
.acu-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  border: 1px solid;
}

.acu-pill--assertion {
  background: #6C5CE710;
  border-color: #6C5CE730;
  color: #6C5CE7;
}

.acu-pill--code {
  background: #00D2D310;
  border-color: #00D2D330;
  color: #00D2D3;
}

.acu-pill--explanation {
  background: #FFA72610;
  border-color: #FFA72630;
  color: #FFA726;
}

.acu-pill--instruction {
  background: #00C85310;
  border-color: #00C85330;
  color: #00C853;
}

.acu-pill--question {
  background: #448AFF10;
  border-color: #448AFF30;
  color: #448AFF;
}
```

---

### 5.7 — Quality Score Bar

```css
.quality-bar {
  display: flex;
  gap: 2px;
  height: 4px;
  width: 80px;
}

.quality-bar__segment {
  flex: 1;
  border-radius: 1px;
  background: var(--bg-tertiary);
}

.quality-bar__segment--filled {
  background: var(--vivim-accent);
}

/* Quality thresholds */
.quality-bar[data-score="low"] .quality-bar__segment--filled {
  background: var(--vivim-error);
}

.quality-bar[data-score="medium"] .quality-bar__segment--filled {
  background: var(--vivim-warning);
}

.quality-bar[data-score="high"] .quality-bar__segment--filled {
  background: var(--vivim-success);
}
```

---

### 5.8 — Memory Type Badge

```css
.memory-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.memory-badge--episodic {
  background: #E1BEE7;
  color: #4A148C;
}

.memory-badge--semantic {
  background: #B3E5FC;
  color: #01579B;
}

.memory-badge--procedural {
  background: #C8E6C9;
  color: #1B5E20;
}

.memory-badge--factual {
  background: #FFE0B2;
  color: #E65100;
}

.memory-badge--preference {
  background: #F8BBD0;
  color: #880E4F;
}

.memory-badge--identity {
  background: #D1C4E9;
  color: #311B92;
}
```

---

## 6. Animations & Micro-interactions

### Transition Standards

```css
/* System-wide transitions */
:root {
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);  /* Material standard */
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);  /* Enter screen */
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);  /* Exit screen */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy */
  
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

### Key Animations

| Element | Trigger | Animation | Duration |
|---|---|---|---|
| FAB | Appear | Fade in + scale up | 300ms |
| FAB | Save | Spinner → check → fade | 2s total |
| Side panel | Open tab | Slide in + fade | 200ms |
| Message card | Select | Border highlight + bg color | 150ms |
| Progress bar | Update | Width transition + shimmer | 300ms + infinite |
| ACU preview | Appear | Staggered slide up | 50ms per item |
| History item | New | Slide down from top | 250ms |
| Toast | Appear/Dismiss | Slide up / slide down | 200ms |
| Badge count | Update | Scale bounce | 200ms |

---

## 7. Accessibility

| Requirement | Implementation |
|---|---|
| WCAG AA contrast | All text passes 4.5:1 ratio |
| Keyboard navigation | All interactive elements focusable; visible focus ring |
| Screen reader | `aria-label` on all controls; `role` on custom components |
| Reduced motion | `prefers-reduced-motion: reduce` disables all animations |
| High contrast | Respects Windows high contrast mode |
| Focus trap | Modal dialogs trap focus correctly |
| Tooltips | All icon-only buttons have tooltips |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.vivim-focus-ring:focus-visible {
  outline: 2px solid var(--vivim-primary);
  outline-offset: 2px;
}
```

---

## 8. Responsive Behavior

The side panel width is controlled by the browser, but we design for these breakpoints:

| Width | Layout | Adjustments |
|---|---|---|
| 320-360px | Compact | Single column; stacked metadata; smaller text |
| 360-440px | Default | Full layout as designed |
| 440-500px | Expanded | Extra whitespace; two-column metadata |

```css
@container (max-width: 360px) {
  .conversation-preview__meta {
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .message-card__content {
    font-size: var(--text-sm);
  }
}
```

---

## 9. Platform-Specific Adaptation

The FAB and any overlaid UI must adapt to each platform's visual language to avoid feeling foreign.

### ChatGPT
```css
/* ChatGPT uses a neutral dark theme */
:host([data-platform="chatgpt"]) .vivim-fab {
  /* Blend with ChatGPT's sidebar aesthetic */
  --bg-secondary: #202123;
  --border-primary: #343541;
}
```

### Claude
```css
/* Claude uses a warm beige/cream palette */
:host([data-platform="claude"]) .vivim-fab {
  --bg-secondary: #2B2118;
  --border-primary: #3E3429;
}
```

### Gemini
```css
/* Gemini uses Material Design with blue accents */
:host([data-platform="gemini"]) .vivim-fab {
  --bg-secondary: #1E1F23;
  --border-primary: #303134;
}
```

---

## 10. Icon System

Icons use a consistent 16x16px base size with these categories:

| Category | Icons | Source |
|---|---|---|
| **Navigation** | Home, Settings, History, Back | Phosphor Icons |
| **Actions** | Save, Retry, Delete, Copy, Share | Phosphor Icons |
| **Status** | Check, Error, Warning, Loading, Clock | Phosphor Icons |
| **Platform** | ChatGPT, Claude, Gemini, etc. | Custom SVG |
| **ACU Types** | Assertion, Code, Explanation, etc. | Custom SVG |
| **Memory Types** | Episodic, Semantic, Procedural, etc. | Custom SVG |

All icons are inline SVG for:
- Zero network requests
- CSS color inheritance via `currentColor`
- Crisp rendering at all DPI levels
- No external asset dependency

---

*This document provides the visual foundation for implementation. All components should be built using Vanilla CSS with CSS custom properties, following these specifications exactly.*

*Final Document: [05-IMPLEMENTATION-ROADMAP.md](./05-IMPLEMENTATION-ROADMAP.md)*
