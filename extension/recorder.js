(()=> {
  "use strict";
  if (window.__record2pomInstalled) return;
  window.__record2pomInstalled = true;

  window.addEventListener("record2pom:import-ack", event => { const d=event?.detail||{}; chrome.runtime.sendMessage({type:"R2POM_IMPORT_ACK",sessionId:d.sessionId||null,ok:d.ok===true,eventCount:Number(d.eventCount||0),error:String(d.error||"").slice(0,500)}).catch(()=>{}); });

  let recording = false;
  let paused = false;
  let inspectMode = false;
  let inspectOverlay = null;
  let inspectedElement = null;
  let previousOutline = "";
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
    if (element.tagName === "OPTION") return "option";
    if (element.hasAttribute("tabindex") || element.hasAttribute("onclick")) return "button";
    return "";
  }

  function accessibleName(element) {
    return label(element) || clean(element.getAttribute("title")) ||
      clean(element.getAttribute("alt")) || clean(element.innerText || element.textContent) ||
      clean(element.getAttribute("value"));
  }

  function isInteractive(element) {
    if (!(element instanceof Element)) return false;
    if (element.matches("button,a[href],input,textarea,select,summary,[role],[tabindex],[onclick],[data-testid],[data-test],[data-qa]")) return true;
    try {
      if (getComputedStyle(element).cursor !== "pointer") return false;
      // Cursor styles inherit. Prefer the actual clickable container over a child span/icon.
      return !element.parentElement || getComputedStyle(element.parentElement).cursor !== "pointer";
    } catch { return false; }
  }

  function stableCss(element) {
    if (!(element instanceof Element)) return "";
    const unique = selector => {
      try { return document.querySelectorAll(selector).length === 1; } catch { return false; }
    };
    if (element.id) {
      const idSelector = "#" + CSS.escape(element.id);
      if (unique(idSelector)) return idSelector;
    }
    for (const attr of ["data-testid", "data-test", "data-qa", "name", "aria-label"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const selector = "[" + attr + "=" + JSON.stringify(value) + "]";
      if (unique(selector)) return selector;
    }
    const parts = [];
    let node = element;
    while (node && node instanceof Element && node !== document.documentElement && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const classes = Array.from(node.classList || []).filter(c => c && c.length < 48 && !/(^|[-_])[a-f0-9]{8,}$/i.test(c)).slice(0, 2);
      if (classes.length) part += classes.map(c => "." + CSS.escape(c)).join("");
      let candidate = [part, ...parts].join(" > ");
      if (unique(candidate)) return candidate;
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(item => item.tagName === node.tagName) : [];
      if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
      parts.unshift(part);
      node = node.parentElement;
      candidate = parts.join(" > ");
      if (unique(candidate)) return candidate;
    }
    const fallback = parts.join(" > ");
    // Preserve a structurally useful fallback even when uniqueness cannot be proven.
    // The generated runner will measure matches and fail safely if it is ambiguous.
    return fallback;
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
      id: element.id || element.getAttribute("id") || "",
      fieldName: element.name || element.getAttribute("name") || "",
      autocomplete: element.getAttribute("autocomplete") || "",
      visible: visible(element),
      enabled: !element.disabled,
      css: stableCss(element),
      href: element.getAttribute("href") || "",
      title: element.getAttribute("title") || ""
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
    if (info.fieldName) {
      const selector = "[name=" + JSON.stringify(info.fieldName) + "]";
      let count = 0;
      try { count = document.querySelectorAll(selector).length; } catch { /* ignore invalid attribute values */ }
      output.push({ strategy: "css", value: selector, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    const selectors = {
      button: "button,input[type=button],input[type=submit],input[type=reset],[role=button],[tabindex],[onclick]",
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
    if (info.href) {
      const selector = "a[href=" + JSON.stringify(info.href) + "]";
      let count = 0;
      try { count = document.querySelectorAll(selector).length; } catch { /* ignore malformed href selector */ }
      output.push({ strategy: "css", value: selector, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    if (info.css && !output.some(item => item.strategy === "css" && item.value === info.css)) {
      let count = 0;
      try { count = document.querySelectorAll(info.css).length; } catch { /* malformed selector is not emitted as a verified locator */ }
      output.push({ strategy: "css", value: info.css, matchCount: count, confidence: count === 1 ? "high" : count > 1 ? "low" : "unverified" });
    }
    const priority = { testId: 0, role: 1, label: 2, placeholder: 3, css: 4 };
    output.sort((a, b) => Number(b.matchCount === 1) - Number(a.matchCount === 1) ||
      (priority[a.strategy] ?? 9) - (priority[b.strategy] ?? 9));
    return output;
  }

  function sanitizeUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      url.username = "";
      url.password = "";
      const secretKey = /password|passwd|token|secret|authorization|auth|api.?key|access.?key|client.?secret|session|jwt|credential|otp|code|signature|(^|_)key($|_)/i;
      for (const [key] of url.searchParams) if (secretKey.test(key)) url.searchParams.set(key, "__REDACTED__");
      if (url.hash.includes("=")) {
        const hashParams = new URLSearchParams(url.hash.slice(1));
        let changed = false;
        for (const [key] of hashParams) if (secretKey.test(key)) { hashParams.set(key, "__REDACTED__"); changed = true; }
        if (changed) url.hash = hashParams.toString();
      }
      return url.href;
    } catch { return ""; }
  }

  function sensitive(element) {
    return /password|one-time|otp|token|secret|credit.?card|cc-number|cc-csc|cvv|ssn|social.?security/i
      .test([element.type, element.name, element.id, element.autocomplete, element.placeholder, label(element)].join(" "));
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
      url: sanitizeUrl(location.href),
      page: { url: sanitizeUrl(location.href), origin: location.origin, title: document.title },
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
    if (inspectMode || !recording || paused) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    const element = path.find(item => item instanceof Element && item.matches(
      "button,a[href],input[type=button],input[type=submit],[role=button],[role=link],[role=menuitem],[role=tab],[role=option],[role=checkbox],[role=radio],[aria-haspopup],[data-testid],[data-test],[data-qa],[onclick],summary,[tabindex]"
    )) || path.find(item => item instanceof Element && isInteractive(item));
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

  function clearInspectHighlight() {
    if (inspectedElement) inspectedElement.style.outline = previousOutline;
    inspectedElement = null;
    if (inspectOverlay) inspectOverlay.remove();
    inspectOverlay = null;
  }

  function startInspectMode() {
    clearInspectHighlight();
    inspectMode = true;
    const banner = document.createElement("div");
    banner.id = "record2pom-inspect-banner";
    banner.textContent = "Record2POM Inspect: click the element whose locator needs repair · Esc to cancel";
    Object.assign(banner.style, {position:"fixed",top:"8px",left:"8px",zIndex:"2147483647",padding:"10px 14px",background:"#0b1020",color:"#a5f3fc",border:"2px solid #22d3ee",borderRadius:"8px",font:"bold 12px/1.4 system-ui,sans-serif",boxShadow:"0 4px 24px #0008",pointerEvents:"none"});
    (document.documentElement || document.body).appendChild(banner);
    inspectOverlay = banner;
  }

  function finishInspectMode(element) {
    if (!inspectMode || !(element instanceof Element)) return;
    let chosen = element;
    for (let node = element; node && node instanceof Element; node = node.parentElement) {
      if (isInteractive(node)) { chosen = node; break; }
    }
    const info = target(chosen);
    const candidates = locators(chosen);
    inspectMode = false;
    clearInspectHighlight();
    try {
      chrome.runtime.sendMessage({type:"R2POM_INSPECT_RESULT", target:info, locators:candidates, url:sanitizeUrl(location.href), page:{url:sanitizeUrl(location.href),origin:location.origin,title:document.title}}).catch(()=>{});
    } catch { /* extension may be reloading */ }
  }

  document.addEventListener("mousemove", event => {
    if (!inspectMode || !(event.target instanceof Element)) return;
    const element = event.target;
    if (inspectedElement && inspectedElement !== element) inspectedElement.style.outline = previousOutline;
    if (inspectedElement !== element) previousOutline = element.style.outline || "";
    inspectedElement = element;
    element.style.outline = "3px solid #22d3ee";
  }, true);

  document.addEventListener("click", event => {
    if (!inspectMode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finishInspectMode(event.target);
  }, true);

  document.addEventListener("keydown", event => {
    if (inspectMode && event.key === "Escape") {
      inspectMode = false;
      clearInspectHighlight();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (recording && !paused && event.key === "Enter" && event.target instanceof Element) {
      emit("press", event.target, { value: "Enter", description: "Press Enter" });
    }
  }, true);

  let lastNavigationUrl = "";
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "R2POM_INSPECT_MODE") {
      startInspectMode();
      return;
    }
    if (message?.type === "R2POM_CONTROL") {
      recording = !!message.recording;
      paused = !!message.paused;
      return;
    }
    if (message?.type !== "R2POM_NAVIGATION") return;

    // A navigation can finish before the new document's initial session read.
    // Consult the service worker's persisted state so this timing race cannot
    // silently drop the navigation event.
    void (async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: "R2POM_GET_SESSION" });
        if (!result?.ok || !result.session) return;
        recording = !!result.session.recording;
        paused = !!result.session.paused;
        if (!recording || paused) return;
        const safeUrl = sanitizeUrl(message.url);
        if (!safeUrl || safeUrl === lastNavigationUrl) return;
        const url = new URL(safeUrl);
        lastNavigationUrl = url.href;
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
      } catch { /* ignore navigation messages while the extension is reloading */ }
    })();
  });

  chrome.runtime.sendMessage({ type: "R2POM_GET_SESSION" }).then(result => {
    if (result?.ok && result.session) {
      recording = !!result.session.recording;
      paused = !!result.session.paused;
    }
  }).catch(() => {});
})();
