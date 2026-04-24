(function () {
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    return;
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
  var agentReplyPollTimer = null;
  var lastHumanReplyCursor = "";
  var seenHumanMessageIds = Object.create(null);
  var pendingMessages = [];

  var addMessage = function (kind, text) {
    pendingMessages.push({ kind: kind, text: text });
    if ((kind === "bot" || kind === "agent") && !isOpen) {
      unreadCount += 1;
    }
  };

  var addSystemNote = function (text) {
    pendingMessages.push({ kind: "system", text: text });
  };

  // Only render the widget after config and session are ready
  function renderWidget() {
    var botTypingIndicator = null;
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
      ".rb-message.agent { align-self: flex-start; background: #e0f2fe; color: #0c4a6e; border: 1px solid #bae6fd; }",
      ".rb-composer { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff; }",
      ".rb-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 10px; font-size: 14px; outline: none; }",
      ".rb-input:focus { border-color: " +
      primaryColor +
      "; box-shadow: 0 0 0 3px rgba(15,118,110,0.15); }",
      ".rb-send { min-width: 64px; border-radius: 10px; color: #fff; font-weight: 600; }",
      ".rb-note { align-self: center; color: #64748b; font-size: 12px; text-align: center; }",
      ".rb-typing { align-self: flex-start; color: #64748b; font-size: 12px; font-style: italic; }",
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

    // --- Inner functions that need DOM access ---

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

    // Re-define addMessage and addSystemNote to use the DOM
    addMessage = function (kind, text) {
      var bubble = document.createElement("div");
      bubble.className = "rb-message " + kind;
      bubble.textContent = text;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;

      if ((kind === "bot" || kind === "agent") && !isOpen) {
        unreadCount += 1;
        updateUnreadBadge();
      }
    };

    addSystemNote = function (text) {
      var note = document.createElement("div");
      note.className = "rb-note";
      note.textContent = text;
      messages.appendChild(note);
      messages.scrollTop = messages.scrollHeight;
    };

    function showBotTyping() {
      if (botTypingIndicator) {
        return;
      }

      botTypingIndicator = document.createElement("div");
      botTypingIndicator.className = "rb-typing";
      botTypingIndicator.textContent = "Agent is typing...";
      messages.appendChild(botTypingIndicator);
      messages.scrollTop = messages.scrollHeight;
    }

    function hideBotTyping() {
      if (!botTypingIndicator) {
        return;
      }

      if (botTypingIndicator.parentNode === messages) {
        messages.removeChild(botTypingIndicator);
      }

      botTypingIndicator = null;
    }

    function renderResponseEntries(entries) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return Promise.resolve();
      }

      var chain = Promise.resolve();

      entries.forEach(function (entry) {
        chain = chain.then(function () {
          if (!entry || typeof entry.type !== "string") {
            return;
          }

          if (entry.type === "typing") {
            showBotTyping();
            return delay(entry.durationMs || 0).then(function () {
              hideBotTyping();
            });
          }

          hideBotTyping();
          if (entry.type === "text" && typeof entry.text === "string") {
            addMessage("bot", entry.text);
          }
        });
      });

      return chain.finally(function () {
        hideBotTyping();
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

      if (!conversationId || !botId || !token) {
        addSystemNote(
          "Please wait for chat to fully load before sending a message.",
        );
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

      // Track with Plausible if available
      if (typeof window.plausible === "function") {
        window.plausible("Webchat Message Sent", {
          props: {
            url: window.location.href,
            messageLength: text.length,
          },
        });
      }

      request("/api/webchat/message", "POST", {
        token: token,
        conversationId: conversationId,
        botId: botId,
        message: text,
        planName: window.ReplyBaseWebchatPlanName || "pro",
        metadata: buildRuntimeMetadata(),
        botSignals: buildBotSignals(),
      })
        .then(function (data) {
          var entries = normalizeResponseEntries(data);
          if (!entries.length) {
            if (
              data &&
              data.meta &&
              typeof data.meta.mode === "string" &&
              data.meta.mode.indexOf("human_handoff") === 0
            ) {
              return;
            }
            addSystemNote("No response received");
            return;
          }

          return renderResponseEntries(entries);
        })
        .catch(function (err) {
          hideBotTyping();
          trackEvent("ERROR", {
            url: window.location.href,
            stage: "message",
            reason: "request_failed",
            message: err && err.message ? err.message : "Message failed",
          });
          addSystemNote(err && err.message ? err.message : "Message failed");
        })
        .finally(function () {
          hideBotTyping();
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

      trackEvent("OPEN", {
        url: window.location.href,
        trigger: "launcher",
      });

      // Track with Plausible if available
      if (typeof window.plausible === "function") {
        window.plausible("Webchat Opened", {
          props: {
            url: window.location.href,
            trigger: "launcher",
          },
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

    // Attach event listeners
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

    window.addEventListener(cookieConsentEvent, function () {
      if (resolveCookieConsent()) {
        clearConsentNotice();
        setComposerDisabled(false);
      }
    });

    window.addEventListener("resize", syncMobileMode);

    // Initial setup
    syncMobileMode();
    updateUnreadBadge();

    // Process pending messages
    var toProcess = pendingMessages.slice();
    pendingMessages = [];
    toProcess.forEach(function (m) {
      if (m.kind === "system") {
        addSystemNote(m.text);
      } else {
        addMessage(m.kind, m.text);
      }
    });

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

    function pollAgentReplies() {
      if (!token) {
        return Promise.resolve(null);
      }

      var query = "token=" + encodeURIComponent(token);
      if (lastHumanReplyCursor) {
        query += "&after=" + encodeURIComponent(lastHumanReplyCursor);
      }

      return request("/api/webchat/messages?" + query, "GET")
        .then(function (data) {
          if (!data || !Array.isArray(data.messages)) {
            return null;
          }

          data.messages.forEach(function (entry) {
            if (!entry || !entry.id || seenHumanMessageIds[entry.id]) {
              return;
            }

            seenHumanMessageIds[entry.id] = true;

            if (typeof entry.text === "string" && entry.text.trim()) {
              addMessage("agent", entry.text.trim());
            }

            if (typeof entry.createdAt === "string" && entry.createdAt) {
              lastHumanReplyCursor = entry.createdAt;
            }
          });

          if (typeof data.cursor === "string" && data.cursor) {
            lastHumanReplyCursor = data.cursor;
          }

          persistSession();
          return data;
        })
        .catch(function () {
          return null;
        });
    }

    function startAgentReplyPolling() {
      if (agentReplyPollTimer !== null || !token) {
        return;
      }

      pollAgentReplies();
      agentReplyPollTimer = window.setInterval(function () {
        pollAgentReplies();
      }, 4000);
    }

    startAgentReplyPolling();
  }

  // --- Loading indicator ---
  var loadingDiv = document.createElement("div");
  loadingDiv.id = "replybase-webchat-loading";
  loadingDiv.style.position = "fixed";
  loadingDiv.style.bottom = "20px";
  loadingDiv.style.right = "20px";
  loadingDiv.style.background = "#f1f5f9";
  loadingDiv.style.color = "#0f172a";
  loadingDiv.style.padding = "16px 24px";
  loadingDiv.style.border = "1px solid #cbd5e1";
  loadingDiv.style.borderRadius = "12px";
  loadingDiv.style.zIndex = "2147483647";
  loadingDiv.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  loadingDiv.textContent = "Loading chat widget...";
  document.body.appendChild(loadingDiv);

  function showError(message) {
    var errorDiv = document.createElement("div");
    errorDiv.id = "replybase-webchat-error";
    errorDiv.style.position = "fixed";
    errorDiv.style.bottom = "20px";
    errorDiv.style.right = "20px";
    errorDiv.style.background = "#fff0f0";
    errorDiv.style.color = "#b91c1c";
    errorDiv.style.padding = "16px 24px";
    errorDiv.style.border = "1px solid #fca5a5";
    errorDiv.style.borderRadius = "12px";
    errorDiv.style.zIndex = "2147483647";
    errorDiv.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    errorDiv.textContent = "Chat unavailable: " + message;
    document.body.appendChild(errorDiv);
    if (loadingDiv && loadingDiv.parentNode)
      loadingDiv.parentNode.removeChild(loadingDiv);
  }

  (function initWidget() {
    console.log("[ReplyBase Webchat] Starting widget initialization...");
    loadConfig()
      .then(function () {
        console.log("[ReplyBase Webchat] Config loaded:", {
          publicKey,
          channelId,
          botId,
          initChallengeToken,
        });
        // Explicitly check required fields after config
        if (!initChallengeToken) {
          throw new Error("Missing initChallengeToken after config load");
        }
        if (!botId && !publicKey && !channelId) {
          throw new Error(
            "Missing botId, publicKey, and channelId after config load",
          );
        }
        return initializeSession();
      })
      .then(function () {
        console.log("[ReplyBase Webchat] Session initialized:", {
          token,
          conversationId,
          visitorId,
        });
        // Explicitly check required fields after session
        if (!token) {
          throw new Error("Missing token after session initialization");
        }
        if (!conversationId) {
          throw new Error(
            "Missing conversationId after session initialization",
          );
        }
        if (loadingDiv && loadingDiv.parentNode)
          loadingDiv.parentNode.removeChild(loadingDiv);
        renderWidget();
      })
      .catch(function (err) {
        var msg =
          err && err.message ? err.message : "Unable to load chat widget.";
        console.error("[ReplyBase Webchat] Initialization failed:", msg, err);
        showError(msg);
      });
  })();

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

  function persistSession() {
    setStoredSession({
      token: token,
      conversationId: conversationId,
      visitorId: visitorId,
      lastHumanReplyCursor: lastHumanReplyCursor,
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function normalizeResponseEntries(responseBody) {
    if (!responseBody || !Array.isArray(responseBody.responses)) {
      return [];
    }

    return responseBody.responses
      .filter(function (item) {
        if (!item || typeof item.type !== "string") {
          return false;
        }

        if (item.type === "text" && typeof item.text === "string") {
          return true;
        }

        return item.type === "typing" && typeof item.durationMs === "number";
      })
      .map(function (item) {
        if (item.type === "typing") {
          return {
            type: "typing",
            durationMs: Math.max(
              0,
              Math.min(10000, Math.round(item.durationMs)),
            ),
          };
        }

        return {
          type: "text",
          text: item.text,
        };
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
    if (
      existing &&
      typeof existing.lastHumanReplyCursor === "string" &&
      existing.lastHumanReplyCursor
    ) {
      lastHumanReplyCursor = existing.lastHumanReplyCursor;
    }

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
    };

    var elapsedMs = Date.now() - widgetBootedAt;
    var waitMs = Math.max(810 - elapsedMs, 0);

    return delay(waitMs).then(function () {
      payload.botSignals = buildBotSignals();
      return request("/api/webchat/init", "POST", payload).then(function (data) {
        token = data.token;
        conversationId = data.conversationId;
        visitorId = data.visitorId;
        initialized = true;
        if (!lastHumanReplyCursor) {
          lastHumanReplyCursor = new Date().toISOString();
        }
        persistSession();
      });
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
      if (typeof data.botId === "string" && data.botId.trim()) {
        botId = data.botId.trim();
      }
      if (typeof data.channelId === "string" && data.channelId.trim()) {
        channelId = data.channelId.trim();
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
        title = cfg.title.trim();
      }
      if (typeof cfg.primaryColor === "string" && cfg.primaryColor.trim()) {
        primaryColor = cfg.primaryColor.trim();
      }
      if (typeof cfg.welcomeMessage === "string" && cfg.welcomeMessage.trim()) {
        addMessage("bot", cfg.welcomeMessage.trim());
      }
    });
  }
})();
