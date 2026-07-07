// content_main.js
(function () {
  const HEADER_CACHE = {};
  const SKIP_ON_REPLAY = new Set(["content-type", "content-length", "host", "connection", "cookie", "origin", "user-agent", "accept-encoding"]);

  // 1. Passively capture headers from XHR
  const realSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    const key = String(name).toLowerCase();
    HEADER_CACHE[key] = value;
    return realSetRequestHeader.apply(this, arguments);
  };

  const DELETE_BODY_TEMPLATE = '[[[null,null,null,[null,"__MSG_ID__",[null,null,["__SPACE_ID__"]]]],"__MSG_ID__"],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[0,7,1,"en",[null,null,null,null,2,2,null,2,2,2,2,null,null,null,null,2,2,2,2,2,2,2,2,2,2,2,2,2,2,null,null,2,2,null,null,null,2,2,null,null,null,null,2,2,2,2,null,2,null,null,2,null,2,2,2,2,null,2,null,2,2,2,null,null,2,2,2,null,2,2]]]';

  // 2. Listen for hotkey command
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    
    if (data && data.__rrBlockerType === "RR_DELETE_MESSAGE") {
      console.log("[RR Main] Firing delete request for:", data.messageId);
      
      const spaceId = data.spaceId;
      const token = HEADER_CACHE["x-framework-xsrf-token"];

      if (!token) {
        window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: false, error: "No XSRF token in cache. Click a message first." }, "*");
        return;
      }

      const c = Math.floor(Math.random() * 900) + 100;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://chat.google.com/u/0/api/delete_message?c=${c}`, true);
      xhr.setRequestHeader("content-type", "application/json");
      xhr.setRequestHeader("x-framework-xsrf-token", token);
      xhr.setRequestHeader("x-goog-chat-space-id", spaceId);

      // Replay custom google headers
      for (const [key, value] of Object.entries(HEADER_CACHE)) {
        if (!SKIP_ON_REPLAY.has(key) && key !== "x-framework-xsrf-token" && key !== "x-goog-chat-space-id") {
          try { xhr.setRequestHeader(key, value); } catch (e) {}
        }
      }

      xhr.onload = () => {
        const success = xhr.status >= 200 && xhr.status < 300;
        window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: success, status: xhr.status }, "*");
      };
      
      xhr.onerror = () => window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: false, error: "Network Error" }, "*");

      // Safe string replacement prevents Syntax Errors
      const body = DELETE_BODY_TEMPLATE.split("__MSG_ID__").join(data.messageId).split("__SPACE_ID__").join(spaceId);
      xhr.send(body);
    }
  });
})();