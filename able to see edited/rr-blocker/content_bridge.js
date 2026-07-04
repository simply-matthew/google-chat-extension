// Runs in the extension's isolated world, where chrome.storage is available.
// Relays the toggle state into the page's own JS context via postMessage,
// since content_main.js (world: MAIN) can't call chrome.* APIs directly.

function sendState(enabled) {
  window.postMessage({ __rrBlockerType: "RR_SET_STATE", enabled: !!enabled }, "*");
}

chrome.storage.sync.get(["rrBlockerEnabled"], (result) => {
  sendState(result.rrBlockerEnabled);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "rrBlockerEnabled" in changes) {
    sendState(changes.rrBlockerEnabled.newValue);
  }
});

// Re-assert state periodically in case the Chat app re-evaluates visibility
// after some internal reset (cheap safety net, not required in most cases).
setInterval(() => {
  chrome.storage.sync.get(["rrBlockerEnabled"], (result) => {
    sendState(result.rrBlockerEnabled);
  });
}, 5000);
