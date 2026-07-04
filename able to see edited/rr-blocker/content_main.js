// Runs in the PAGE's own JS context (world: "MAIN"), before user interaction
// triggers any read-marking request. Confirmed technique (reverse-engineered
// from a working reference extension): Google Chat marks a conversation as
// read via a POST request that is either:
//   1. a batched RPC call whose URL contains "rpcids=", or
//   2. a direct call to an endpoint containing "api/mark_group_readstate"
// While the blocker is enabled, we intercept those specific POST requests
// (both XHR, which Chat primarily uses, and fetch, as a safety net) and
// redirect them to a dead URL so they never reach Google's servers. Chat
// still renders messages normally — only the outgoing "I read this" signal
// is dropped.
//
// Note: "rpcids=" is a shared endpoint for several Chat actions (not just
// read state), so other actions may be affected while this is ON. Turn it
// off again once you're done reading if you need full functionality.

(function () {
  const STATE_KEY = "__rrBlockerEnabled";
  window[STATE_KEY] = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__rrBlockerType === "RR_SET_STATE") {
      window[STATE_KEY] = !!data.enabled;
    }
  });

  function isEnabled() {
    return !!window[STATE_KEY];
  }

  const MARKERS = ["rpcids=", "api/mark_group_readstate"];

  function shouldBlock(url) {
    if (typeof url !== "string") return false;
    return MARKERS.some((m) => url.includes(m));
  }

  // --- XMLHttpRequest ---
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    const isPost = typeof method === "string" && method.toLowerCase() === "post";
    if (isEnabled() && isPost && shouldBlock(url)) {
      // Reroute to a dead URL instead of the real endpoint. The request
      // still "opens" successfully (so app code doesn't throw), it just
      // never reaches Google's servers.
      return realOpen.call(this, method, null, ...rest);
    }
    return realOpen.apply(this, arguments);
  };

  // --- fetch (safety net, in case any relevant call uses fetch instead) ---
  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input && input.url;
      const method = ((init && init.method) || (input && input.method) || "GET").toLowerCase();

      // Capture headers regardless of whether we block this request — this
      // is how we passively learn the CSRF token etc. for later direct calls.
      if (typeof Request !== "undefined" && input instanceof Request) {
        captureHeadersFromHeadersLike(input.headers);
      }
      captureHeadersFromHeadersLike(init && init.headers);

      if (isEnabled() && method === "post" && shouldBlock(url)) {
        return Promise.reject(new TypeError("Blocked by Read Receipt Blocker"));
      }
    } catch (e) {
      // fall through to real fetch on any unexpected shape
    }
    return realFetch.apply(this, arguments);
  };

  // ============================================================
  // Direct delete-message support (bypasses the confirm dialog)
  // ============================================================
  // We can't fire an authenticated delete_message call cold — it needs a
  // rotating x-framework-xsrf-token that only Chat's own JS knows. So
  // instead we passively watch every header Chat's real XHR calls set, and
  // cache the relevant ones. By the time the hotkey is pressed, Chat has
  // almost certainly already made background requests (polling, presence,
  // etc.), so the cache should be warm.
  const HEADER_CACHE = {};
  const TRACKED_HEADERS = ["x-framework-xsrf-token", "x-goog-chat-space-id", "x-goog-ext-353267353-bin"];

  const realSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    const key = String(name).toLowerCase();
    if (TRACKED_HEADERS.includes(key)) {
      HEADER_CACHE[key] = value;
      console.log("[RR Header Cache] captured (XHR)", key, "=", value);
    }
    return realSetRequestHeader.apply(this, arguments);
  };

  function captureHeadersFromHeadersLike(headersLike) {
    if (!headersLike) return;
    try {
      if (typeof Headers !== "undefined" && headersLike instanceof Headers) {
        headersLike.forEach((value, key) => {
          const k = key.toLowerCase();
          if (TRACKED_HEADERS.includes(k)) {
            HEADER_CACHE[k] = value;
            console.log("[RR Header Cache] captured (fetch/Headers)", k, "=", value);
          }
        });
      } else if (Array.isArray(headersLike)) {
        headersLike.forEach((pair) => {
          const k = String(pair[0]).toLowerCase();
          if (TRACKED_HEADERS.includes(k)) {
            HEADER_CACHE[k] = pair[1];
            console.log("[RR Header Cache] captured (fetch/array)", k, "=", pair[1]);
          }
        });
      } else if (typeof headersLike === "object") {
        Object.keys(headersLike).forEach((key) => {
          const k = key.toLowerCase();
          if (TRACKED_HEADERS.includes(k)) {
            HEADER_CACHE[k] = headersLike[key];
            console.log("[RR Header Cache] captured (fetch/object)", k, "=", headersLike[key]);
          }
        });
      }
    } catch (e) {
      // ignore malformed headers input
    }
  }

  // Exact payload shape captured from a real delete request, with the
  // message ID and space ID swapped for placeholder tokens so we can
  // substitute real values without guessing at the schema.
  const DELETE_BODY_TEMPLATE =
    '[[[null,null,null,[null,"__MSG_ID__",[null,null,["__SPACE_ID__"]]]],"__MSG_ID__"],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[0,7,1,"en",[null,null,null,null,2,2,null,2,2,2,2,null,null,null,null,2,2,2,2,2,2,2,2,2,2,2,2,2,2,null,null,2,2,null,null,null,2,2,null,null,null,null,2,2,2,2,null,2,null,null,2,null,2,2,2,2,null,2,null,2,2,2,null,null,2,2,2,null,2,2]]]';

  function fireDeleteMessage(messageId, spaceIdOverride) {
    return new Promise((resolve, reject) => {
      const spaceId = spaceIdOverride || HEADER_CACHE["x-goog-chat-space-id"];
      if (!spaceId) {
        reject(new Error("No space ID cached yet — interact with Chat a moment, then try again."));
        return;
      }
      if (!HEADER_CACHE["x-framework-xsrf-token"]) {
        reject(new Error("No CSRF token cached yet — interact with Chat a moment, then try again."));
        return;
      }

      const c = Math.floor(Math.random() * 900) + 100;
      const xhr = new XMLHttpRequest();
      realOpen.call(xhr, "POST", `https://chat.google.com/u/0/api/delete_message?c=${c}`, true);
      xhr.setRequestHeader("content-type", "application/json");
      xhr.setRequestHeader("x-framework-xsrf-token", HEADER_CACHE["x-framework-xsrf-token"]);
      xhr.setRequestHeader("x-goog-chat-space-id", spaceId);
      if (HEADER_CACHE["x-goog-ext-353267353-bin"]) {
        xhr.setRequestHeader("x-goog-ext-353267353-bin", HEADER_CACHE["x-goog-ext-353267353-bin"]);
      }
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new Error("Network error firing delete request"));

      const body = DELETE_BODY_TEMPLATE.split("__MSG_ID__").join(messageId).split("__SPACE_ID__").join(spaceId);
      xhr.send(body);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__rrBlockerType === "RR_DELETE_MESSAGE") {
      console.log("[RR Hotkey MAIN] delete request received for", data.messageId, "cache:", HEADER_CACHE);
      fireDeleteMessage(data.messageId, data.spaceId)
        .then((res) => {
          console.log("[RR Hotkey MAIN] delete response", res.status, res.body);
          window.postMessage(
            { __rrBlockerType: "RR_DELETE_RESULT", success: res.status >= 200 && res.status < 300, status: res.status, body: res.body },
            "*"
          );
        })
        .catch((err) => {
          console.log("[RR Hotkey MAIN] delete failed", err.message);
          window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: false, error: err.message }, "*");
        });
    }
  });
})();
