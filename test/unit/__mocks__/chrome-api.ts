/**
 * Chrome API Mock for Unit Testing
 * 
 * This file provides comprehensive mocks for Chrome extension APIs,
 * allowing unit tests to run in a browser-like environment without Chrome.
 */

import { jest } from '@jest/globals';

// ============================================================================
// Mock Classes
// ============================================================================

class MockChromeTabs {
  static query = jest.fn().mockResolvedValue([
    { 
      id: 1, 
      active: true, 
      currentWindow: true, 
      url: 'https://chat.openai.com/',
      title: 'ChatGPT'
    }
  ]);
  
  static get = jest.fn().mockResolvedValue({ 
    id: 1, 
    active: true, 
    currentWindow: true, 
    url: 'https://chat.openai.com/',
    title: 'ChatGPT'
  });
  
  static create = jest.fn().mockResolvedValue({ id: 2 });
  
  static update = jest.fn().mockResolvedValue({ id: 1 });
  
  static remove = jest.fn().mockResolvedValue({});
}

class MockChromeRuntime {
  static lastError: Error | null = null;
  
  static id = 'mock-extension-id';
  
  static sendMessage = jest.fn().mockImplementation((message: unknown) => {
    return Promise.resolve({ success: true, ...message as object });
  });
  
  static sendNativeMessage = jest.fn().mockResolvedValue({ success: true });
  
  static connect = jest.fn().mockReturnValue({
    postMessage: jest.fn(),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
  });
  
  static onMessage = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  
  static onConnect = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  
  static onInstalledDetails = {
    reason: 'install',
    previousVersion: undefined,
  };
  
  static getManifest = jest.fn().mockReturnValue({
    manifest_version: 3,
    name: 'VIVIM',
    version: '2.0.0',
    description: 'VIVIM Chrome Extension',
    permissions: ['tabs', 'storage', 'activeTab'],
    host_permissions: ['https://*.openai.com/*', 'https://*.anthropic.ai/*'],
  });
  
  static getURL = jest.fn().mockImplementation((path: string) => {
    return `chrome-extension://mock-extension-id/${path}`;
  });
  
  static getPlatformInfo = jest.fn().mockResolvedValue({
    os: 'mac',
    arch: 'arm64',
    nacl_arch: 'arm64',
  });
  
  static reload = jest.fn();
  
  static requestUpdateCheck = jest.fn().mockResolvedValue({
    response: 'no_update',
  });
}

class MockChromeStorage {
  static local = {
    get: jest.fn().mockResolvedValue({}),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getBytesInUse: jest.fn().mockResolvedValue(0),
  };
  
  static sync = {
    get: jest.fn().mockResolvedValue({}),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getBytesInUse: jest.fn().mockResolvedValue(0),
  };
  
  static session = {
    get: jest.fn().mockResolvedValue({}),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getBytesInUse: jest.fn().mockResolvedValue(0),
  };
  
  static onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeMessaging {
  static getContexts = jest.fn().mockResolvedValue([]);
  static getServiceWorker = jest.fn().mockResolvedValue(undefined);
}

class MockChromeCookies {
  static get = jest.fn().mockResolvedValue(null);
  static getAll = jest.fn().mockResolvedValue([]);
  static set = jest.fn().mockResolvedValue({});
  static remove = jest.fn().mockResolvedValue({});
  static onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeWebNavigation {
  static getAllFrames = jest.fn().mockResolvedValue([]);
  static getFrame = jest.fn().mockResolvedValue(null);
  static onCompleted = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onCreatedNavigationTarget = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeWebRequest {
  static onBeforeRequest = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onCompleted = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onErrorOccurred = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeI18n {
  static getMessage = jest.fn().mockImplementation((messageName: string, substitutions?: unknown) => {
    return substitutions || messageName;
  });
  static getAcceptLanguages = jest.fn().mockResolvedValue(['en-US', 'en']);
}

class MockChromeAlarm {
  static create = jest.fn();
  static get = jest.fn().mockResolvedValue(null);
  static getAll = jest.fn().mockResolvedValue([]);
  static clear = jest.fn().mockResolvedValue(true);
  static onAlarm = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeContextMenus {
  static create = jest.fn().mockReturnValue('mock-menu-id');
  static update = jest.fn().mockResolvedValue(true);
  static remove = jest.fn().mockResolvedValue(true);
  static removeAll = jest.fn().mockResolvedValue(undefined);
  static onClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeCommands {
  static getAll = jest.fn().mockResolvedValue([]);
  static onCommand = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeNotifications {
  static create = jest.fn().mockReturnValue('mock-notification-id');
  static update = jest.fn().mockResolvedValue(true);
  static clear = jest.fn().mockResolvedValue(true);
  static onClosed = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onButtonClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeDownloads {
  static download = jest.fn().mockResolvedValue(1);
  static search = jest.fn().mockResolvedValue([]);
  static pause = jest.fn().mockResolvedValue(true);
  static resume = jest.fn().mockResolvedValue(true);
  static cancel = jest.fn().mockResolvedValue(true);
  static erase = jest.fn().mockResolvedValue([]);
  static show = jest.fn().mockResolvedValue(undefined);
  static showDefaultFolder = jest.fn().mockResolvedValue(undefined);
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onErased = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeTts {
  static speak = jest.fn();
  static stop = jest.fn();
  static pause = jest.fn();
  static resume = jest.fn();
  static getVoices = jest.fn().mockResolvedValue([]);
  static onEvent = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeTtsEngine {
  static speak = jest.fn();
  static stop = jest.fn();
  static onSpeak = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onPause = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onResume = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onCancel = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onDone = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onError = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeIdle {
  static queryState = jest.fn().mockResolvedValue('active');
  static setDetectionInterval = jest.fn();
  static onStateChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromePermissions {
  static getAll = jest.fn().mockResolvedValue({ origins: [], permissions: [] });
  static contains = jest.fn().mockResolvedValue(false);
  static request = jest.fn().mockResolvedValue(false);
  static remove = jest.fn().mockResolvedValue(false);
}

class MockChromeManagement {
  static getAll = jest.fn().mockResolvedValue([]);
  static get = jest.fn().mockResolvedValue(null);
  static getSelf = jest.fn().mockResolvedValue({
    id: 'mock-extension-id',
    name: 'VIVIM',
    version: '2.0.0',
  });
  static uninstall = jest.fn().mockResolvedValue(true);
  static enable = jest.fn().mockResolvedValue(true);
  static disable = jest.fn().mockResolvedValue(true);
  static onInstalled = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onUninstalled = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onEnabled = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onDisabled = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeDeclarativeContent {
  static onPageChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addRules: jest.fn(),
    getRules: jest.fn().mockResolvedValue([]),
  };
}

class MockChromeScripts {
  static executeScript = jest.fn().mockResolvedValue([{ frameId: 0 }]);
  static insertCSS = jest.fn().mockResolvedValue([{ frameId: 0 }]);
  static removeCSS = jest.fn().mockResolvedValue([{ frameId: 0 }]);
  static register = jest.fn().mockResolvedValue(undefined);
  static unregister = jest.fn().mockResolvedValue(undefined);
  static getRegistered = jest.fn().mockResolvedValue([]);
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeBookmarks {
  static create = jest.fn().mockResolvedValue({ id: 'folder' });
  static get = jest.fn().mockResolvedValue([]);
  static getChildren = jest.fn().mockResolvedValue([]);
  static getTree = jest.fn().mockResolvedValue([]);
  static getRecent = jest.fn().mockResolvedValue([]);
  static search = jest.fn().mockResolvedValue([]);
  static update = jest.fn().mockResolvedValue({ id: 'folder' });
  static move = jest.fn().mockResolvedValue({ id: 'folder' });
  static remove = jest.fn().mockResolvedValue(undefined);
  static removeTree = jest.fn().mockResolvedValue(undefined);
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onMoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onRemoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeHistory {
  static search = jest.fn().mockResolvedValue([]);
  static getVisits = jest.fn().mockResolvedValue([]);
  static addUrl = jest.fn().mockResolvedValue(undefined);
  static deleteAll = jest.fn().mockResolvedValue(undefined);
  static deleteRange = jest.fn().mockResolvedValue(undefined);
  static deleteUrl = jest.fn().mockResolvedValue(undefined);
  static onVisited = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onVisitRemoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeStorageAccess {
  static get = jest.fn().mockResolvedValue({});
  static set = jest.fn().mockResolvedValue(undefined);
  static getBytesInUse = jest.fn().mockResolvedValue(0);
  static onRequest = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeContentSettings {
  static get = jest.fn().mockResolvedValue({ setting: 'allow' });
  static set = jest.fn().mockResolvedValue(undefined);
  static getResourceIdentifiers = jest.fn().mockResolvedValue([]);
  static clear = jest.fn().mockResolvedValue(undefined);
  static onChange = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeProxy {
  static settings = {
    get: jest.fn().mockResolvedValue({ value: { mode: 'system' } }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  static onProxy = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeTabCapture {
  static capture = jest.fn().mockResolvedValue('data:image/png;base64,mock');
  static getCapturedTabs = jest.fn().mockResolvedValue([]);
  static onCaptured = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeTopSites {
  static get = jest.fn().mockResolvedValue([]);
  static onVisited = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onMostVisited = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeTabGroups {
  static get = jest.fn().mockResolvedValue(null);
  static getAll = jest.fn().mockResolvedValue([]);
  static update = jest.fn().mockResolvedValue({});
  static group = jest.fn().mockResolvedValue(1);
  static ungroup = jest.fn().mockResolvedValue(undefined);
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onUpdated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onMoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onRemoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeSearch {
  static search = jest.fn().mockResolvedValue([]);
  static loseFocus = jest.fn().mockResolvedValue(undefined);
  static onSearch = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeAction {
  static setTitle = jest.fn();
  static setIcon = jest.fn();
  static setPopup = jest.fn();
  static setBadgeText = jest.fn();
  static setBadgeBackgroundColor = jest.fn();
  static getTitle = jest.fn().mockResolvedValue({ title: 'Test' });
  static getIcon = jest.fn().mockResolvedValue({ iconUrl: undefined });
  static getPopup = jest.fn().mockResolvedValue({ popup: '' });
  static getBadgeText = jest.fn().mockResolvedValue({ text: '' });
  static getBadgeBackgroundColor = jest.fn().mockResolvedValue({ color: '#fff' });
  static openPopup = jest.fn().mockResolvedValue(undefined);
  static onClicked = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeSidePanel {
  static setOptions = jest.fn();
  static setPanelBehavior = jest.fn();
  static getOptions = jest.fn().mockResolvedValue({});
  static getPanelBehavior = jest.fn().mockResolvedValue({});
  static onShown = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onHidden = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeDebugger {
  static attach = jest.fn().mockResolvedValue(undefined);
  static detach = jest.fn().mockResolvedValue(undefined);
  static isAttached = jest.fn().mockResolvedValue(false);
  static sendCommand = jest.fn().mockResolvedValue({});
  static sendAsyncCommand = jest.fn();
  static getTargets = jest.fn().mockResolvedValue([]);
  static onAttached = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onDetached = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onEvent = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeDebuggerTargets {
  static onTargetCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onTargetDestroyed = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onTargetInfoChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeAccessibilityFeatures {
  static get = jest.fn().mockResolvedValue({});
  static set = jest.fn().mockResolvedValue(undefined);
  static onChange = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeActionService {
  static getIcons = jest.fn().mockResolvedValue({});
  static getActions = jest.fn().mockResolvedValue([]);
  static getAll = jest.fn().mockResolvedValue([]);
  static set = jest.fn().mockResolvedValue(undefined);
  static setDefault = jest.fn().mockResolvedValue(undefined);
  static clear = jest.fn().mockResolvedValue(undefined);
}

class MockChromeAutosave {
  static getSettings = jest.fn().mockResolvedValue({});
  static setSettings = jest.fn().mockResolvedValue(undefined);
  static getBookmarks = jest.fn().mockResolvedValue([]);
  static getHistory = jest.fn().mockResolvedValue([]);
}

class MockChromeBraveAds {
  static getAdsEnabled = jest.fn().mockResolvedValue(false);
  static getAdsPerHour = jest.fn().mockResolvedValue(0);
  static getAdsPerDay = jest.fn().mockResolvedValue(0);
  static setAdsEnabled = jest.fn();
  static setAdsPerHour = jest.fn();
  static setAdsPerDay = jest.fn();
}

class MockChromeBraveRewards {
  static getPublisherData = jest.fn().mockResolvedValue({});
  static setPublisherData = jest.fn();
  static getWallet = jest.fn().mockResolvedValue({ status: 0 });
  static getBalance = jest.fn().mockResolvedValue({ balance: 0 });
  static getAcInfo = jest.fn().mockResolvedValue({});
}

class MockChromeGcm {
  static register = jest.fn().mockResolvedValue(['senderId']);
  static unregister = jest.fn().mockResolvedValue(undefined);
  static send = jest.fn().mockResolvedValue(undefined);
  static onMessage = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onMessagesDeleted = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onMessageError = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeIdentity {
  static getProfileUserInfo = jest.fn().mockResolvedValue({ email: '', id: '' });
  static getAuthToken = jest.fn().mockResolvedValue({ token: 'mock_token' });
  static getProfileUserInfoPlus = jest.fn().mockResolvedValue({ email: '', id: '', domain: '' });
  static removeCachedAuthToken = jest.fn();
  static launchWebAuthFlow = jest.fn().mockResolvedValue('url');
  static createAccountId = jest.fn().mockResolvedValue('account');
  static getListAccounts = jest.fn().mockResolvedValue([]);
  static getAccount = jest.fn().mockResolvedValue(null);
  static getAccountUserInfo = jest.fn().mockResolvedValue({ email: '' });
  static onSignInChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeInput {
  static ime = {
    activate: jest.fn(),
    deactivate: jest.fn(),
    showWindow: jest.fn(),
    hideWindow: jest.fn(),
    setComposition: jest.fn(),
    clearComposition: jest.fn(),
    setCandidateSelection: jest.fn(),
    clearCandidateSelection: jest.fn(),
    commitText: jest.fn(),
    sendKeyEvents: jest.fn(),
    deliverVisualFeedback: jest.fn(),
    onActiveEntry: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onCandidateClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onComposing: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onInput: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onKeyDown: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onMenuItemActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onSurroundingTextChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
}

class MockChromeLoginState {
  static getSessionState = jest.fn().mockResolvedValue('active');
  static onSessionStateChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromePrinterProvider {
  static getPrinters = jest.fn().mockResolvedValue([]);
  static getCapability = jest.fn().mockResolvedValue({});
  static onPrinterSelected = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onPrinterInfoChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeSession {
  static get = jest.fn().mockResolvedValue([]);
  static getMaxGlobalMemoryUsage = jest.fn().mockResolvedValue(0);
  static getAvgMemoryUsage = jest.fn().mockResolvedValue({ avg_memory_usage: 0 });
  static setMaxGlobalMemoryUsage = jest.fn();
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onBoundsChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeSessions {
  static getDevices = jest.fn().mockResolvedValue([]);
  static getRecentlyClosed = jest.fn().mockResolvedValue([]);
  static restore = jest.fn().mockResolvedValue(undefined);
  static getDeviceId = jest.fn().mockResolvedValue('device');
  static setDeviceId = jest.fn();
  static onDeviceAdded = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onDeviceRemoved = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onSessionCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onSessionRendered = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeSoftNets {
  static getHardNets = jest.fn().mockResolvedValue({});
  static setHardNets = jest.fn();
  static clearHardNets = jest.fn();
}

class MockChromeSystem {
  static cpu = {
    getInfo: jest.fn().mockResolvedValue({}),
    getProcessors: jest.fn().mockResolvedValue([]),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
  
  static memory = {
    getInfo: jest.fn().mockResolvedValue({}),
  };
  
  static storage = {
    getInfo: jest.fn().mockResolvedValue({}),
    onAttached: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onDetached: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
  
  static display = {
    getInfo: jest.fn().mockResolvedValue([]),
    onDisplayAdded: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onDisplayRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onDisplayChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
  
  static power = {
    requestKeepAwake: jest.fn(),
    getStatus: jest.fn().mockResolvedValue({ status: 'unknown' }),
  };
  
  static keyboard = {
    getLayouts: jest.fn().mockResolvedValue([]),
    onKeyboardLayoutChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
  
  static pointer = {
    getMostRecentPointers: jest.fn().mockResolvedValue([]),
    onPointerTypeChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };
}

class MockChromeTtsVoice {
  static get = jest.fn().mockResolvedValue({ voices: [] });
  static getAll = jest.fn().mockResolvedValue({ voices: [] });
}

class MockChromeVirtualKeyboard {
  static show = jest.fn();
  static hide = jest.fn();
  static isShown = jest.fn().mockResolvedValue(false);
  static bounds = {
    set: jest.fn(),
    get: jest.fn().mockResolvedValue({}),
  };
  static onBoundsChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onClassicVersion = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onVisible = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeWallpaper {
  static set = jest.fn().mockResolvedValue(undefined);
  static onWallpaperChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

class MockChromeWindow {
  static create = jest.fn().mockResolvedValue({ id: 1 });
  static get = jest.fn().mockResolvedValue({ id: 1, focused: true });
  static getAll = jest.fn().mockResolvedValue([{ id: 1, focused: true }]);
  static update = jest.fn().mockResolvedValue({ id: 1 });
  static remove = jest.fn().mockResolvedValue(undefined);
  static onCreated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onFocusChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  static onBoundsChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

// ============================================================================
// Build Complete chrome Object
// ============================================================================

const chrome = {
  tabs: MockChromeTabs,
  runtime: MockChromeRuntime,
  storage: MockChromeStorage,
  messaging: MockChromeMessaging,
  cookies: MockChromeCookies,
  webNavigation: MockChromeWebNavigation,
  webRequest: MockChromeWebRequest,
  i18n: MockChromeI18n,
  alarm: MockChromeAlarm,
  contextMenus: MockChromeContextMenus,
  commands: MockChromeCommands,
  notifications: MockChromeNotifications,
  downloads: MockChromeDownloads,
  tts: MockChromeTts,
  ttsEngine: MockChromeTtsEngine,
  idle: MockChromeIdle,
  permissions: MockChromePermissions,
  management: MockChromeManagement,
  declarativeContent: MockChromeDeclarativeContent,
  scripts: MockChromeScripts,
  bookmarks: MockChromeBookmarks,
  history: MockChromeHistory,
  storageAccess: MockChromeStorageAccess,
  contentSettings: MockChromeContentSettings,
  proxy: MockChromeProxy,
  tabCapture: MockChromeTabCapture,
  topSites: MockChromeTopSites,
  tabGroups: MockChromeTabGroups,
  search: MockChromeSearch,
  action: MockChromeAction,
  sidePanel: MockChromeSidePanel,
  debugger: MockChromeDebugger,
  debuggerTargets: MockChromeDebuggerTargets,
  accessibilityFeatures: MockChromeAccessibilityFeatures,
  automation: MockChromeActionService,
  autosave: MockChromeAutosave,
  braveAds: MockChromeBraveAds,
  braveRewards: MockChromeBraveRewards,
  gcm: MockChromeGcm,
  identity: MockChromeIdentity,
  input: MockChromeInput,
  loginState: MockChromeLoginState,
  printerProvider: MockChromePrinterProvider,
  session: MockChromeSession,
  sessions: MockChromeSessions,
  softNets: MockChromeSoftNets,
  system: MockChromeSystem,
  ttsVoice: MockChromeTtsVoice,
  virtualKeyboard: MockChromeVirtualKeyboard,
  wallpaper: MockChromeWallpaper,
  windows: MockChromeWindow,
};

// ============================================================================
// Make Global
// ============================================================================

(global as any).chrome = chrome;
(global as any).chrome.runtime.sendMessage = MockChromeRuntime.sendMessage;
(global as any).chrome.runtime.onMessage = MockChromeRuntime.onMessage;
(global as any).chrome.storage = MockChromeStorage;
(global as any).chrome.tabs = MockChromeTabs;

// Mock console for tests
(global.console as any) = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn(),
  table: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
  trace: jest.fn(),
  assert: jest.fn(),
  clear: jest.fn(),
  count: jest.fn(),
  countReset: jest.fn(),
  dir: jest.fn(),
  dirxml: jest.fn(),
};

// Export for direct import
export { chrome };
export default chrome;