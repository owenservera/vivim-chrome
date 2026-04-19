# ChatGPT Streaming Study - Enhanced with Trigger Button and File Storage

## New Features Added ✅

### 1. Streaming Test Trigger Button
**Location:** `debug-dashboard.html`
- **"Run Streaming Tests"** button in the action buttons section
- Triggers automated test scenarios from the background script
- Tests include: simple prompts, complex prompts, tool-using prompts, title generation, empty responses, and array patch format
- Results displayed in alert dialog with pass/fail counts
- Refreshes dashboard data automatically after test completion

### 2. Enhanced File Storage System
**Primary Storage:** Chrome Storage (`chrome.storage.local`)
- **Session Keys:** `chatgpt-study-{sessionId}` (raw data)
- **Analysis Keys:** `study-analysis-{sessionId}` (processed data)
- Persistent across browser sessions
- Automatic buffering and flushing to prevent memory issues

**Secondary Storage:** Project Directory
- **Directory:** `study-data/` (created automatically)
- **Raw Files:** `chatgpt-study-{sessionId}.json`
- **Analysis Files:** `chatgpt-study-analysis-{sessionId}.json`
- **Documentation:** `study-data/README.md`

### 3. Data Management Buttons
**Location:** Debug Dashboard
- **"Export Study Data"** - Downloads complete analysis JSON to Downloads folder
- **"Clear Study Data"** - Removes all study sessions from storage (with confirmation)
- **"Run Streaming Tests"** - Executes test scenarios and shows results

### 4. Improved Storage Information Display
**Location:** Debug Dashboard → Storage Info Section
- Clear explanation of storage locations
- Multiple access methods with step-by-step instructions
- Current session information display
- File path references for development access

## File Locations

### Raw Data Files
```
C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\study-data\
├── chatgpt-study-{sessionId}.json          # Raw session data
├── chatgpt-study-analysis-{sessionId}.json # Analysis exports
└── README.md                               # Access documentation
```

### Chrome Storage Keys
- `chatgpt-study-{sessionId}` - Raw session data
- `study-analysis-{sessionId}` - Processed analysis data
- `chatgpt-study-file-{sessionId}` - File metadata

## How to Use the New Features

### Running Streaming Tests
1. Open `debug-dashboard.html` in your browser
2. Click **"Run Streaming Tests"** button
3. Wait for test completion (shows "Running Tests..." during execution)
4. Review results in the alert dialog
5. Dashboard automatically refreshes with new data

### Accessing Raw Files

#### Method 1: Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to **Application → Storage → Local Storage**
3. Find keys starting with `chatgpt-study-`
4. Copy JSON values and save to files

#### Method 2: Export Button
1. Click **"Export Study Data"** in the dashboard
2. Files download automatically to your Downloads folder
3. Files include complete analysis with insights

#### Method 3: Direct File Access
1. Navigate to `study-data/` directory in the project
2. Open JSON files directly for analysis
3. Use the README.md for guidance

### Managing Study Data
- **View Current Session:** Shows in the storage info section
- **Export Data:** Downloads comprehensive analysis files
- **Clear Data:** Removes all study sessions (irreversible)
- **Auto-Refresh:** Dashboard updates every 5 seconds

## Technical Implementation

### Background Script Integration
**File:** `src/background/index.js`
- Added `runChatGPTTests` message handler
- Dynamically imports test scenarios
- Returns test results with pass/fail counts
- Handles errors gracefully

### Enhanced Study Class
**File:** `src/providers/chatgpt/ChatGPTDataFeedStudy.js`
- `saveToStudyDirectory()` - Saves file metadata to Chrome storage
- `saveAnalysisFile()` - Creates downloadable analysis files
- Improved export functionality with multiple storage methods

### Dashboard Enhancements
**File:** `debug-dashboard.html`
- New action buttons with loading states
- Enhanced storage information display
- Session information tracking
- Multiple access method documentation

## Benefits

### For Debugging
- **Automated Testing:** Run comprehensive test scenarios with one click
- **Immediate Feedback:** See test results instantly
- **Data Export:** Access raw data in multiple formats

### For Development
- **File-Based Access:** Direct access to JSON files in project directory
- **Chrome Storage:** Persistent data across browser sessions
- **Clear Documentation:** Step-by-step access instructions

### For Analysis
- **Multiple Export Formats:** JSON downloads and Chrome storage access
- **Comprehensive Data:** Raw events, parsing attempts, errors, and insights
- **Real-Time Monitoring:** Live dashboard updates

## Next Steps

1. **Load the Extension:** Build and load the updated extension
2. **Open Debug Dashboard:** Navigate to `debug-dashboard.html`
3. **Run Tests:** Click "Run Streaming Tests" to validate functionality
4. **Interact with ChatGPT:** Send prompts to collect real streaming data
5. **Analyze Results:** Export and examine the collected data
6. **Fix Issues:** Use insights to identify and resolve streaming problems

The study system now provides comprehensive data collection and analysis capabilities with easy-to-use controls for triggering tests and accessing raw files.