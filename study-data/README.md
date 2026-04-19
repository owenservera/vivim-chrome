# ChatGPT Streaming Study Data Directory

This directory contains raw data files from the ChatGPT streaming study system.

## File Storage Overview

### Primary Storage Location
- **Chrome Storage**: `chrome.storage.local` (persistent across browser sessions)
- **Session Keys**: `chatgpt-study-{sessionId}`
- **Analysis Keys**: `study-analysis-{sessionId}`

### Secondary Storage (Development)
- **Directory**: `study-data/` (created automatically)
- **Raw Files**: `chatgpt-study-{sessionId}.json`
- **Analysis Files**: `chatgpt-study-analysis-{sessionId}.json`

## How to Access Raw Files

### Method 1: Chrome DevTools (Recommended)
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Go to **Application** tab
3. Navigate to **Storage → Local Storage**
4. Find keys starting with:
   - `chatgpt-study-` (raw session data)
   - `study-analysis-` (processed analysis data)
5. Copy the JSON values and save to files for external analysis

### Method 2: Debug Dashboard Export
1. Open `debug-dashboard.html` in your browser
2. Click **"Export Study Data"** button
3. Files are automatically downloaded to your **Downloads** folder

### Method 3: Programmatic Access
```javascript
// Get all study data from Chrome storage
chrome.storage.local.get(null).then(storage => {
  const studyKeys = Object.keys(storage).filter(key =>
    key.startsWith('chatgpt-study-') || key.startsWith('study-analysis-')
  );

  studyKeys.forEach(key => {
    const data = storage[key];
    console.log(`Study Data ${key}:`, data);
    // Save to file or process as needed
  });
});
```

## File Structure

### Raw Session Data (`chatgpt-study-{sessionId}`)
```json
{
  "study": {
    "sessionId": "chatgpt-study-1234567890-abc123",
    "startTime": 1640995200000,
    "endTime": 1640995260000,
    "duration": 60000,
    "metadata": {
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-04-19T11:32:00.000Z",
      "extensionVersion": "2.0.0"
    }
  },
  "networkEvents": [...],
  "parsingEvents": [...],
  "uiEvents": [...],
  "errors": [...]
}
```

### Analysis Data (`chatgpt-study-analysis-{sessionId}`)
```json
{
  "study": {...},
  "summary": {
    "totalStreams": 5,
    "networkEvents": 25,
    "parsingEvents": 45,
    "uiEvents": 20,
    "errors": 2,
    "streaming": {
      "emptyChunks": 0,
      "avgContentLength": 156.8
    },
    "parsing": {
      "parseSuccessRate": 95.2
    }
  },
  "insights": [...],
  "rawData": {...}
}
```

## Data Categories

### Network Events
- Raw HTTP request/response data
- Headers, status codes, content types
- Timestamps and durations

### Parsing Events
- JSON parsing attempts and success/failure
- SSE event processing
- Delta patch operations
- Array vs object payload handling

### UI Events
- Chunk emissions to the interface
- Content validation
- Bubble rendering data

### Errors
- Parsing failures
- Network errors
- Processing exceptions
- Context and stack traces

## Analysis Tools

### Debug Dashboard
- Real-time visualization at `debug-dashboard.html`
- Interactive filtering and timeline
- Automatic insights generation
- Export functionality

### Manual Analysis
1. Export JSON files using the dashboard
2. Import into analysis tools (Excel, Python pandas, etc.)
3. Look for patterns in:
   - Empty chunks (potential parsing issues)
   - Parse failures (JSON format problems)
   - Network errors (connection issues)
   - Delta processing failures (patch format issues)

## Troubleshooting

### No Data Appearing
- Ensure the extension is loaded and active
- Check that ChatGPT interactions are happening
- Verify the study system is enabled in the provider

### Data Not Exporting
- Check browser download permissions
- Ensure sufficient disk space
- Try Chrome DevTools method instead

### Performance Issues
- The study system buffers data to prevent memory issues
- Large sessions may impact browser performance
- Clear old data using the dashboard's "Clear Study Data" button

## Contact
For issues with the study system, check the extension logs in Chrome DevTools Console.