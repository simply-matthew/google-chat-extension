// Isolated-world content script. Watches rendered message text nodes and
// keeps a local copy (chrome.storage.local, this device only) of the first
// text seen for each message ID. If the text later changes while the same
// ID persists in the DOM, that's a strong, virtualization-proof signal of
// an edit — so we flag it with a small badge you can click to see the
// original. Deletion detection isn't implemented yet (see README) — full
// node removal is too easily confused with normal list virtualization
// (messages unmounting as you scroll) to trust without live testing first.

(function () {
  let enabled = false;
  const STORAGE_PREFIX = "msglog:";
  const BADGE_CLASS = "rr-edited-badge";

  chrome.storage.sync.get(["messageLoggerEnabled"], (r) => {
    enabled = !!r.messageLoggerEnabled;
    console.log("[RR Logger] initial state, enabled =", enabled);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "messageLoggerEnabled" in changes) {
      enabled = !!changes.messageLoggerEnabled.newValue;
      console.log("[RR Logger] state changed, enabled =", enabled);
    }
  });

  // Message text nodes have ids like "TKPuAI4h9vQ/qJTHM" — the part before
  // the slash is the stable message ID shared across that message's related
  // elements (text, reactions, timestamp, etc).
  function extractMessageId(node) {
    if (!node.id) return null;
    const slash = node.id.indexOf("/");
    if (slash === -1) return null;
    return node.id.slice(0, slash);
  }

  function cacheKey(id) {
    return STORAGE_PREFIX + id;
  }

  function saveLog(id, entry) {
    chrome.storage.local.set({ [cacheKey(id)]: entry });
  }

  function loadLog(id) {
    return new Promise((resolve) => {
      chrome.storage.local.get([cacheKey(id)], (r) => resolve(r[cacheKey(id)] || null));
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s || "";
    return div.innerHTML;
  }

  function showOriginalPopover(anchor, entry) {
    const existing = document.getElementById("rr-original-popover");
    if (existing) existing.remove();
    const box = document.createElement("div");
    box.id = "rr-original-popover";
    Object.assign(box.style, {
      position: "fixed",
      zIndex: 2147483647,
      background: "#202124",
      color: "#fff",
      padding: "10px 12px",
      borderRadius: "8px",
      fontSize: "12px",
      maxWidth: "320px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      lineHeight: "1.4",
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
    });
    const rect = anchor.getBoundingClientRect();
    box.style.top = rect.bottom + 6 + "px";
    box.style.left = rect.left + "px";
    box.innerHTML = entry
      ? `<b>Original:</b><br>${escapeHtml(entry.original)}${
          entry.deleted
            ? "<br><br><i>This message was deleted.</i>"
            : `<br><br><b>Current:</b><br>${escapeHtml(entry.current)}`
        }`
      : "No cached original found.";
    document.body.appendChild(box);
    setTimeout(() => {
      document.addEventListener(
        "click",
        function handler() {
          box.remove();
          document.removeEventListener("click", handler);
        },
        { once: true }
      );
    }, 0);
  }

  function insertBadge(textNode, messageId, isDeleted) {
    const existingBadge = textNode.querySelector("." + BADGE_CLASS);
    if (existingBadge) existingBadge.remove(); // refresh in case deleted-state changed
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = isDeleted ? " 🗑️" : " ✏️";
    badge.title = isDeleted ? "Message deleted — click to view original" : "Edited — click to view original";
    Object.assign(badge.style, {
      cursor: "pointer",
      fontSize: "11px",
      opacity: "0.7",
      marginLeft: "4px",
    });
    badge.addEventListener("click", async (e) => {
      e.stopPropagation();
      const entry = await loadLog(messageId);
      showOriginalPopover(badge, entry);
    });
    textNode.appendChild(badge);
  }

  // Confirmed: Google Chat replaces a deleted message's text with this
  // placeholder in the same DOM node (same message ID) rather than removing
  // the node entirely — so we can detect deletions the same reliable way
  // as edits, just checking whether the new text matches this pattern.
  // Best guess at Chat's placeholder wording — broadened to catch variants
  // like "Message deleted" as well as "This message was deleted". We'll
  // tighten this once we know the exact string Chat uses.
  const DELETED_PATTERN = /message\s*(was\s+|has been\s+)?deleted/i;

  async function handleTextNode(node) {
    if (!enabled) return;
    const id = extractMessageId(node);
    if (!id) return;
    const text = (node.textContent || "").trim();
    if (!text) return;

    const existing = await loadLog(id);
    if (!existing) {
      saveLog(id, { original: text, current: text, editedAt: null, deleted: false });
      console.log("[RR Logger] first-seen message", id, ":", text);
      return;
    }
    if (existing.current !== text) {
      const isDeleted = DELETED_PATTERN.test(text);
      const updated = {
        original: existing.original,
        current: text,
        editedAt: Date.now(),
        deleted: isDeleted,
      };
      saveLog(id, updated);
      insertBadge(node, id, isDeleted);
      console.log(
        `[RR Logger] detected ${isDeleted ? "DELETE" : "edit"} on`,
        id,
        "— pattern matched:",
        isDeleted,
        "| old:",
        existing.current,
        "| new:",
        text
      );
    }
  }

  function scanExisting() {
    document.querySelectorAll('[jsname="bgckF"]').forEach(handleTextNode);
  }

  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const m of mutations) {
      if (m.addedNodes) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('[jsname="bgckF"]')) handleTextNode(n);
          if (n.querySelectorAll) n.querySelectorAll('[jsname="bgckF"]').forEach(handleTextNode);
        });
      }
      if (m.type === "characterData" || m.type === "childList") {
        let el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        while (el && !(el.getAttribute && el.getAttribute("jsname") === "bgckF")) {
          el = el.parentElement;
        }
        if (el) handleTextNode(el);
      }
    }
  });

  function start() {
    scanExisting();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log("[RR Logger] watching for message edits");
  }

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start);
})();
