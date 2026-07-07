// hotkey_delete.js
(function () {
  console.log("[RR Hotkey] Script injected and active.");

  // We define this at the very top so it can NEVER be undefined
  let pendingDeleteTarget = null; 

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function fireHoverEvents(el) { ["pointerenter", "mouseenter", "mouseover"].forEach((t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); }
  
  function findMenuItemByText(word) {
    const candidates = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button, div[jsaction]');
    for (const c of candidates) {
      const t = (c.textContent || "").trim().toLowerCase();
      if (t === word || (t.includes(word) && t.length <= word.length + 20)) return c;
    }
    return null;
  }

  // The fallback: If Google blocks the fast network delete, it clicks the menu for you
  async function deleteViaUI(target) {
    console.log("[RR Hotkey] Network failed, using UI fallback...");
    fireHoverEvents(target);
    let hoverNode = target.parentElement;
    for (let i = 0; i < 5 && hoverNode; i++) { fireHoverEvents(hoverNode); hoverNode = hoverNode.parentElement; }
    await sleep(150);

    let moreBtn = null;
    let node = target;
    for (let i = 0; i < 8 && node; i++) {
      moreBtn = node.querySelector('[aria-label="More actions"]');
      if (moreBtn) break;
      node = node.parentElement;
    }
    
    if (!moreBtn) return console.error("[RR Hotkey] Fallback failed: No menu button");
    moreBtn.click();
    await sleep(250);

    const deleteItem = findMenuItemByText("delete");
    if (!deleteItem) return console.error("[RR Hotkey] Fallback failed: No delete option");
    deleteItem.click();
    await sleep(250);

    const confirmBtn = document.querySelector('[data-mdc-dialog-action="ok"]');
    if (confirmBtn) confirmBtn.click();
  }

  // Listen for the result from content_main.js
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    
    if (data && data.__rrBlockerType === "RR_DELETE_RESULT") {
      if (data.success) {
        console.log("[RR Hotkey] Message deleted perfectly via network.");
        pendingDeleteTarget = null;
      } else {
        console.error("[RR Hotkey] Network delete failed, triggering fallback UI.");
        if (pendingDeleteTarget) {
          const target = pendingDeleteTarget;
          pendingDeleteTarget = null;
          deleteViaUI(target);
        }
      }
    }
  });

  // The Hotkey Trigger
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "Backspace") {
      e.preventDefault();
      
      const ownMessages = document.querySelectorAll('[data-is-viewer-message-creator="true"]');
      if (!ownMessages.length) return console.log("[RR Hotkey] No messages found.");
      
      const target = ownMessages[ownMessages.length - 1];
      pendingDeleteTarget = target; // Assigning the variable safely

      const messageId = target.getAttribute("data-message-id") || target.querySelector("[data-message-id]")?.getAttribute("data-message-id");
      const global = document.querySelector("[data-group-synthetic-id]");
      const spaceId = global ? (global.getAttribute("data-group-synthetic-id").split("/")[1] || global.getAttribute("data-group-synthetic-id")) : null;

      if (messageId && spaceId) {
        console.log(`[RR Hotkey] Sending signal for Msg: ${messageId}`);
        window.postMessage({ __rrBlockerType: "RR_DELETE_MESSAGE", messageId, spaceId }, "*");
      } else {
        console.log("[RR Hotkey] Missing IDs, clicking UI immediately.");
        deleteViaUI(target);
      }
    }
  }, true);
})();