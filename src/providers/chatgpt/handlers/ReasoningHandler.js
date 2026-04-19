/**
 * ReasoningHandler - o-series model reasoning summaries
 */

export class ReasoningHandler {
  constructor() {
    this.rawReasoning = '';
    this.summaryParts = [];
    this.isEnabled = false;
  }
  
  enable() {
    this.isEnabled = true;
  }
  
  disable() {
    this.isEnabled = false;
  }
  
  handleSummaryPartAdded(event) {
    if (!this.isEnabled) return null;
    const idx = event.summary_index;
    this.summaryParts[idx] = {
      text: event.text || '',
      status: 'in_progress'
    };
    return { summary_index: idx, status: 'added' };
  }
  
  handleSummaryPartDone(event) {
    if (!this.isEnabled) return null;
    const idx = event.summary_index;
    if (this.summaryParts[idx]) {
      this.summaryParts[idx].text = event.text;
      this.summaryParts[idx].status = 'completed';
    }
    return { summary_index: idx, status: 'done', text: event.text };
  }
  
  handleSummaryTextDelta(event) {
    if (!this.isEnabled) return null;
    this.rawReasoning += event.delta;
    return { delta: event.delta, cumulative: this.rawReasoning };
  }
  
  handleSummaryTextDone(event) {
    if (!this.isEnabled) return null;
    return { text: event.text, isFinal: true };
  }
  
  handleRawTextDelta(event) {
    this.rawReasoning += event.delta;
    return { delta: event.delta, isRaw: true };
  }
  
  handleRawTextDone(event) {
    return { text: event.text, isFinal: true, isRaw: true };
  }
  
  getReasoning() {
    return {
      raw: this.rawReasoning,
      summary: this.summaryParts.filter(Boolean)
    };
  }
  
  reset() {
    this.rawReasoning = '';
    this.summaryParts = [];
  }
}

export default ReasoningHandler;