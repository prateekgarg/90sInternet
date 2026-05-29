// 90s Internet Simulator - Popup Script

const DEFAULT_SITES = [
  { pattern: "wikipedia.org", regex: "^https?://(?:[^/]+\\.)?wikipedia\\.org(?:/|$)", enabled: true },
  { pattern: "news.ycombinator.com", regex: "^https?://(?:[^/]+\\.)?news\\.ycombinator\\.com(?:/|$)", enabled: true },
  { pattern: "reddit.com", regex: "^https?://(?:[^/]+\\.)?reddit\\.com(?:/|$)", enabled: true },
  { pattern: "google.com", regex: "^https?://(?:[^/]+\\.)?google\\.com(?:/|$)", enabled: true },
  { pattern: "localhost", regex: "^https?://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(?:/|$)", enabled: true }
];

const RETRO_QUOTES = [
  "\"Welcome! You've got mail!\" — AOL 4.0",
  "\"Don't pick up the phone! I'm downloading a photo!\" — Mom",
  "\"Estimated time remaining: 23 hours 58 minutes...\" — IE 4.0",
  "\"Best viewed in Netscape Navigator 3.0 at 800x600!\" — Webmaster",
  "\"Surfing the Information Superhighway! 🏄‍♂️\" — 90s Media",
  "\"This site is UNDER CONSTRUCTION 🚧 Please sign our Guestbook!\"",
  "\"Please wait... Loading animated cursor file...\" — Win95",
  "\"AOL Instant Messenger: Welcome, surfer99!\" — AIM",
  "\"Warning: Line noise detected. Modem speed renegotiating...\"",
  "\"Mom! I need to use the internet! Hang up the kitchen phone!\""
];

// Active State
let currentSettings = {};
let selectedSiteIndex = null;
let isAudioPlaying = false;
let hasUnsavedChanges = false;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadSettings();
  initEventListeners();
  rotateQuote();
});

// Windows 95 Tab Switching
function initTabs() {
  const tabs = document.querySelectorAll(".win95-tabs li");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate all
      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
        t.setAttribute("tabindex", "-1");
      });
      panels.forEach(p => p.classList.remove("active"));

      // Activate clicked
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      tab.setAttribute("tabindex", "0");
      
      const panelId = "panel-" + tab.id.substring(4);
      document.getElementById(panelId).classList.add("active");

      // Special action for nostalgia tab
      if (tab.id === "tab-nostalgia") {
        rotateQuote();
      }
    });
  });
}

// Load Settings from Local Storage
function loadSettings() {
  chrome.storage.local.get(null, (settings) => {
    // If empty storage, default it
    if (!settings.siteList) {
      currentSettings = {
        enabled: true,
        speed: "56k",
        soundEnabled: true,
        statusBarEnabled: true,
        siteList: [...DEFAULT_SITES],
        stats: { totalBytes: 0, totalTimeSavedSeconds: 0, connectionCount: 0 }
      };
    } else {
      currentSettings = settings;
    }

    applySettingsToUI();
  });
}

// Apply settings to elements
function applySettingsToUI() {
  // Global Toggle
  document.getElementById("global-enabled").checked = currentSettings.enabled;

  // Connection Speed Radios
  const speedRadios = document.querySelectorAll('input[name="modem-speed"]');
  speedRadios.forEach(radio => {
    if (radio.value === currentSettings.speed) {
      radio.checked = true;
    }
  });

  // Toggles
  document.getElementById("sound-enabled").checked = currentSettings.soundEnabled;
  document.getElementById("statusbar-enabled").checked = currentSettings.statusBarEnabled;

  // Connection Status Panel
  const statusText = document.getElementById("connection-status-text");
  const disconnectBtn = document.getElementById("disconnect-btn");
  if (currentSettings.isConnected) {
    statusText.textContent = "Connected";
    statusText.style.color = "#008000"; // Green!
    disconnectBtn.disabled = false;
  } else {
    statusText.textContent = "Disconnected";
    statusText.style.color = "#ff0000"; // Red!
    disconnectBtn.disabled = true;
  }

  // Web List
  renderSiteList();

  // Stats
  updateStatsDisplay();

  // Reset Unsaved Status
  setChangesSaved();
}

// Render the customizable site list box
function renderSiteList() {
  const listContainer = document.getElementById("site-list-box");
  listContainer.innerHTML = "";
  selectedSiteIndex = null;
  document.getElementById("remove-site-btn").disabled = true;

  currentSettings.siteList.forEach((site, index) => {
    const item = document.createElement("div");
    item.className = "win95-list-item";
    item.dataset.index = index;

    // Checkbox inside list item to toggle site state
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = site.enabled;
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      currentSettings.siteList[index].enabled = checkbox.checked;
      markUnsaved();
    });

    const labelText = document.createElement("span");
    labelText.className = "item-text";
    labelText.textContent = site.pattern;

    const regexPreview = document.createElement("span");
    regexPreview.className = "item-regex";
    regexPreview.textContent = site.regex;
    regexPreview.title = site.regex;

    item.appendChild(checkbox);
    item.appendChild(labelText);
    item.appendChild(regexPreview);

    item.addEventListener("click", () => {
      // Select logic
      document.querySelectorAll(".win95-list-item").forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");
      selectedSiteIndex = index;
      document.getElementById("remove-site-btn").disabled = false;
    });

    listContainer.appendChild(item);
  });
}

// Update stats panel
function updateStatsDisplay() {
  const speed = currentSettings.speed;
  let baudText = "56,600 bps";
  if (speed === "14.4k") baudText = "14,400 bps";
  else if (speed === "28.8k") baudText = "28,800 bps";
  else if (speed === "isdn") baudText = "128,000 bps";
  else if (speed === "dsl") baudText = "512,000 bps";

  document.getElementById("stat-baud").textContent = baudText;

  const stats = currentSettings.stats || { totalBytes: 0, totalTimeSavedSeconds: 0, connectionCount: 0 };
  document.getElementById("stat-connections").textContent = stats.connectionCount || 0;

  // Format Wait Time
  const seconds = stats.totalTimeSavedSeconds || 0;
  if (seconds < 60) {
    document.getElementById("stat-time").textContent = `${seconds}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    document.getElementById("stat-time").textContent = `${minutes}m ${remSeconds}s`;
  }

  // Format bytes
  const bytes = stats.totalBytes || 0;
  if (bytes < 1024) {
    document.getElementById("stat-bytes").textContent = `${bytes} B`;
  } else if (bytes < 1048576) {
    document.getElementById("stat-bytes").textContent = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    document.getElementById("stat-bytes").textContent = `${(bytes / 1048576).toFixed(1)} MB`;
  }
}

// Convert user typed domain to resilient regex
function makeRegexFromDomain(domain) {
  let clean = domain.trim().toLowerCase();
  
  // Strip protocol prefix if typed
  clean = clean.replace(/^https?:\/\//i, "");
  // Strip www. prefix if typed
  clean = clean.replace(/^www\./i, "");
  // Strip trailing slashes
  clean = clean.replace(/\/+$/, "");

  if (!clean) return null;

  // Escape special regex characters except wildcards '*'
  let escaped = clean.replace(/[-\/\\^$+?.()|[\]{}]/g, "\\$&");
  
  // Convert '*' wildcard to matches
  escaped = escaped.replace(/\*/g, ".*");

  // Matches http/https, optional subdomains, specific clean domain, and ends or matches a path slash
  return `^https?://(?:[^/]+\\.)?${escaped}(?::\\d+)?(?:/|$)`;
}

// Mark unsaved changes
function markUnsaved() {
  hasUnsavedChanges = true;
  document.getElementById("btn-apply").disabled = false;
}

// Reset unsaved status
function setChangesSaved() {
  hasUnsavedChanges = false;
  document.getElementById("btn-apply").disabled = true;
}

// Listen to UI changes
function initEventListeners() {
  // Global Toggle
  document.getElementById("global-enabled").addEventListener("change", () => {
    currentSettings.enabled = document.getElementById("global-enabled").checked;
    markUnsaved();
  });

  // Speed Radios
  document.querySelectorAll('input[name="modem-speed"]').forEach(radio => {
    radio.addEventListener("change", () => {
      currentSettings.speed = radio.value;
      updateStatsDisplay();
      markUnsaved();
    });
  });

  // Toggle checks
  document.getElementById("sound-enabled").addEventListener("change", () => {
    currentSettings.soundEnabled = document.getElementById("sound-enabled").checked;
    markUnsaved();
  });

  document.getElementById("statusbar-enabled").addEventListener("change", () => {
    currentSettings.statusBarEnabled = document.getElementById("statusbar-enabled").checked;
    markUnsaved();
  });

  // Add Site Button
  const siteInput = document.getElementById("new-site-input");
  const addBtn = document.getElementById("add-site-btn");
  
  function handleAddSite() {
    const val = siteInput.value.trim();
    if (!val) return;

    // Check duplicate
    const exists = currentSettings.siteList.some(s => s.pattern === val);
    if (exists) {
      alert("This website pattern is already in the list!");
      return;
    }

    const regex = makeRegexFromDomain(val);
    if (!regex) return;

    currentSettings.siteList.push({
      pattern: val,
      regex: regex,
      enabled: true
    });

    siteInput.value = "";
    renderSiteList();
    markUnsaved();
  }

  addBtn.addEventListener("click", handleAddSite);
  siteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddSite();
  });

  // Remove Selected Button
  document.getElementById("remove-site-btn").addEventListener("click", () => {
    if (selectedSiteIndex !== null) {
      currentSettings.siteList.splice(selectedSiteIndex, 1);
      renderSiteList();
      markUnsaved();
    }
  });

  // Reset Defaults Button
  document.getElementById("reset-defaults-btn").addEventListener("click", () => {
    currentSettings.siteList = [...DEFAULT_SITES].map(s => ({ ...s }));
    renderSiteList();
    markUnsaved();
  });

  // Sound testing
  const testSoundBtn = document.getElementById("test-sound-btn");
  const netscapeBadge = document.getElementById("netscape-badge");

  testSoundBtn.addEventListener("click", () => {
    if (!isAudioPlaying) {
      isAudioPlaying = true;
      testSoundBtn.textContent = "Stop Sound";
      netscapeBadge.classList.add("animating");

      // Trigger Web Audio API synthesis
      if (window.dialupSynth) {
        window.dialupSynth.play(() => {
          // Finished playing
          isAudioPlaying = false;
          testSoundBtn.textContent = "Test Dial-up";
          netscapeBadge.classList.remove("animating");
        });
      } else {
        console.error("Dial-up Synthesizer not loaded.");
        isAudioPlaying = false;
        testSoundBtn.textContent = "Test Dial-up";
        netscapeBadge.classList.remove("animating");
      }
    } else {
      isAudioPlaying = false;
      testSoundBtn.textContent = "Test Dial-up";
      netscapeBadge.classList.remove("animating");
      if (window.dialupSynth) {
        window.dialupSynth.stop();
      }
    }
  });

  // Dialog Button Footer Actions
  document.getElementById("btn-apply").addEventListener("click", () => {
    saveSettingsToStorage();
  });

  document.getElementById("btn-ok").addEventListener("click", () => {
    saveSettingsToStorage(() => {
      window.close(); // Close extension popup
    });
  });

  document.getElementById("btn-cancel").addEventListener("click", () => {
    window.close();
  });

  // Close bar buttons
  document.getElementById("btn-close").addEventListener("click", () => {
    window.close();
  });
  document.getElementById("btn-minimize").addEventListener("click", () => {
    window.close();
  });
  document.getElementById("btn-maximize").addEventListener("click", () => {
    alert("Simulator Window Maximized! (Well, not really. This is a dialog, retro surfer!)");
  });

  // Disconnect button
  document.getElementById("disconnect-btn").addEventListener("click", () => {
    currentSettings.isConnected = false;
    chrome.storage.local.set({ isConnected: false }, () => {
      applySettingsToUI();
      console.log("90s Internet Simulator: Disconnected from dial-up ISP.");
    });
  });
}

// Save Settings to Storage
function saveSettingsToStorage(callback) {
  chrome.storage.local.set(currentSettings, () => {
    setChangesSaved();
    console.log("90s Internet Simulator: Settings saved.");
    if (callback) callback();
  });
}

// Randomize quotes in terminal box
function rotateQuote() {
  const quoteBox = document.getElementById("quote-box");
  const index = Math.floor(Math.random() * RETRO_QUOTES.length);
  quoteBox.textContent = RETRO_QUOTES[index];
}
