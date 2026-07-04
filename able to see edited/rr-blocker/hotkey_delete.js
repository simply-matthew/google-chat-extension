// Isolated-world content script. Finds the message ID of your most recent
// message, then asks the MAIN-world script (content_main.js) to fire the
// actual delete_message network call directly — bypassing Chat's own
// confirmation dialog UI entirely, so nothing visibly renders on screen.
//
// Flow:
//   1. Find your own messages: [data-is-viewer-message-creator="true"]
//      (take the last one in DOM order = most recently sent)
//   2. Read its data-message-id attribute
//   3. postMessage it to the MAIN world, which holds passively-captured
//      auth headers (xsrf token, space id) sniffed from Chat's own real
//      requests, and fires the delete call itself
//   4. Listen for the result and show a toast

(function () {
  const TOAST_ID = "rr-hotkey-toast";
  let enabled = false;

  console.log("[RR Hotkey] content script loaded on", location.href);

  function loadState() {
    chrome.storage.sync.get(["hotkeyDeleteEnabled"], (r) => {
      enabled = !!r.hotkeyDeleteEnabled;
      console.log("[RR Hotkey] initial state loaded, enabled =", enabled);
    });
  }
  loadState();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "hotkeyDeleteEnabled" in changes) {
      enabled = !!changes.hotkeyDeleteEnabled.newValue;
      console.log("[RR Hotkey] state changed, enabled =", enabled);
    }
  });

  function showToast(msg, isError) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      Object.assign(el.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        padding: "10px 16px",
        borderRadius: "8px",
        fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
        fontSize: "13px",
        color: "#fff",
        zIndex: 2147483647,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        transition: "opacity 0.25s ease",
        pointerEvents: "none",
      });
      document.body.appendChild(el);
    }
    el.style.background = isError ? "#c5221f" : "#1a73e8";
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.style.opacity = "0";
    }, 2200);
  }

  // Listen for the result of a direct-delete attempt fired from the MAIN
  // world script, which holds the passively-captured auth headers needed
  // to call the delete API directly.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__rrBlockerType === "RR_DELETE_RESULT") {
      if (data.success) {
        showToast("Message deleted");
      } else if (data.error) {
        showToast(data.error, true);
      } else {
        showToast(`Delete failed (status ${data.status})`, true);
      }
    }
  });

  function findMessageId(el) {
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      const withId = node.querySelector("[data-message-id]");
      if (withId) return withId.getAttribute("data-message-id");
      if (node.hasAttribute && node.hasAttribute("data-message-id")) return node.getAttribute("data-message-id");
      node = node.parentElement;
    }
    return null;
  }

  // The space ID is embedded in the DOM as data-group-synthetic-id, usually
  // in the form "dm/4sf6BCAAAAE" or "space/xxxxx" — we want the part after
  // the slash. More reliable than the passive header cache, since that
  // header apparently isn't set on every background request.
  function findSpaceId(el) {
    function parse(raw) {
      const slash = raw.indexOf("/");
      return slash === -1 ? raw : raw.slice(slash + 1);
    }
    let node = el;
    for (let i = 0; i < 10 && node; i++) {
      const withId = node.querySelector && node.querySelector("[data-group-synthetic-id]");
      if (withId) return parse(withId.getAttribute("data-group-synthetic-id"));
      node = node.parentElement;
    }
    const global = document.querySelector("[data-group-synthetic-id]");
    if (global) return parse(global.getAttribute("data-group-synthetic-id"));
    return null;
  }

  async function deleteLastOwnMessage() {
    console.log("[RR Hotkey] triggered — looking for your last message");
    const ownMessages = document.querySelectorAll('[data-is-viewer-message-creator="true"]');
    console.log("[RR Hotkey] own messages found:", ownMessages.length);
    if (!ownMessages.length) {
      showToast("No message found to delete", true);
      return;
    }
    const target = ownMessages[ownMessages.length - 1];

    const messageId = findMessageId(target);
    const spaceId = findSpaceId(target);
    console.log("[RR Hotkey] message id:", messageId, "space id:", spaceId);
    if (!messageId) {
      showToast("Couldn't find the message ID", true);
      return;
    }
    if (!spaceId) {
      showToast("Couldn't find the space ID", true);
      return;
    }

    window.postMessage({ __rrBlockerType: "RR_DELETE_MESSAGE", messageId, spaceId }, "*");
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (!enabled) return;
      const mod = e.ctrlKey || e.metaKey; // Ctrl on Win/Linux, Cmd on Mac
      if (mod && e.shiftKey && e.key === "Backspace") {
        console.log("[RR Hotkey] hotkey detected");
        e.preventDefault();
        e.stopPropagation();
        deleteLastOwnMessage();
      }
    },
    true
  );
})();
