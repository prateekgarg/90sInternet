// 90s Internet Simulator - Background Script

const DEFAULT_SITES = [
  {
    pattern: "wikipedia.org",
    regex: "^https?://(?:[^/]+\\.)?wikipedia\\.org(?:/|$)",
    enabled: true
  },
  {
    pattern: "news.ycombinator.com",
    regex: "^https?://(?:[^/]+\\.)?news\\.ycombinator\\.com(?:/|$)",
    enabled: true
  },
  {
    pattern: "reddit.com",
    regex: "^https?://(?:[^/]+\\.)?reddit\\.com(?:/|$)",
    enabled: true
  },
  {
    pattern: "google.com",
    regex: "^https?://(?:[^/]+\\.)?google\\.com(?:/|$)",
    enabled: true
  },
  {
    pattern: "localhost",
    regex: "^https?://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(?:/|$)",
    enabled: true
  }
];

const DEFAULT_SETTINGS = {
  enabled: true,
  isConnected: false, // global session connection status
  speed: "56k", // options: '14.4k', '28.8k', '56k', 'isdn', 'dsl'
  soundEnabled: true,
  statusBarEnabled: true,
  siteList: DEFAULT_SITES,
  stats: {
    totalBytes: 0,
    totalTimeSavedSeconds: 0,
    connectionCount: 0
  }
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set(DEFAULT_SETTINGS, () => {
      console.log("90s Internet Simulator: Default settings initialized.");
    });
  }
});

// Reset connection state when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ isConnected: false });
});

