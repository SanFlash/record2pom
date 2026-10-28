(()=> {
  "use strict";
  if (window.__record2pomInstalled) return;
  window.__record2pomInstalled = true;

  window.addEventListener("record2pom:import-ack", event => { const d=event?.detail||{}; chrome.runtime.sendMessage({type:"R2POM_IMPORT_ACK",sessionId:d.sessionId||null,ok:d.ok===true,eventCount:Number(d.eventCount||0),error:String(d.error||"").slice(0,500)}).catch(()=>{}); });

  let recording = false;
  let paused = false;
  const clean = value => String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const visible = element => !!(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));

  function label(element) {
    if (element.labels?.length) return clean(Array.from(element.labels).map(item => item.innerText || item.textContent || "").join(" "));
    const aria = element.getAttribute("aria-label");
    if (aria) return clean(aria);
    const ids = element.getAttribute("aria-labelledby");
    return ids ? clean(ids.split(/\s+/).map(id => {
      const node = document.getElementById(id);
      return node?.innerText || node?.textContent || "";
    }).join(" ")) : "";
  }

  function roleFor(element) {
    const explicit = element.getAttribute("role");
    if (explicit) return explicit;
    if (element.tagName === "BUTTON" || (element.tagName === "INPUT" && ["button", "submit", "reset"].includes(element.type))) return "button";
    if (element.tagName === "A" && element.getAttribute("href")) return "link";
    if (element.tagName === "INPUT") {
      if (element.type === "checkbox") return "checkbox";
      if (element.type === "radio") return "radio";
      if (element.type === "button" || element.type === "submit" || element.type === "reset") return "button";
      if (element.type === "hidden" || element.type === "file") return "";
      return "textbox";
    }
    if (element.tagName === "TEXTAREA") return "textbox";
    if (element.tagName === "SELECT") return "combobox";
    if (element.tagName === "SUMMARY") return "button";
    return "";
  }

  function accessibleName(element) {
    return label(element) || clean(element.innerText || element.textContent) || clean(element.getAttribute("title"));
  }

  function target(element) {
    const name = accessibleName(element);
    return {
      tagName: element.tagName?.toLowerCase(),
      role: roleFor(element),
      name,
      label: label(element),
      placeholder: element.placeholder || "",
      testId: element.getAttribute("data-testid") || "",
      text: clean(element.innerText || element.textContent),
      inputType: element.type || "",
      visible: visible(element),
      enabled: !element.disabled,
      css: element.id ? "#" + CSS.escape(element.id) : ""
    };
  }

  function locators(element) {
    const output = [];
    const info = target(element);
    if (info.testId) {
      const count = Array.from(document.querySelectorAll("[data-testid]"))
        .filter(item => item.getAttribute("data-testid") === info.testId).length;
      output.push({ strategy: "testId", value: info.testId, matchCount: count, confidence: count === 1 ? "high" : "low" });
    }
    for (const attribute of ["data-test", "data-qa"]) {
      const attributeValue = element.getAttribute(attribute);
      if (attributeValue) {
        const selector = "[" + attribute + "=" + JSON.stringify(attributeValue) + "]";
        let count = 0;
        try { count = document.querySelectorAll(selector).length; } catch { /* ignore invalid custom attributes */ }
        output.push({ strategy: "css", value: selector, matchCount: count, confidence: count === 1 ? "high" : "low" });
      }
    }
    const selectors = {
      button: "button,input[type=button],input[type=submit],input[type=reset],[role=button]",
      link: "a[href],[role=link]",
      textbox: "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),textarea,[role=textbox]",
      combobox: "select,[role=combobox]",
      checkbox: "input[type=checkbox],[role=checkbox]",
      radio: "input[type=radio],[role=radio]"
    };
    if (info.role && info.name && selectors[info.role]) {
      const count = Array.from(document.querySelectorAll(selectors[info.role]))
        .filter(item => roleFor(item) === info.role && accessibleName(item) === info.name).length;
      output.push({ strategy: "role", value: info.role, name: info.name, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    if (info.label) {
      const count = Array.from(document.querySelectorAll("label")).filter(item => clean(item.innerText || item.textContent) === info.label).length;
      output.push({ strategy: "label", value: info.label, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    if (info.placeholder) {
      const count = Array.from(document.querySelectorAll("[placeholder]")).filter(item => item.getAttribute("placeholder") === info.placeholder).length;
      output.push({ strategy: "placeholder", value: info.placeholder, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    if (info.css) {
      let count = 0;
      try { count = document.querySelectorAll(info.css).length; } catch { /* malformed selector is not emitted as a verified locator */ }
      output.push({ strategy: "css", value: info.css, matchCount: count, confidence: count === 1 ? "high" : "low" });
    }
    return output;
  }

  function sensitive(element) {
    return /password|one-time|otp|token|secret|credit.?card|cc-number|cc-csc|cvv|ssn|social.?security/i
      .test([element.type, element.name, element.id, element.autocomplete, label(element)].join(" "));
  }

  function send(event) {
    try {
      const pending = chrome.runtime.sendMessage({ type: "R2POM_EVENT", event });
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch { /* the extension may be reloading; do not interrupt the target page */ }
  }

  function emit(kind, element, extra = {}) {
    if (!recording || paused) return;
    const info = target(element);
    const isSensitive = sensitive(element);
    const event = {
      schemaVersion: 1,
      id: "event-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      kind,
      url: location.href,
      page: { url: location.href, origin: location.origin, title: document.title },
      target: info,
      locators: locators(element),
      source: "browser-extension",
      sensitivity: isSensitive ? "sensitive" : "normal",
      ...extra
    };
    if (isSensitive) {
      delete event.value;
      event.redacted = true;
      event.sensitivity = "sensitive";
      event.envVar = (element.name || element.id || "RECORDED_INPUT").replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80);
    }
    send(event);
  }

  document.addEventListener("click", event => {
    if (!recording || paused) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    const element = path.find(item => item instanceof Element && item.matches(
      "button,a[href],input[type=button],input[type=submit],[role=button],[role=link],[role=menuitem],[role=tab],[role=option],[role=checkbox],[role=radio],[aria-haspopup],[data-testid],[data-test],[data-qa],[onclick],summary"
    ));
    if (element) {
      const info = target(element);
      emit("click", element, { description: "Click " + (info.name || info.text || info.tagName) });
    }
  }, true);

  document.addEventListener("change", event => {
    if (!recording || paused) return;
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
    if (element instanceof HTMLInputElement && (element.type === "file" || element.type === "hidden" || element.type === "button" || element.type === "submit")) return;
    if (element.type === "checkbox" || element.type === "radio") {
      emit(element.checked ? "check" : "uncheck", element, { description: (element.checked ? "Check " : "Uncheck ") + (label(element) || element.tagName) });
      return;
    }
    const kind = element instanceof HTMLSelectElement ? "select" : "fill";
    const extra = { description: (kind === "select" ? "Select " : "Fill ") + (label(element) || element.placeholder || element.tagName) };
    if (sensitive(element)) {
      extra.redacted = true;
      extra.envVar = (element.name || element.id || "RECORDED_INPUT").replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80);
    } else {
      extra.value = String(element instanceof HTMLSelectElement ? (element.selectedOptions?.[0]?.label || element.value || "") : (element.value || "")).slice(0, 500);
    }
    emit(kind, element, extra);
  }, true);

  document.addEventListener("keydown", event => {
    if (recording && !paused && event.key === "Enter" && event.target instanceof Element) {
      emit("press", event.target, { value: "Enter", description: "Press Enter" });
    }
  }, true);

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "R2POM_CONTROL") {
      recording = !!message.recording;
      paused = !!message.paused;
    }
    if (message?.type === "R2POM_NAVIGATION" && recording && !paused) {
      try {
        const url = new URL(message.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        send({
          schemaVersion: 1,
          id: "nav-" + Date.now(),
          timestamp: new Date().toISOString(),
          kind: "navigate",
          url: url.href,
          page: { url: url.href, origin: url.origin, title: document.title },
          target: {},
          locators: [],
          description: "Navigation",
          source: "browser-extension"
        });
      } catch { /* ignore invalid navigation notifications */ }
    }
  });

  chrome.runtime.sendMessage({ type: "R2POM_GET_SESSION" }).then(result => {
    if (result?.ok && result.session) {
      recording = !!result.session.recording;
      paused = !!result.session.paused;
    }
  }).catch(() => {});
})();
