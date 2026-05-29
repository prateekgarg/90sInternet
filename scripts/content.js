// 90s Internet Simulator - Content Script

(function () {
  // 1. Immediate Render Interception at document_start
  const hideStyle = document.createElement("style");
  hideStyle.id = "retro-hide-style";
  hideStyle.innerHTML = "html { visibility: hidden !important; background-color: #008080 !important; }";
  document.documentElement.appendChild(hideStyle);

  let settings = null;
  let isMatched = false;
  let revealIntervalId = null;
  let activeImageIntervals = [];
  let simulatedBytesTransferred = 0;
  let simulatedLoadTimeSeconds = 0;

  // Connection Speed Constants
  const SPEED_CONFIGS = {
    "14.4k": { bytesPerSec: 1800, pxPerSec: 150, label: "14,400 bps" },
    "28.8k": { bytesPerSec: 3600, pxPerSec: 350, label: "28,800 bps" },
    "56k":   { bytesPerSec: 7000, pxPerSec: 700, label: "56,600 bps" },
    "isdn":  { bytesPerSec: 16000, pxPerSec: 1800, label: "128,000 bps" },
    "dsl":   { bytesPerSec: 64000, pxPerSec: 5000, label: "512,000 bps" }
  };

  // Wait for settings to load
  chrome.storage.local.get(null, (loadedSettings) => {
    settings = loadedSettings;

    // Check if empty or disabled
    if (!settings.siteList) {
      removeHideStyle();
      return;
    }

    if (!settings.enabled) {
      removeHideStyle();
      return;
    }

    // Match current URL against site regex list
    const currentUrl = window.location.href;
    isMatched = settings.siteList.some(site => {
      if (!site.enabled) return false;
      const regex = new RegExp(site.regex, "i");
      return regex.test(currentUrl);
    });

    if (!isMatched) {
      removeHideStyle();
      return;
    }

    // Start simulated dial-up procedure!
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initSimulation);
    } else {
      initSimulation();
    }
  });

  function removeHideStyle() {
    if (hideStyle && hideStyle.parentNode) {
      hideStyle.parentNode.removeChild(hideStyle);
    }
  }

  // Initialize the dial-up connection sequence
  function initSimulation() {
    console.log("90s Internet Simulator active for matching website!");
    
    if (settings.isConnected) {
      console.log("90s Internet: Connection already active. Loading throttled content directly.");
      startThrottledPageRender();
    } else {
      // Injected elements markup
      injectConnectionOverlay();
    }
  }

  // Inject Win95 Dialup Desktop Overlay
  function injectConnectionOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "retro-dialup-overlay";
    overlay.className = "connecting";

    const targetSpeedLabel = SPEED_CONFIGS[settings.speed]?.label || "56,600 bps";

    overlay.innerHTML = `
      <div class="win95-dialog outset-bevel">
        <div class="title-bar">
          <div class="title-bar-text">Dial-Up Connection</div>
          <div class="title-bar-controls">
            <button id="retro-dialup-cancel-top" aria-label="Close"></button>
          </div>
        </div>
        <div class="dialog-body">
          <div class="connection-graphics">
            <!-- Left PC graphic -->
            <div class="pc-graphic">
              <svg viewBox="0 0 32 32">
                <rect x="2" y="2" width="22" height="18" fill="#c0c0c0" stroke="#000" stroke-width="1.5"/>
                <rect x="4" y="4" width="18" height="12" fill="#a0c0ff" stroke="#000" stroke-width="1"/>
                <rect x="2" y="23" width="22" height="3" fill="#808080" stroke="#000" stroke-width="1"/>
                <polygon points="8,20 2,23 24,23 18,20" fill="#c0c0c0" stroke="#000" stroke-width="1"/>
                <!-- Tower -->
                <rect x="25" y="8" width="6" height="18" fill="#c0c0c0" stroke="#000" stroke-width="1"/>
                <rect x="27" y="10" width="2" height="1" fill="#000"/>
                <rect x="27" y="13" width="2" height="2" fill="#808080"/>
                <circle cx="28" cy="22" r="0.8" fill="#ff0000"/>
              </svg>
            </div>
            
            <!-- Flashing connecting phone line -->
            <svg width="60" height="32" viewBox="0 0 60 32">
              <path class="flash-line" d="M5,16 Q30,4 55,16" fill="none" stroke-width="2" stroke-linecap="round"/>
            </svg>

            <!-- Right ISP modem graphic -->
            <div class="modem-graphic">
              <svg viewBox="0 0 32 32">
                <rect x="2" y="10" width="28" height="12" fill="#c0c0c0" stroke="#000" stroke-width="1.5"/>
                <!-- LED panel -->
                <rect x="4" y="14" width="24" height="4" fill="#000"/>
                <circle cx="6" cy="16" r="1.2" fill="#00ff00" id="led-mr"/>
                <circle cx="10" cy="16" r="1.2" fill="#00ff00" id="led-tr"/>
                <circle cx="14" cy="16" r="1.2" fill="#00ff00" id="led-sd"/>
                <circle cx="18" cy="16" r="1.2" fill="#00ff00" id="led-rd"/>
                <circle cx="22" cy="16" r="1.2" fill="#ff0000" id="led-oh"/>
              </svg>
            </div>
          </div>

          <div class="connection-info">
            <div class="info-label" id="dialup-status-text">Ready to connect...</div>
            <div class="info-detail">Device: Dial-Up Modem (COM3)</div>
            <div class="info-detail">Phone: 708-3012</div>
            <div class="info-detail">Speed: ${targetSpeedLabel}</div>
            
            <div class="progress-bar-border" style="margin-top: 4px; display: none;" id="dialup-progress-border">
              <div class="progress-bar-fill" id="dialup-progress-fill"></div>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="win95-btn" id="retro-dialup-connect" style="margin-right: 6px; font-weight: bold;">Connect</button>
            <button class="win95-btn" id="retro-dialup-cancel">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    `;

    document.body.appendChild(overlay);

    // Wire up connect button to circumvent autoplay block
    const connectBtn = document.getElementById("retro-dialup-connect");
    const cancelBtn = document.getElementById("retro-dialup-cancel");
    const cancelTopBtn = document.getElementById("retro-dialup-cancel-top");
    const statusText = document.getElementById("dialup-status-text");

    // Automatically trigger connect attempt. If blocked by Chrome autoplay, wait for button click.
    attemptAutoplayConnect();

    function attemptAutoplayConnect() {
      if (!settings.soundEnabled) {
        // Sound disabled, fast track connection
        statusText.textContent = "Connecting (Silent)...";
        connectBtn.style.display = "none";
        runSilentConnection();
      } else {
        // Sound enabled, trigger connect
        statusText.textContent = "Click Connect to dial ISP...";
        connectBtn.focus();
      }
    }

    connectBtn.addEventListener("click", () => {
      connectBtn.disabled = true;
      connectBtn.textContent = "Dialing...";
      startDialupHandshake();
    });

    const handleCancel = () => {
      console.log("90s Internet Simulator: Cancelled dial-up loading.");
      // Stop synth
      if (window.dialupSynth) {
        window.dialupSynth.stop();
      }
      bypassAndLoadPage();
    };

    cancelBtn.addEventListener("click", handleCancel);
    cancelTopBtn.addEventListener("click", handleCancel);
  }

  // Dialup Sequence with full Web Audio Handshake Audio
  function startDialupHandshake() {
    const statusText = document.getElementById("dialup-status-text");
    const progressBorder = document.getElementById("dialup-progress-border");
    const progressFill = document.getElementById("dialup-progress-fill");

    statusText.textContent = "Dialing ISP...";
    
    if (window.dialupSynth) {
      window.dialupSynth.play(() => {
        // Handshake sound complete!
        statusText.textContent = "Connected! Logging onto network...";
        progressBorder.style.display = "block";
        
        let pct = 0;
        const progressInterval = setInterval(() => {
          pct += 10;
          progressFill.style.width = `${pct}%`;
          if (pct === 30) statusText.textContent = "Verifying username and password...";
          if (pct === 70) statusText.textContent = "Securing TCP/IP configuration...";
          
          if (pct >= 100) {
            clearInterval(progressInterval);
            statusText.textContent = "Logged on. Enjoy the Web!";
            chrome.storage.local.set({ isConnected: true }, () => {
              setTimeout(() => {
                // Fade out desktop overlay and begin throttled page render
                fadeAndStartPageRender();
              }, 600);
            });
          }
        }, 120);
      });
    } else {
      // Synth missing, fallback immediately
      runSilentConnection();
    }
  }

  // Fast-track connection without audio
  function runSilentConnection() {
    const statusText = document.getElementById("dialup-status-text");
    const progressBorder = document.getElementById("dialup-progress-border");
    const progressFill = document.getElementById("dialup-progress-fill");

    progressBorder.style.display = "block";
    let pct = 0;
    const progressInterval = setInterval(() => {
      pct += 20;
      progressFill.style.width = `${pct}%`;
      if (pct === 40) statusText.textContent = "Logging on...";
      if (pct === 80) statusText.textContent = "Establishing carrier...";
      if (pct >= 100) {
        clearInterval(progressInterval);
        chrome.storage.local.set({ isConnected: true }, () => {
          fadeAndStartPageRender();
        });
      }
    }, 150);
  }

  // Fade out connection dialog and triggers throttle render
  function fadeAndStartPageRender() {
    const overlay = document.getElementById("retro-dialup-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.parentNode.removeChild(overlay);
        startThrottledPageRender();
      }, 500);
    }
  }

  // Instantly skips simulation in case of cancel/bypass
  function bypassAndLoadPage() {
    removeHideStyle();
    
    const overlay = document.getElementById("retro-dialup-overlay");
    if (overlay) overlay.parentNode.removeChild(overlay);

    const sBar = document.getElementById("classic-status-bar");
    if (sBar) sBar.parentNode.removeChild(sBar);

    // Instantly reveal all elements
    document.querySelectorAll(".retro-element").forEach(el => {
      el.classList.add("revealed");
    });

    // Instantly reveal images
    document.querySelectorAll(".retro-img-loading").forEach(img => {
      img.style.clipPath = "none";
    });

    // Remove placeholders
    document.querySelectorAll(".retro-img-placeholder").forEach(ph => {
      ph.parentNode.removeChild(ph);
    });

    // Un-nest images from helper container
    document.querySelectorAll(".retro-img-container").forEach(container => {
      const img = container.querySelector("img");
      if (img && container.parentNode) {
        container.parentNode.insertBefore(img, container);
        container.parentNode.removeChild(container);
      }
    });

    // Remove status layout padding
    document.documentElement.classList.remove("retro-sim-active");
  }

  // MAIN THROTTLED LOADING PROCESS
  function startThrottledPageRender() {
    // Inject Retro Status Bar at bottom
    if (settings.statusBarEnabled) {
      injectStatusBar();
    }

    // Traverse the document DOM and set up the reveal hooks
    prepareDOMForSlowRender();

    // Remove initial raw hide rule so we can trigger CSS reveals
    removeHideStyle();

    // Start progress timers
    startRevealLoop();
  }

  // Inject Netscape bottom status bar
  function injectStatusBar() {
    document.documentElement.classList.add("retro-sim-active");

    const sBar = document.createElement("div");
    sBar.id = "classic-status-bar";
    sBar.innerHTML = `
      <div class="status-pane status-pane-left" id="sbar-text">Opening page...</div>
      <div class="status-pane status-pane-middle">
        <div class="status-progress-fill" id="sbar-progress"></div>
      </div>
      <div class="status-pane status-pane-right">
        <div class="status-netscape-logo animating" id="sbar-netscape-logo">
          <div class="space-background"></div>
          <div class="netscape-letter">N</div>
        </div>
      </div>
    `;
    document.body.appendChild(sBar);
  }

  // Walk DOM, wrap images, hide elements
  function prepareDOMForSlowRender() {
    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Avoid our injected layers
          if (node.id === "classic-status-bar" || node.id === "retro-dialup-overlay") {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.tagName === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    const elementsToHide = [];
    const imagesToThrottle = [];

    while (node = walk.nextNode()) {
      // 1. Process Images specifically
      if (node.tagName === "IMG" && node.src) {
        imagesToThrottle.push(node);
      } else {
        // 2. Process structural layout blocks & text
        const display = window.getComputedStyle(node).display;
        if (display !== "none" && display !== "contents") {
          elementsToHide.push(node);
        }
      }
    }

    // Wrap and replace images
    imagesToThrottle.forEach((img) => {
      wrapImageWithPlaceholder(img);
    });

    // Hide elements by adding class
    elementsToHide.forEach((el) => {
      el.classList.add("retro-element");
    });
  }

  // Wraps <img> tags with slow loading containers and shows classic broken icon
  function wrapImageWithPlaceholder(img) {
    // Only wrap if not already wrapped
    if (img.classList.contains("retro-img-loading")) return;

    // Get calculated image bounds to enforce placeholder dimensions
    let width = img.width || img.getAttribute("width") || parseInt(img.style.width) || 120;
    let height = img.height || img.getAttribute("height") || parseInt(img.style.height) || 90;

    // Fix dimensions if zero
    if (width === 0) width = 120;
    if (height === 0) height = 90;

    const container = document.createElement("div");
    container.className = "retro-img-container";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    
    // Copy inline styles to maintain layout alignment
    const align = img.getAttribute("align") || window.getComputedStyle(img).float;
    if (align === "left" || align === "right") {
      container.style.float = align;
    }
    const margin = window.getComputedStyle(img).margin;
    container.style.margin = margin;

    const placeholder = document.createElement("div");
    placeholder.className = "retro-img-placeholder";
    
    const altText = img.getAttribute("alt") || img.src.split("/").pop() || "image.gif";
    placeholder.innerHTML = `
      <div class="retro-broken-icon">X</div>
      <div class="retro-broken-alt" title="${altText}">${altText}</div>
    `;

    // Swap node inside wrapper
    if (img.parentNode) {
      img.parentNode.insertBefore(container, img);
      container.appendChild(placeholder);
      container.appendChild(img);
      img.classList.add("retro-img-loading");
    }
  }

  // Slide Reveal line top-to-bottom
  function startRevealLoop() {
    const config = SPEED_CONFIGS[settings.speed] || SPEED_CONFIGS["56k"];
    const scrollHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    
    let revealY = 0;
    const pxPerSec = config.pxPerSec;
    const bytesPerSec = config.bytesPerSec;
    const startTime = Date.now();

    // Increment connection stats
    incrementConnectionCount();

    const intervalTimeMs = 50; // 20 frames/sec reveal scans
    revealIntervalId = setInterval(() => {
      const dt = intervalTimeMs / 1000;
      
      // Slide reveal line down
      revealY += pxPerSec * dt;
      simulatedLoadTimeSeconds += dt;
      
      // Calculate text bytes loaded (proportional to Y progression)
      const pct = Math.min((revealY / scrollHeight) * 100, 100);
      simulatedBytesTransferred = Math.round((pct / 100) * 15000); // assume 15KB text HTML payload

      // Scan all retro-elements. Reveal those above Y line
      const hiddenElements = document.querySelectorAll(".retro-element:not(.revealed)");
      hiddenElements.forEach((el) => {
        // Calculate Y position relative to body
        const rect = el.getBoundingClientRect();
        const elementY = rect.top + window.scrollY;
        
        if (elementY <= revealY) {
          el.classList.add("revealed");
          
          // If element is an image container, trigger its slow scanline download
          const img = el.querySelector(".retro-img-loading");
          if (img) {
            triggerImageSlowDownload(img, bytesPerSec);
          }
        }
      });

      // Also scan images placed outside generic block containers
      document.querySelectorAll(".retro-img-loading").forEach((img) => {
        // If image container not already downloading but is above Y line, start it
        if (!img.dataset.downloadStarted) {
          const rect = img.getBoundingClientRect();
          const elementY = rect.top + window.scrollY;
          if (elementY <= revealY) {
            triggerImageSlowDownload(img, bytesPerSec);
          }
        }
      });

      // Update bottom status bar
      updateStatusBar(pct, config.bytesPerSec);

      // Finished loading everything!
      if (pct >= 100 && allImagesLoaded()) {
        finishThrottledRender();
      }
    }, intervalTimeMs);
  }

  function allImagesLoaded() {
    const pendingImages = document.querySelectorAll(".retro-img-loading");
    return Array.from(pendingImages).every(img => img.dataset.downloadFinished === "true");
  }

  // Simulate progressive top-to-bottom JPEG rendering
  function triggerImageSlowDownload(img, bytesPerSec) {
    if (img.dataset.downloadStarted === "true") return;
    img.dataset.downloadStarted = "true";

    // Estimate file size based on dimensions (W * H * JPEG factor)
    const w = img.width || 100;
    const h = img.height || 100;
    // ~0.15 bytes per pixel for light compressed retro web images
    const fileSize = Math.max(Math.round(w * h * 0.15), 3000); // Min 3KB

    const durationSec = fileSize / bytesPerSec;
    const startTime = Date.now();
    let currentPercent = 0;

    const imageInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      currentPercent = Math.min((elapsed / durationSec) * 100, 100);

      // Accumulate bytes
      simulatedBytesTransferred += Math.round((currentPercent / 100) * fileSize);

      // Decrease bottom crop inset from 100% (hidden) down to 0% (fully loaded)
      const bottomInset = 100 - currentPercent;
      img.style.clipPath = `inset(0 0 ${bottomInset}% 0)`;

      if (currentPercent >= 100) {
        clearInterval(imageInterval);
        img.dataset.downloadFinished = "true";
        img.style.clipPath = "none";
        
        // Remove styling and restore original layout element
        setTimeout(() => {
          cleanUpLoadedImage(img);
        }, 100);
      }
    }, 100);

    activeImageIntervals.push(imageInterval);
  }

  function cleanUpLoadedImage(img) {
    const container = img.parentNode;
    if (container && container.classList.contains("retro-img-container")) {
      const ph = container.querySelector(".retro-img-placeholder");
      if (ph) container.removeChild(ph);
      
      img.classList.remove("retro-img-loading");
      
      // Un-nest
      if (container.parentNode) {
        container.parentNode.insertBefore(img, container);
        container.parentNode.removeChild(container);
      }
    }
  }

  // Update status bar texts and bar progress
  function updateStatusBar(progressPct, speedBytes) {
    const sbarText = document.getElementById("sbar-text");
    const sbarProgress = document.getElementById("sbar-progress");

    if (sbarProgress) {
      sbarProgress.style.width = `${progressPct}%`;
    }

    if (sbarText) {
      const loadedKb = (simulatedBytesTransferred / 1024).toFixed(1);
      const url = window.location.hostname;
      
      if (progressPct < 100) {
        sbarText.textContent = `Transferring data from ${url}... Received ${loadedKb} KB of data (${Math.round(progressPct)}% loaded)`;
      } else {
        sbarText.textContent = `Waiting for remaining images to load...`;
      }
    }
  }

  // Clear timers, finalize load stats
  function finishThrottledRender() {
    clearInterval(revealIntervalId);
    activeImageIntervals.forEach(id => clearInterval(id));
    activeImageIntervals = [];

    // Finalize status bar
    const sbarText = document.getElementById("sbar-text");
    const sbarProgress = document.getElementById("sbar-progress");
    const nLogo = document.getElementById("sbar-netscape-logo");

    if (sbarProgress) sbarProgress.style.width = "100%";
    if (sbarText) sbarText.textContent = "Document: Done";
    if (nLogo) nLogo.classList.remove("animating");

    // Persist stats in local storage
    saveStatsToStorage();
  }

  function incrementConnectionCount() {
    chrome.storage.local.get("stats", (data) => {
      const stats = data.stats || { totalBytes: 0, totalTimeSavedSeconds: 0, connectionCount: 0 };
      stats.connectionCount = (stats.connectionCount || 0) + 1;
      chrome.storage.local.set({ stats });
    });
  }

  function saveStatsToStorage() {
    chrome.storage.local.get("stats", (data) => {
      const stats = data.stats || { totalBytes: 0, totalTimeSavedSeconds: 0, connectionCount: 0 };
      stats.totalBytes = (stats.totalBytes || 0) + simulatedBytesTransferred;
      stats.totalTimeSavedSeconds = (stats.totalTimeSavedSeconds || 0) + Math.round(simulatedLoadTimeSeconds);
      
      chrome.storage.local.set({ stats }, () => {
        console.log(`90s Internet stats updated: +${simulatedBytesTransferred} bytes, +${Math.round(simulatedLoadTimeSeconds)}s.`);
      });
    });
  }
})();
