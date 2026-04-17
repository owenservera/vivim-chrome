# Product Requirements Document (PRD): Core Streaming & Agentic UX (2026)

## 1. Product Overview
In 2026, AI interaction has moved from "Chat" to "Co-Execution". This PRD defines the shared UI/UX standards for all providers in the Vivim extension, focusing on transparency, trust, and shared control during autonomous workflows.

## 2. Shared User Personas
- **The Delegator:** Users who give high-level goals and expect the AI to execute sub-tasks autonomously.
- **The Auditor:** Users who want to monitor every step of the AI's reasoning and tool usage to ensure accuracy.

## 3. Core UX Features (2026 Standards)
### 3.1. Intent Previews (The "Plan" UI)
- **Goal:** Prevent "Black Box" execution by showing the user what the AI is about to do.
- **Requirement:** Before taking an autonomous action (e.g., browser navigation, API call), display a "Plan" component.
- **Requirement:** Allow users to "Edit" or "Cancel" specific steps in the plan before execution begins.

### 3.2. Agentic Progress Tracker
- **Goal:** Provide a real-time status of multi-step tasks.
- **Requirement:** A dynamic, non-linear progress bar that shows sub-tasks (e.g., `Searching` -> `Filtering` -> `Drafting`).
- **Requirement:** Each step must show the specific tool being used (e.g., `Browsing chatgpt.com`, `Calling Google Search API`).

### 3.3. Human-in-the-Loop (HITL) Checkpoints
- **Goal:** Ensure safety for high-stakes actions.
- **Requirement:** The UI must be able to "Pause" the stream and present an "Approval Dialog" for sensitive actions (e.g., deleting data, sending emails).
- **Requirement:** Support "Contextual Feedback" where the user can clarify a specific step mid-stream.

## 4. Technical Requirements (UI Bridge)
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :--- |
| TR-1 | **Lifecycle Events** | The bridge must support `streamStarted`, `planProposed`, `stepStarted`, `stepCompleted`, and `streamFinished` events. | P0 |
| TR-2 | **Tool Usage Interception** | Capture and relay tool call metadata (name, arguments, status) to the UI. | P1 |
| TR-3 | **Reasoning Overlay** | Support a standardized "Reasoning Trace" format for all providers (ChatGPT thoughts, Claude thinking, Gemini scratchpad). | P1 |

## 5. UI/UX Guidelines
- **Motion & Feedback:** Use "Fluid" animations to represent active thinking and "Snappy" transitions for completed tasks.
- **Consistency:** Use a unified icon set for common tools (Browser, Search, File, Email) across all providers.
- **Error Transparency:** If an agentic loop fails, show exactly which step failed and provide the raw error message to the user.

## 6. Success Metrics
- **Plan Approval Rate:** % of plans approved by the user without modification.
- **User Trust Score:** Qualitative metric based on post-session feedback regarding AI transparency.
- **Intervention Rate:** Frequency of users manually stopping or correcting the AI during a multi-step task.
