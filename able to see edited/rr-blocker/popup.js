const toggle = document.getElementById("toggle");
const statusText = document.getElementById("statusText");
const statusSub = document.getElementById("statusSub");
const statusDot = document.getElementById("statusDot");

function render(enabled) {
  toggle.checked = enabled;
  statusDot.classList.toggle("on", enabled);
  statusText.textContent = enabled ? "On" : "Off";
  statusSub.textContent = enabled
    ? "Mark-as-read requests are being blocked."
    : "Google Chat will mark messages as read normally.";
}

chrome.storage.sync.get(["rrBlockerEnabled"], (result) => {
  render(!!result.rrBlockerEnabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ rrBlockerEnabled: enabled }, () => {
    render(enabled);
  });
});

// --- Hotkey delete toggle ---
const hkToggle = document.getElementById("hkToggle");
const hkStatusText = document.getElementById("hkStatusText");
const hkStatusSub = document.getElementById("hkStatusSub");
const hkStatusDot = document.getElementById("hkStatusDot");

function renderHk(enabled) {
  hkToggle.checked = enabled;
  hkStatusDot.classList.toggle("on", enabled);
  hkStatusText.textContent = enabled ? "On" : "Off";
  hkStatusSub.textContent = enabled
    ? "Ctrl+Shift+Backspace instantly deletes your last message."
    : "Deletes your most recent message instantly — no undo.";
}

chrome.storage.sync.get(["hotkeyDeleteEnabled"], (result) => {
  renderHk(!!result.hotkeyDeleteEnabled);
});

hkToggle.addEventListener("change", () => {
  const enabled = hkToggle.checked;
  chrome.storage.sync.set({ hotkeyDeleteEnabled: enabled }, () => {
    renderHk(enabled);
  });
});

// --- Message history toggle ---
const mlToggle = document.getElementById("mlToggle");
const mlStatusText = document.getElementById("mlStatusText");
const mlStatusSub = document.getElementById("mlStatusSub");
const mlStatusDot = document.getElementById("mlStatusDot");

function renderMl(enabled) {
  mlToggle.checked = enabled;
  mlStatusDot.classList.toggle("on", enabled);
  mlStatusText.textContent = enabled ? "On" : "Off";
  mlStatusSub.textContent = enabled
    ? "Watching for edited/deleted messages."
    : "See original text when a message is edited or deleted.";
}

chrome.storage.sync.get(["messageLoggerEnabled"], (result) => {
  renderMl(!!result.messageLoggerEnabled);
});

mlToggle.addEventListener("change", () => {
  const enabled = mlToggle.checked;
  chrome.storage.sync.set({ messageLoggerEnabled: enabled }, () => {
    renderMl(enabled);
  });
});
