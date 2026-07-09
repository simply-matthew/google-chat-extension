// content_main.js
(function () {
  // --- INTERCEPTION FEATURE ---
  const STATE_KEY = "__rrBlockerEnabled";
  window[STATE_KEY] = false;
  let lastToggleTime = 0;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__rrBlockerType === "RR_SET_STATE") {
      window[STATE_KEY] = !!data.enabled;
      lastToggleTime = Date.now();
    }
  });

  function isEnabled() {
    return !!window[STATE_KEY] || (Date.now() - lastToggleTime) < 2000;
  }

  const MARKERS = ["rpcids=", "api/mark_group_readstate"];
  function shouldBlock(url) {
    return typeof url === "string" && MARKERS.some((m) => url.includes(m));
  }

  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    const isPost = typeof method === "string" && method.toLowerCase() === "post";
    if (isEnabled() && isPost && shouldBlock(url)) {
      return realOpen.call(this, method, null, ...rest);
    }
    return realOpen.apply(this, arguments);
  };

  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input && input.url;
      const method = ((init && init.method) || (input && input.method) || "GET").toLowerCase();
      if (typeof Request !== "undefined" && input instanceof Request) {
        captureHeadersFromHeadersLike(input.headers);
      }
      captureHeadersFromHeadersLike(init && init.headers);
      if (isEnabled() && method === "post" && shouldBlock(url)) {
        return Promise.reject(new TypeError("Blocked by Read Receipt Blocker"));
      }
    } catch (e) {}
    return realFetch.apply(this, arguments);
  };
  // --- END INTERCEPTION FEATURE ---

  const HEADER_CACHE = {};
  const TRACKED_HEADERS = ["x-framework-xsrf-token", "x-goog-chat-space-id", "x-goog-ext-353267353-bin"];

  const realSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    const key = String(name).toLowerCase();
    if (TRACKED_HEADERS.includes(key)) { HEADER_CACHE[key] = value; }
    return realSetRequestHeader.apply(this, arguments);
  };

  function captureHeadersFromHeadersLike(headersLike) {
    if (!headersLike) return;
    try {
      if (typeof Headers !== "undefined" && headersLike instanceof Headers) {
        headersLike.forEach((value, key) => {
          const k = key.toLowerCase();
          if (TRACKED_HEADERS.includes(k)) { HEADER_CACHE[k] = value; }
        });
      } else if (typeof headersLike === "object") {
        Object.keys(headersLike).forEach((key) => {
          const k = key.toLowerCase();
          if (TRACKED_HEADERS.includes(k)) { HEADER_CACHE[k] = headersLike[key]; }
        });
      }
    } catch (e) {}
  }

  const DELETE_BODY_TEMPLATE = '[[[null,null,null,[null,"__MSG_ID__",[null,null,["__SPACE_ID__"]]]],"__MSG_ID__"],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[0,7,1,"en",[null,null,null,null,2,2,null,2,2,2,2,null,null,null,null,2,2,2,2,2,2,2,2,2,2,2,2,2,2,null,null,2,2,null,null,null,2,2,null,null,null,null,2,2,2,2,null,2,null,null,2,null,2,2,2,2,null,2,null,2,2,2,null,null,2,2,2,null,2,2]]]';

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__rrBlockerType === "RR_DELETE_MESSAGE") {
      const spaceId = data.spaceId || HEADER_CACHE["x-goog-chat-space-id"];
      const token = HEADER_CACHE["x-framework-xsrf-token"];
      if (!spaceId || !token) {
        window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: false, error: "No cache yet." }, "*");
        return;
      }
      const xhr = new XMLHttpRequest();
      realOpen.call(xhr, "POST", `https://chat.google.com/u/0/api/delete_message?c=${Math.floor(Math.random() * 900) + 100}`, true);
      xhr.setRequestHeader("content-type", "application/json");
      xhr.setRequestHeader("x-framework-xsrf-token", token);
      xhr.setRequestHeader("x-goog-chat-space-id", spaceId);
      if (HEADER_CACHE["x-goog-ext-353267353-bin"]) xhr.setRequestHeader("x-goog-ext-353267353-bin", HEADER_CACHE["x-goog-ext-353267353-bin"]);
      xhr.onload = () => window.postMessage({ __rrBlockerType: "RR_DELETE_RESULT", success: xhr.status >= 200 && xhr.status < 300 }, "*");
      xhr.send(DELETE_BODY_TEMPLATE.split("__MSG_ID__").join(data.messageId).split("__SPACE_ID__").join(spaceId));
    }
  });
})();