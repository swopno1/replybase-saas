(function () {
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    return;
  }

  function parseBooleanAttribute(value, defaultValue) {
    if (value === null || value === undefined || value === "") {
      return defaultValue;
    }

    var normalized = String(value).toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }

    return defaultValue;
  }

  function parseCsvAttribute(value) {
    if (!value) {
      return [];
    }

    return String(value)
      .split(",")
      .map(function (entry) {
        return entry.trim();
      })
      .filter(Boolean);
  }

  function normalizeEventType(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  function resolveWindowPath(path) {
    if (!path) {
      return undefined;
    }

    return String(path)
      .split(".")
      .reduce(function (current, key) {
        if (!current || typeof current !== "object") {
          return undefined;
        }
        return current[key];
      }, window);
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
  var telemetryMode = scriptTag.getAttribute("data-telemetry") || "all";
  var telemetryEvents = parseCsvAttribute(
    scriptTag.getAttribute("data-telemetry-events"),
  ).map(normalizeEventType);
  var cookieConsentMode =
    scriptTag.getAttribute("data-cookie-consent") || "off";
  var cookieConsentCheck =
    scriptTag.getAttribute("data-cookie-consent-check") || "";
  var cookieConsentEvent =
    scriptTag.getAttribute("data-cookie-consent-event") ||
    "replybase:webchat-consent-updated";
  var mobileMode = scriptTag.getAttribute("data-mobile-mode") || "auto";

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
  var initChallengeToken = "";
  var unreadCount = 0;
  var telemetryConfig = null;
  var isOpen = false;
  var isSending = false;
  var initialized = false;
  var lastTypingAt = 0;
  var widgetBootedAt = Date.now();
  var shouldUseMobileFullscreen = false;
  var consentNoticeRendered = false;

  var root = document.createElement("div");
  root.id = "replybase-webchat-root";
  var shadow = root.attachShadow({ mode: "open" });

  var container = document.createElement("div");
  container.className = "rb-container";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  button.className = "rb-button";

  var buttonLabel = document.createElement("span");
  buttonLabel.className = "rb-button-label";
  buttonLabel.textContent = "Chat";

  var unreadBadge = document.createElement("span");
  unreadBadge.className = "rb-unread-badge";
  unreadBadge.hidden = true;

  var panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);
  panel.className = "rb-panel";

  var panelHeader = document.createElement("div");
  panelHeader.className = "rb-header";

  var panelTitle = document.createElement("span");
  panelTitle.className = "rb-title";
  panelTitle.textContent = title;

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close chat");
  closeButton.textContent = "x";
  closeButton.className = "rb-close";

  var messages = document.createElement("div");
  messages.className = "rb-messages";

  var composer = document.createElement("div");
  composer.className = "rb-composer";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type your message...";
  input.autocomplete = "off";
  input.className = "rb-input";

  var sendButton = document.createElement("button");
  sendButton.type = "button";
  sendButton.textContent = "Send";
  sendButton.className = "rb-send";

  var style = document.createElement("style");
  style.textContent = [
    ":host { position: fixed; bottom: 20px; z-index: 2147483647; font-family: 'Segoe UI', Tahoma, sans-serif; }",
    ":host([data-position='right']) { right: 20px; }",
    ":host([data-position='left']) { left: 20px; }",
    ":host([data-open='true'][data-mobile-fullscreen='true']) { inset: 0; right: 0; left: 0; bottom: 0; top: 0; }",
    ".rb-container, .rb-container * { box-sizing: border-box; }",
    ".rb-container { display: flex; flex-direction: column; align-items: stretch; }",
    ".rb-container button { border: none; cursor: pointer; }",
    ".rb-button { position: relative; width: 60px; height: 60px; border-radius: 999px; color: #fff; font-weight: 600; box-shadow: 0 12px 25px rgba(0,0,0,0.2); display: inline-flex; align-items: center; justify-content: center; align-self: flex-end; }",
    ".rb-unread-badge { position: absolute; top: -4px; right: -4px; min-width: 22px; height: 22px; border-radius: 999px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; box-shadow: 0 8px 18px rgba(239,68,68,0.32); }",
    ".rb-panel { width: min(92vw, 360px); height: min(72vh, 520px); margin-bottom: 12px; border-radius: 14px; background: #fff; box-shadow: 0 18px 40px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.08); display: none; flex-direction: column; overflow: hidden; }",
    ".rb-panel.open { display: flex; }",
    ".rb-header { display: flex; align-items: center; justify-content: space-between; color: #fff; font-size: 14px; font-weight: 600; padding: 12px 14px; }",
    ".rb-title { display: inline-flex; align-items: center; gap: 8px; }",
    ".rb-close { background: transparent; color: #fff; font-size: 16px; padding: 0 6px; }",
    ".rb-messages { flex: 1; background: #f8fafc; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
    ".rb-message { max-width: 82%; padding: 9px 12px; border-radius: 12px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }",
    ".rb-message.user { align-self: flex-end; background: #0f172a; color: #fff; }",
    ".rb-message.bot { align-self: flex-start; background: #fff; color: #0f172a; border: 1px solid #e2e8f0; }",
    ".rb-composer { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff; }",
    ".rb-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 10px; font-size: 14px; outline: none; }",
    ".rb-input:focus { border-color: " +
      primaryColor +
      "; box-shadow: 0 0 0 3px rgba(15,118,110,0.15); }",
    ".rb-send { min-width: 64px; border-radius: 10px; color: #fff; font-weight: 600; }",
    ".rb-note { align-self: center; color: #64748b; font-size: 12px; text-align: center; }",
    ".rb-note.is-consent { border: 1px dashed #f59e0b; background: #fffbeb; color: #92400e; padding: 12px; border-radius: 12px; width: 100%; }",
    ".rb-consent-button { align-self: center; border-radius: 10px; padding: 10px 14px; background: #f59e0b; color: #fff; font-weight: 600; }",
    ":host([data-open='true'][data-mobile-fullscreen='true']) .rb-container { height: 100%; }",
    ":host([data-open='true'][data-mobile-fullscreen='true']) .rb-panel { display: flex; width: 100%; height: 100%; margin-bottom: 0; border-radius: 0; border: none; box-shadow: none; }",
    ":host([data-open='true'][data-mobile-fullscreen='true']) .rb-button { display: none; }",
  ].join("\n");

  root.setAttribute("data-position", position === "left" ? "left" : "right");
  root.setAttribute("data-open", "false");
  root.setAttribute("data-mobile-fullscreen", "false");

  button.style.background = primaryColor;
  panelHeader.style.background = primaryColor;
  sendButton.style.background = primaryColor;

  button.appendChild(buttonLabel);
  button.appendChild(unreadBadge);
  panelHeader.appendChild(panelTitle);
  panelHeader.appendChild(closeButton);
  composer.appendChild(input);
  composer.appendChild(sendButton);
  panel.appendChild(panelHeader);
  panel.appendChild(messages);
  panel.appendChild(composer);
  container.appendChild(panel);
  container.appendChild(button);

  shadow.appendChild(style);
  shadow.appendChild(container);

  document.body.appendChild(root);

  function syncMobileMode() {
    if (mobileMode === "windowed") {
      shouldUseMobileFullscreen = false;
    } else if (mobileMode === "fullscreen") {
      shouldUseMobileFullscreen = true;
    } else {
      shouldUseMobileFullscreen =
        window.matchMedia("(max-width: 640px)").matches;
    }

    root.setAttribute(
      "data-mobile-fullscreen",
      shouldUseMobileFullscreen ? "true" : "false",
    );
  }

  syncMobileMode();
  window.addEventListener("resize", syncMobileMode);

  function resolveCookieConsent() {
    if (cookieConsentMode === "off") {
      return true;
    }

    var explicitResolver = resolveWindowPath(cookieConsentCheck);
    if (typeof explicitResolver === "function") {
      try {
        return Boolean(explicitResolver());
      } catch {
        return false;
      }
    }
    if (typeof explicitResolver === "boolean") {
      return explicitResolver;
    }

    if (
      window.ReplyBaseWebchatConsent &&
      typeof window.ReplyBaseWebchatConsent.hasConsent === "function"
    ) {
      try {
        return Boolean(window.ReplyBaseWebchatConsent.hasConsent());
      } catch {
        return false;
      }
    }

    if (window.ReplyBaseWebchatConsentGranted === true) {
      return true;
    }
    if (window.replybaseWebchatConsentGranted === true) {
      return true;
    }

    return false;
  }

  function canUsePersistentStorage() {
    return resolveCookieConsent();
  }

  function normalizeTelemetrySettingsFromConfig(config) {
    if (!config || typeof config !== "object") {
      return;
    }

    if (typeof config.telemetry === "string" && telemetryMode === "all") {
      telemetryMode = config.telemetry;
    }

    if (Array.isArray(config.telemetryEvents) && telemetryEvents.length === 0) {
      telemetryEvents = config.telemetryEvents
        .map(normalizeEventType)
        .filter(Boolean);
    }

    if (typeof config.mobileMode === "string" && mobileMode === "auto") {
      mobileMode = config.mobileMode;
      syncMobileMode();
    }
  }

  function isTelemetryEnabled(type) {
    if (telemetryMode === "off") {
      return false;
    }

    if (cookieConsentMode === "required" && !resolveCookieConsent()) {
      return false;
    }

    var normalizedType = normalizeEventType(type);
    if (telemetryMode === "essential") {
      return normalizedType === "ERROR";
    }

    if (telemetryEvents.length > 0) {
      return telemetryEvents.indexOf(normalizedType) >= 0;
    }

    return true;
  }

  function updateUnreadBadge() {
    unreadBadge.hidden = unreadCount <= 0;
    unreadBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  }

  function resetUnreadCount() {
    unreadCount = 0;
    updateUnreadBadge();
  }

  function setComposerDisabled(disabled) {
    input.disabled = disabled;
    sendButton.disabled = disabled || isSending;
  }

  function renderConsentNotice() {
    if (consentNoticeRendered) {
      return;
    }

    messages.innerHTML = "";
    var note = document.createElement("div");
    note.className = "rb-note is-consent";
    note.textContent =
      "Cookie consent is required before webchat can store session data or connect to the ReplyBase runtime.";
    messages.appendChild(note);

    var action = document.createElement("button");
    action.type = "button";
    action.className = "rb-consent-button";
    action.textContent = "Retry After Consent";
    action.addEventListener("click", function () {
      consentNoticeRendered = false;
      messages.innerHTML = "";
      openPanel();
    });
    messages.appendChild(action);
    consentNoticeRendered = true;
  }

  function clearConsentNotice() {
    if (!consentNoticeRendered) {
      return;
    }

    messages.innerHTML = "";
    consentNoticeRendered = false;
  }

  window.addEventListener(cookieConsentEvent, function () {
    if (resolveCookieConsent()) {
      clearConsentNotice();
      setComposerDisabled(false);
      if (isOpen && !initialized) {
        openPanel();
      }
    }
  });

  function getStoredSession() {
    if (!canUsePersistentStorage()) {
      return null;
    }

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
    if (!canUsePersistentStorage()) {
      return;
    }

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

    if (kind === "bot" && !isOpen) {
      unreadCount += 1;
      updateUnreadBadge();
    }
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

  function buildRuntimeMetadata() {
    var url = null;
    try {
      url = new URL(window.location.href);
    } catch {
      url = null;
    }

    return {
      pageUrl: url ? url.toString() : window.location.href,
      referrer: document.referrer || null,
      locale: navigator.language || null,
      pageTitle: document.title || null,
      userAgent: navigator.userAgent,
      origin: window.location.origin,
      utmSource: url ? url.searchParams.get("utm_source") : null,
      utmMedium: url ? url.searchParams.get("utm_medium") : null,
      utmCampaign: url ? url.searchParams.get("utm_campaign") : null,
      utmTerm: url ? url.searchParams.get("utm_term") : null,
      utmContent: url ? url.searchParams.get("utm_content") : null,
    };
  }

  function buildBotSignals() {
    return {
      honeypot: "",
      elapsedMs: Math.max(Date.now() - widgetBootedAt, 0),
    };
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

    if (!initChallengeToken) {
      return Promise.reject(new Error("Missing init challenge"));
    }

    var existing = getStoredSession();
    var payload = {
      publicKey: publicKey || undefined,
      channelId: channelId || undefined,
      botId: botId || undefined,
      initChallenge: initChallengeToken,
      origin: window.location.origin,
      visitorId:
        existing && existing.visitorId ? existing.visitorId : undefined,
      metadata: {
        url: window.location.href,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
        locale: navigator.language || null,
        pageTitle: document.title || null,
        utmSource: buildRuntimeMetadata().utmSource,
        utmMedium: buildRuntimeMetadata().utmMedium,
        utmCampaign: buildRuntimeMetadata().utmCampaign,
        utmTerm: buildRuntimeMetadata().utmTerm,
        utmContent: buildRuntimeMetadata().utmContent,
      },
      botSignals: buildBotSignals(),
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
    if (!token || !isTelemetryEnabled(type)) {
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
      if (typeof data.publicKey === "string" && data.publicKey.trim()) {
        publicKey = data.publicKey.trim();
      }
      if (
        data.initChallenge &&
        typeof data.initChallenge.token === "string" &&
        data.initChallenge.token.trim()
      ) {
        initChallengeToken = data.initChallenge.token.trim();
      }

      telemetryConfig = data.telemetry || telemetryConfig;

      var cfg = data.config || {};
      normalizeTelemetrySettingsFromConfig(cfg);
      if (typeof cfg.title === "string" && cfg.title.trim()) {
        panelTitle.textContent = cfg.title.trim();
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

    trackEvent("MESSAGE", {
      url: window.location.href,
      direction: "outbound",
      messageLength: text.length,
    });

    request("/api/webchat/message", "POST", {
      token: token,
      message: text,
      metadata: buildRuntimeMetadata(),
      botSignals: buildBotSignals(),
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
          url: window.location.href,
          stage: "message",
          reason: "request_failed",
          message: err && err.message ? err.message : "Message failed",
        });
        addSystemNote(err && err.message ? err.message : "Message failed");
      })
      .finally(function () {
        isSending = false;
        sendButton.disabled = false;
      });
  }

  function openPanel() {
    if (cookieConsentMode === "required" && !resolveCookieConsent()) {
      panel.classList.add("open");
      button.style.display = "none";
      root.setAttribute("data-open", "true");
      isOpen = true;
      setComposerDisabled(true);
      renderConsentNotice();
      return;
    }

    clearConsentNotice();
    setComposerDisabled(false);
    panel.classList.add("open");
    button.style.display = "none";
    root.setAttribute("data-open", "true");
    isOpen = true;
    resetUnreadCount();
    if (!initialized) {
      loadConfig()
        .then(function () {
          return initializeSession();
        })
        .then(function () {
          return trackEvent("OPEN", {
            url: window.location.href,
            trigger: "launcher",
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
        trigger: "launcher",
      });
    }
  }

  function closePanel(trigger) {
    panel.classList.remove("open");
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    root.setAttribute("data-open", "false");
    isOpen = false;
    trackEvent("CLOSE", {
      url: window.location.href,
      trigger: trigger || "launcher",
    });
  }

  button.addEventListener("click", function () {
    if (isOpen) {
      closePanel("launcher");
    } else {
      openPanel();
    }
  });

  closeButton.addEventListener("click", function () {
    closePanel("header_close");
  });
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
        inputLength: input.value.trim().length,
      });
    }
  });
})();
