(function () {
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    return;
  }

  var baseUrl =
    scriptTag.getAttribute("data-base-url") ||
    new URL(scriptTag.src, window.location.href).origin;
  var channelId = scriptTag.getAttribute("data-channel-id");
  var botId = scriptTag.getAttribute("data-bot-id");
  var publicKey = scriptTag.getAttribute("data-public-key");
  var title = scriptTag.getAttribute("data-title") || "Chat with us";
  var primaryColor = scriptTag.getAttribute("data-primary-color") || "#0f766e";
  var position = scriptTag.getAttribute("data-position") || "right";

  if (!channelId && !botId && !publicKey) {
    console.error(
      "[ReplyBase Webchat] Missing data-public-key, data-channel-id, or data-bot-id on script tag",
    );
    return;
  }

  var STORAGE_KEY_PREFIX = "replybase_webchat_session";
  var storageScope = publicKey || channelId || botId;
  var token = "";
  var conversationId = "";
  var visitorId = "";
  var isOpen = false;
  var isSending = false;
  var initialized = false;
  var lastTypingAt = 0;

  var root = document.createElement("div");
  root.id = "replybase-webchat-root";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  button.textContent = "Chat";

  var panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);

  var panelHeader = document.createElement("div");
  panelHeader.textContent = title;

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close chat");
  closeButton.textContent = "x";

  var messages = document.createElement("div");

  var composer = document.createElement("div");
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type your message...";
  input.autocomplete = "off";

  var sendButton = document.createElement("button");
  sendButton.type = "button";
  sendButton.textContent = "Send";

  var style = document.createElement("style");
  style.textContent = [
    "#replybase-webchat-root { position: fixed; bottom: 20px; z-index: 2147483647; font-family: 'Segoe UI', Tahoma, sans-serif; }",
    "#replybase-webchat-root[data-position='right'] { right: 20px; }",
    "#replybase-webchat-root[data-position='left'] { left: 20px; }",
    "#replybase-webchat-root * { box-sizing: border-box; }",
    "#replybase-webchat-root button { border: none; cursor: pointer; }",
    "#replybase-webchat-root .rb-button { width: 60px; height: 60px; border-radius: 999px; color: #fff; font-weight: 600; box-shadow: 0 12px 25px rgba(0,0,0,0.2); }",
    "#replybase-webchat-root .rb-panel { width: min(92vw, 360px); height: min(72vh, 520px); margin-bottom: 12px; border-radius: 14px; background: #fff; box-shadow: 0 18px 40px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.08); display: none; flex-direction: column; overflow: hidden; }",
    "#replybase-webchat-root .rb-panel.open { display: flex; }",
    "#replybase-webchat-root .rb-header { display: flex; align-items: center; justify-content: space-between; color: #fff; font-size: 14px; font-weight: 600; padding: 12px 14px; }",
    "#replybase-webchat-root .rb-close { background: transparent; color: #fff; font-size: 16px; padding: 0 6px; }",
    "#replybase-webchat-root .rb-messages { flex: 1; background: #f8fafc; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
    "#replybase-webchat-root .rb-message { max-width: 82%; padding: 9px 12px; border-radius: 12px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }",
    "#replybase-webchat-root .rb-message.user { align-self: flex-end; background: #0f172a; color: #fff; }",
    "#replybase-webchat-root .rb-message.bot { align-self: flex-start; background: #fff; color: #0f172a; border: 1px solid #e2e8f0; }",
    "#replybase-webchat-root .rb-composer { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff; }",
    "#replybase-webchat-root .rb-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 10px; font-size: 14px; outline: none; }",
    "#replybase-webchat-root .rb-input:focus { border-color: " +
      primaryColor +
      "; box-shadow: 0 0 0 3px rgba(15,118,110,0.15); }",
    "#replybase-webchat-root .rb-send { min-width: 64px; border-radius: 10px; color: #fff; font-weight: 600; }",
    "#replybase-webchat-root .rb-note { align-self: center; color: #64748b; font-size: 12px; }",
  ].join("\n");

  root.setAttribute("data-position", position === "left" ? "left" : "right");
  button.className = "rb-button";
  panel.className = "rb-panel";
  panelHeader.className = "rb-header";
  closeButton.className = "rb-close";
  messages.className = "rb-messages";
  composer.className = "rb-composer";
  input.className = "rb-input";
  sendButton.className = "rb-send";

  button.style.background = primaryColor;
  panelHeader.style.background = primaryColor;
  sendButton.style.background = primaryColor;

  panelHeader.appendChild(closeButton);
  composer.appendChild(input);
  composer.appendChild(sendButton);
  panel.appendChild(panelHeader);
  panel.appendChild(messages);
  panel.appendChild(composer);
  root.appendChild(style);
  root.appendChild(panel);
  root.appendChild(button);

  document.body.appendChild(root);

  function getStoredSession() {
    try {
      var raw = window.localStorage.getItem(
        STORAGE_KEY_PREFIX + ":" + storageScope,
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStoredSession(nextSession) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + ":" + storageScope,
        JSON.stringify(nextSession),
      );
    } catch {
      // Ignore storage write issues.
    }
  }

  function addMessage(kind, text) {
    var bubble = document.createElement("div");
    bubble.className = "rb-message " + kind;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function addSystemNote(text) {
    var note = document.createElement("div");
    note.className = "rb-note";
    note.textContent = text;
    messages.appendChild(note);
    messages.scrollTop = messages.scrollHeight;
  }

  function normalizeResponseTexts(responseBody) {
    if (!responseBody || !Array.isArray(responseBody.responses)) {
      return [];
    }

    return responseBody.responses
      .filter(function (item) {
        return item && item.type === "text" && typeof item.text === "string";
      })
      .map(function (item) {
        return item.text;
      });
  }

  function request(path, method, payload) {
    var options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (payload) {
      options.body = JSON.stringify(payload);
    }

    return fetch(baseUrl + path, options).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var message = (data && data.error) || "Request failed";
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function initializeSession() {
    if (initialized && token) {
      return Promise.resolve();
    }

    var existing = getStoredSession();
    var payload = {
      publicKey: publicKey || undefined,
      channelId: channelId || undefined,
      botId: botId || undefined,
      origin: window.location.origin,
      visitorId:
        existing && existing.visitorId ? existing.visitorId : undefined,
      metadata: {
        url: window.location.href,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
      },
    };

    return request("/api/webchat/init", "POST", payload).then(function (data) {
      token = data.token;
      conversationId = data.conversationId;
      visitorId = data.visitorId;
      initialized = true;
      setStoredSession({
        token: token,
        conversationId: conversationId,
        visitorId: visitorId,
      });
    });
  }

  function trackEvent(type, payload) {
    if (!token) {
      return Promise.resolve();
    }

    return request("/api/webchat/events", "POST", {
      token: token,
      type: type,
      payload: payload || {},
    }).catch(function () {
      return null;
    });
  }

  function loadConfig() {
    var query = publicKey
      ? "publicKey=" + encodeURIComponent(publicKey)
      : channelId
        ? "channelId=" + encodeURIComponent(channelId)
        : "botId=" + encodeURIComponent(botId);

    return request("/api/webchat/config?" + query, "GET").then(function (data) {
      var cfg = data.config || {};
      if (typeof cfg.title === "string" && cfg.title.trim()) {
        panelHeader.firstChild.nodeValue = cfg.title.trim();
      }
      if (typeof cfg.primaryColor === "string" && cfg.primaryColor.trim()) {
        primaryColor = cfg.primaryColor.trim();
        button.style.background = primaryColor;
        panelHeader.style.background = primaryColor;
        sendButton.style.background = primaryColor;
      }
      if (typeof cfg.welcomeMessage === "string" && cfg.welcomeMessage.trim()) {
        addMessage("bot", cfg.welcomeMessage.trim());
      }
    });
  }

  function sendMessage() {
    if (isSending) {
      return;
    }

    var text = input.value.trim();
    if (!text) {
      return;
    }

    input.value = "";
    addMessage("user", text);
    isSending = true;
    sendButton.disabled = true;

    request("/api/webchat/message", "POST", {
      token: token,
      message: text,
    })
      .then(function (data) {
        var texts = normalizeResponseTexts(data);
        if (!texts.length) {
          addSystemNote("No response received");
          return;
        }
        texts.forEach(function (entry) {
          addMessage("bot", entry);
        });
      })
      .catch(function (err) {
        trackEvent("ERROR", {
          stage: "message",
          reason: err && err.message ? err.message : "Message failed",
        });
        addSystemNote(err && err.message ? err.message : "Message failed");
      })
      .finally(function () {
        isSending = false;
        sendButton.disabled = false;
      });
  }

  function openPanel() {
    panel.classList.add("open");
    button.style.display = "none";
    isOpen = true;
    if (!initialized) {
      initializeSession()
        .then(loadConfig)
        .then(function () {
          return trackEvent("OPEN", {
            url: window.location.href,
          });
        })
        .catch(function (err) {
          addSystemNote(
            err && err.message ? err.message : "Unable to start chat",
          );
        });
    } else {
      trackEvent("OPEN", {
        url: window.location.href,
      });
    }
  }

  function closePanel() {
    panel.classList.remove("open");
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    isOpen = false;
    trackEvent("CLOSE", {
      url: window.location.href,
    });
  }

  button.addEventListener("click", function () {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  closeButton.addEventListener("click", closePanel);
  sendButton.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
      return;
    }

    var now = Date.now();
    if (now - lastTypingAt > 3000) {
      lastTypingAt = now;
      trackEvent("TYPING", {
        url: window.location.href,
      });
    }
  });
})();
