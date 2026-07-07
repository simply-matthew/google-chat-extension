// message_logger.js
// Isolated-world content script. Watches rendered message text nodes and
// keeps a local copy (chrome.storage.local, this device only) of the first
// text seen for each message ID.

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

  function extractMessageId(node) {
    if (!node || !node.id) return null;
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

  function insertBadge(targetParent, messageId, isDeleted) {
    const existingBadge = targetParent.querySelector("." + BADGE_CLASS);
    if (existingBadge) existingBadge.remove(); 
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = isDeleted ? " 🗑️" : " ✏️";
    badge.title = isDeleted ? "Message deleted — click to view original" : "Edited — click to view original";
    Object.assign(badge.style, {
      cursor: "pointer",
      fontSize: "11px",
      opacity: "0.7",
      marginLeft: "4px",
      display: "inline-block"
    });
    badge.addEventListener("click", async (e) => {
      e.stopPropagation();
      const entry = await loadLog(messageId);
      showOriginalPopover(badge, entry);
    });
    targetParent.appendChild(badge);
  }

  const DELETED_PATTERN = /message\s*(was\s+|has been\s+)?deleted/i;

  async function handleTextNode(node) {
    if (!enabled || !node) return;
    const id = extractMessageId(node);
    if (!id) return;
    
    const text = (node.textContent || "").trim();
    const existing = await loadLog(id);

    if (!existing) {
      if (text && !DELETED_PATTERN.test(text)) {
        saveLog(id, { original: text, current: text, editedAt: null, deleted: false });
        console.log("[RR Logger] first-seen message", id, ":", text);
      }
      return;
    }

    if (existing.current !== text) {
      const isDeleted = !text || DELETED_PATTERN.test(text);
      const updated = {
        original: existing.original,
        current: text || "[Deleted Content]",
        editedAt: Date.now(),
        deleted: isDeleted,
      };
      saveLog(id, updated);
      insertBadge(node, id, isDeleted);
      console.log(
        `[RR Logger] detected ${isDeleted ? "DELETE" : "edit"} on`,
        id,
        "| old:",
        existing.current,
        "| new:",
        text || "EMPTY_DOM"
      );
    }
  }

  // Handles processing an explicit DOM removal deletion
  async function handleForcedDeletion(id, fallbackContainer) {
    const existing = await loadLog(id);
    if (existing && !existing.deleted) {
      const updated = {
        original: existing.original,
        current: "[Deleted Content]",
        editedAt: Date.now(),
        deleted: true,
      };
      saveLog(id, updated);
      
      if (fallbackContainer) {
        insertBadge(fallbackContainer, id, true);
      }
      console.log("[RR Logger] caught explicit DOM removal deletion on item:", id);
    }
  }

  function scanExisting() {
    document.querySelectorAll('[jsname="bgckF"]').forEach(handleTextNode);
  }

  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const m of mutations) {
      // 1. Check added nodes (New messages / Edits)
      if (m.addedNodes) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('[jsname="bgckF"]')) handleTextNode(n);
          if (n.querySelectorAll) n.querySelectorAll('[jsname="bgckF"]').forEach(handleTextNode);
        });
      }
      
      // 2. Check removed nodes with verification to prevent false-positive trash cans
      if (m.removedNodes) {
        m.removedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          
          let targetNode = null;
          if (n.matches && n.matches('[jsname="bgckF"]')) targetNode = n;
          else if (n.querySelectorAll) targetNode = n.querySelector('[jsname="bgckF"]');
          
          if (targetNode) {
            const id = extractMessageId(targetNode);
            if (id) {
              // Delay execution slightly to see if Google immediately re-inserted a node with the same ID
              setTimeout(() => {
                const stillExists = document.querySelector(`[id^="${id}/"]`);
                if (!stillExists) {
                  handleForcedDeletion(id, m.target);
                }
              }, 50);
            }
          }
        });
      }

      // 3. Check character/text changes
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
    console.log("[RR Logger] watching for message updates (including DOM removals)");
  }

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start);
})();