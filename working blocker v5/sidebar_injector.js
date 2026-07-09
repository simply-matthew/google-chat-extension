// sidebar_injector.js
// Enhanced Floating Premium Interface Engine for Ghost Client

(function () {
  if (window.self !== window.top) return;

  // Clear previous instances to prevent layout memory corruption
  const oldBtn = document.getElementById("ghost-launcher-btn");
  if (oldBtn) oldBtn.remove();
  const oldDeck = document.getElementById("ghost-client-floating-panel");
  if (oldDeck) oldDeck.remove();
  const oldConnector = document.getElementById("ghost-quote-connector");
  if (oldConnector) oldConnector.remove();

  const CONFIGS = [
    {
      key: "rrBlockerEnabled",
      id: "rrToggle",
      title: "READ RECEIPTS",
      statusTextOn: "On",
      statusTextOff: "Off",
      descOn: "Mark-as-read requests are being blocked.",
      descOff: "Google Chat will mark messages as read normally.",
      note: 'Flip on, then open DM. Once you read the DM, click into another DM then refresh the page. It will not work otherwise.'
    },
    {
      key: "hotkeyDeleteEnabled",
      id: "hkToggle",
      title: "HOTKEY DELETE",
      statusTextOn: "On",
      statusTextOff: "Off",
      descOn: "Press key combo and then enter",
      descOff: "Press key combo and then enter.",
      note: 'Ctrl+Shift+Backspace'
    },
    {
      key: "messageLoggerEnabled",
      id: "mlToggle",
      title: "MESSAGE HISTORY",
      statusTextOn: "On",
      statusTextOff: "Off",
      descOn: "Watching for edited/deleted messages.",
      descOff: "See original text when a message is edited or deleted.",
      note: 'While on, an ✏️ or 🗑️ icon appears next to any message that changes. Click it to see the original text.'
    },
    {
      key: "autoTranslateEnabled",
      id: "atToggle",
      title: "AUTO TRANSLATE",
      statusTextOn: "On",
      statusTextOff: "Off",
      descOn: "Translating all incoming foreign texts to English.",
      descOff: "Translates incoming text messages to English automatically.",
      note: ' '
    }
  ];









function applyGlobalBackground(base64Data) {
  let styleEl = document.getElementById("ghost-global-background-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "ghost-global-background-style";
    document.head.appendChild(styleEl);
  }
  
  if (base64Data) {
    styleEl.textContent = `
      /* 1. Set the fixed background on the root */
      html, body {
        background-image: url("${base64Data}") !important;
        background-size: cover !important;
        background-position: center !important;
        background-attachment: fixed !important;
        background-repeat: no-repeat !important;
        background-color: transparent !important;
      }

      /* 2. Force transparency on everything, but STOP before entering the sidebar */
      *:not(html):not(body):not(div.x6eWOb.u92MIf.krjOGe):not(div.x6eWOb.u92MIf.krjOGe *) {
        background-color: transparent !important;
        background-image: none !important;
      }


/* 3a. Style for sidebar/menus (keep glass and smooth transitions) */
      div.x6eWOb.u92MIf.krjOGe,
      div.Bl2pUd.krjOGe,
      div.Vw1QGc.DZfN8d.oMuP2d.ULpLBe,
      div.wZ7w0e.krjOGe,
      
      {
        background-color: rgba(255, 255, 255, 0.03) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border-radius: 16px !important;
        background-clip: padding-box !important;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
        transition: all 0.4s ease !important;
      }

      /* 3b. Force fixed position for the main chat input ONLY */
      div[role="main"] div.XganBc.eLNT1d {
        background-color: rgba(255, 255, 255, 0.03) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border-radius: 16px !important;
        background-clip: padding-box !important;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
        transition: none !important;
        
        position: fixed !important;
        bottom: 20px !important;
        left: 20px !important;
        right: 20px !important;
        z-index: 1000 !important;
      }

      /* Keep the pop-out window's input behaving normally by using 'absolute' */
      /* This tells the browser: "stay inside your parent, don't jump to the bottom of the screen" */
      div:not([role="main"]) div.XganBc.eLNT1d {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 !important;
      }




/* --- 3c. Message Logger Customizations --- */

/* 1. Force the popup to ignore your custom spacing rules */
c-wiz:not([data-is-main-view]) div.dsoUjb.McQwEc {
  padding-bottom: unset !important;
  margin-bottom: unset !important;
  display: block !important;
  transform: none !important;
}

/* 2. ONLY apply the 'reversal' layout to the Main Chat window */
c-wiz[data-is-main-view] div.dsoUjb.McQwEc {
  display: flex !important;
  flex-direction: column-reverse !important;
  padding-bottom: 0px !important;
  margin-bottom: 0px !important;
  transform: translateY(-150px) !important;
}

/* 3. Aggressive reset for inner message blocks */
div.dsoUjb.McQwEc > div {
  display: block !important;
  height: auto !important;
  flex: none !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 4. Hide dividers */
div.k1lILc.d190Me.dPmLDd.J3iNX { display: none !important; }
div.Ao1xUb.jQV4ab.pYTmjf.mCOR5e {
  visibility: hidden !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  flex: none !important;
}












    `;
  } else {
    styleEl.textContent = "";
  }
}












  // Instantly fetch and render any stored custom background profile configurations on runtime load
  chrome.storage.local.get(["customBgData"], (res) => {
    if (res.customBgData) {
      applyGlobalBackground(res.customBgData);
    }
  });

  function injectFloatingPanel() {
    // 1. Create Draggable Launcher Button with Eye Icon (No Title Tooltip)
    const triggerBtn = document.createElement("div");
    triggerBtn.id = "ghost-launcher-btn";
    
    triggerBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
          <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#9d4edd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="3" stroke="#00ffff" stroke-width="2" fill="#121214"/>
      </svg>
    `;

    // Strict baseline coordinate layer to protect viewport presentation bounds
    triggerBtn.style.left = "30px";
    triggerBtn.style.bottom = "30px";

    let dragStyles = document.getElementById("ghost-core-styles");
    if (!dragStyles) {
      dragStyles = document.createElement("style");
      dragStyles.id = "ghost-core-styles";
      document.head.appendChild(dragStyles);
    }
    
    dragStyles.textContent = `
      #ghost-launcher-btn {
        position: fixed !important;
        width: 48px !important;
        height: 48px !important;
        background-color: #121214 !important;
        border: 2px solid #9d4edd !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: grab !important;
        z-index: 2147483647 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 8px rgba(157, 78, 221, 0.3) !important;
        user-select: none !important;
      }
      #ghost-launcher-btn:hover {
        border-color: #00ffff !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 255, 255, 0.5) !important;
      }
      
      .ghost-drag-shield {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        background: transparent !important;
        cursor: grabbing !important;
      }
      
      #ghost-client-floating-panel.ghost-deck {
        position: fixed !important;
        width: 440px !important; /* Increased Width */
        height: 520px !important;
        max-height: 85vh !important;
        z-index: 2147483645 !important;
        transform-origin: center !important;
        transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease !important;
        transform: scale(1) !important;
        opacity: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        pointer-events: auto !important;
        box-sizing: border-box !important;
        background-color: #121214 !important;
        border: 2px solid #9d4edd !important;
        border-radius: 16px !important;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7) !important;
      }
      
      /* Premium Quote Bubble Triangle Pointers */
      #ghost-client-floating-panel.ghost-deck::before {
        content: "" !important;
        position: absolute !important;
        width: 0 !important;
        height: 0 !important;
        border-style: solid !important;
        z-index: 2147483646 !important;
      }
      
      /* Left-side pointer (When panel sits to the right of the button) */
      #ghost-client-floating-panel.ghost-deck.pointer-left::before {
        top: 246px !important; /* Centers triangle to the 520px total height */
        left: -14px !important;
        border-width: 12px 14px 12px 0 !important;
        border-color: transparent #9d4edd transparent transparent !important;
      }
      
      /* Right-side pointer (When panel sits to the left of the button) */
      #ghost-client-floating-panel.ghost-deck.pointer-right::before {
        top: 246px !important;
        right: -14px !important;
        border-width: 12px 0 12px 14px !important;
        border-color: transparent transparent transparent #9d4edd !important;
      }
      
      #ghost-client-floating-panel.ghost-deck.hidden-deck {
        transform: scale(0) !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Native styled premium file picker overrides */
      .file-input-container {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        width: 100% !important;
      }
      .ghost-file-label {
        flex: 1 !important;
        background-color: #1a1a1e !important;
        border: 1px solid #3a3a42 !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
        color: #8e8e93 !important;
        font-size: 13px !important;
        cursor: pointer !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        text-align: left !important;
      }
      .ghost-file-label:hover {
        border-color: #9d4edd !important;
        color: #ffffff !important;
      }
    `;

    document.body.appendChild(triggerBtn);

    // 3. Create Expanded Interface Panel
    const deck = document.createElement("div");
    deck.id = "ghost-client-floating-panel";
    deck.className = "ghost-deck hidden-deck";

    let htmlContent = `
      <div class="deck-header">
        <div class="deck-title-group">
          <div class="custom-icon-wrapper"><div class="custom-brand-icon"></div></div>
          <h1>Ghost Client Panel</h1>
        </div>
        <span id="closeGhostPanel" class="deck-close-btn">✕</span>
      </div>
      <div class="deck-scroll-container" style="flex: 1 !important; overflow-y: auto !important; padding-right: 4px;">
    `;

    CONFIGS.forEach((cfg) => {
      htmlContent += `
        <div class="section-group">
          <div class="header-row">
            <div class="dot" id="${cfg.id}Dot"></div>
            <h2 class="section-title">${cfg.title}</h2>
          </div>
          
          <div class="premium-card">
            <div class="card-inner">
              <div class="label-block">
                <span class="status-state-text" id="${cfg.id}StateText">${cfg.statusTextOff}</span>
                <p class="status-sub-desc" id="${cfg.id}SubDesc">${cfg.descOff}</p>
              </div>
              <label class="switch">
                <input type="checkbox" id="${cfg.id}" data-key="${cfg.key}">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          
          <div class="section-note">${cfg.note}</div>
        </div>
      `;
    });

    htmlContent += `
        <div class="divider"></div>
        <div class="section-group">
          <h2 class="section-title">CLIENT ADVANCED THEMING</h2>
          <div class="theme-inputs-wrapper">
            <div class="file-input-container">
              <label for="bgImageFile" id="bgFileLabel" class="ghost-file-label">Choose Background Image...</label>
              <input type="file" id="bgImageFile" accept="image/*" style="display: none !important;" />
            </div>
            <input type="text" id="customAudioUrl" class="premium-input" placeholder="Paste Custom Audio URL (.mp3 / .wav)..." />
            <button id="saveCustomSettings" class="premium-btn">Apply Theme Changes</button>
          </div>
        </div>
      </div>
    `;

    deck.innerHTML = htmlContent;
    document.body.appendChild(deck);



    // Dynamic Tracking & Quote Bubble Orientation Engine
    function updateMenuAnchor() {
      const btnRect = triggerBtn.getBoundingClientRect();
      
      // Horizontal and vertical offsets centering the panel on the eye button
      let targetLeft = btnRect.right + 24; 
      let targetTop = (btnRect.top + (btnRect.height / 2)) - 260; 

      // Viewport safety checks
      if (targetTop < 15) targetTop = 15;
      if (targetTop + 520 > window.innerHeight) targetTop = window.innerHeight - 535;
      
      if (targetLeft + 440 > window.innerWidth) {
        // Flip menu to the left side if button dragged too close to the right edge
        targetLeft = btnRect.left - 464;
        deck.classList.remove("pointer-left");
        deck.classList.add("pointer-right");
      } else {
        deck.classList.remove("pointer-right");
        deck.classList.add("pointer-left");
      }

      deck.style.left = `${targetLeft}px`;
      deck.style.top = `${targetTop}px`;
    }

    updateMenuAnchor();

    // 4. Glass Shield Drag Tracking Surface
    let isDragging = false;
    let clickThresholdMet = false;
    let startX, startY, initialX, initialY;
    let shieldLayer = null;

    function onMouseMove(e) {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Filter out micro-jitter click events
      if (!clickThresholdMet && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
        clickThresholdMet = true;
      }

      if (!clickThresholdMet) return;

      let newLeft = initialX + deltaX;
      let newTop = initialY + deltaY;

      if (newLeft < 0) newLeft = 0;
      if (newLeft > window.innerWidth - 48) newLeft = window.innerWidth - 48;
      if (newTop < 0) newTop = 0;
      if (newTop > window.innerHeight - 48) newTop = window.innerHeight - 48;

      triggerBtn.style.bottom = "auto";
      triggerBtn.style.left = `${newLeft}px`;
      triggerBtn.style.top = `${newTop}px`;
      
      updateMenuAnchor();
    }

    function onMouseUp(e) {
      isDragging = false;
      if (shieldLayer) {
        shieldLayer.remove();
        shieldLayer = null;
      }
      window.removeEventListener("mousemove", onMouseMove, { capture: true });
      window.removeEventListener("mouseup", onMouseUp, { capture: true });

      // Clean toggle verification
      if (!clickThresholdMet) {
        deck.classList.toggle("hidden-deck");
        updateMenuAnchor();
      }
    }

    triggerBtn.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      
      isDragging = true;
      clickThresholdMet = false;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = triggerBtn.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      shieldLayer = document.createElement("div");
      shieldLayer.className = "ghost-drag-shield";
      document.body.appendChild(shieldLayer);

      window.addEventListener("mousemove", onMouseMove, { capture: true });
      window.addEventListener("mouseup", onMouseUp, { capture: true });
    });

    document.getElementById("closeGhostPanel").addEventListener("click", () => {
      deck.classList.add("hidden-deck");
    });

    initPanelLogic();
  }

  function updateVisuals(cfg, enabled) {
    const checkbox = document.getElementById(cfg.id);
    const dot = document.getElementById(`${cfg.id}Dot`);
    const stateText = document.getElementById(`${cfg.id}StateText`);
    const subDesc = document.getElementById(`${cfg.id}SubDesc`);

    if (checkbox) checkbox.checked = enabled;
    if (dot) dot.classList.toggle("on", enabled);
    if (stateText) stateText.textContent = enabled ? cfg.statusTextOn : cfg.statusTextOff;
    if (subDesc) subDesc.textContent = enabled ? cfg.descOn : cfg.descOff;
  }

  function initPanelLogic() {
    CONFIGS.forEach((cfg) => {
      const checkbox = document.getElementById(cfg.id);
      if (!checkbox) return;

      chrome.storage.sync.get([cfg.key], (res) => {
        const enabled = !!res[cfg.key];
        updateVisuals(cfg, enabled);
      });

      checkbox.addEventListener("change", () => {
        const enabled = checkbox.checked;
        chrome.storage.sync.set({ [cfg.key]: enabled }, () => {
          updateVisuals(cfg, enabled);
        });
      });
    });

    const fileInput = document.getElementById("bgImageFile");
    const fileLabel = document.getElementById("bgFileLabel");
    const audioInput = document.getElementById("customAudioUrl");
    const saveBtn = document.getElementById("saveCustomSettings");

    let pendingBgBase64 = null;

    // Visual updates to label element when local background file is loaded in window memory
    if (fileInput && fileLabel) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        fileLabel.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
          pendingBgBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    chrome.storage.sync.get(["customAudioUrl"], (res) => {
      if (res.customAudioUrl && audioInput) audioInput.value = res.customAudioUrl;
    });

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const audioUrlValue = audioInput ? audioInput.value.trim() : "";

        // Audio URLs save inside sync layer
        chrome.storage.sync.set({
          customAudioUrl: audioUrlValue
        }, () => {
          // Large data formats like base64 image structures are saved cleanly using local storage
          if (pendingBgBase64) {
            chrome.storage.local.set({ customBgData: pendingBgBase64 }, () => {
              applyGlobalBackground(pendingBgBase64);
              triggerSaveSuccessAnimation();
            });
          } else {
            triggerSaveSuccessAnimation();
          }
        });
      });
    }

    function triggerSaveSuccessAnimation() {
      const orig = saveBtn.textContent;
      saveBtn.textContent = "Applied Changes! ⚡";
      setTimeout(() => { saveBtn.textContent = orig; }, 1500);
    }
  }

  if (document.body) {
    injectFloatingPanel();
  } else {
    window.addEventListener("DOMContentLoaded", injectFloatingPanel);
  }
})();