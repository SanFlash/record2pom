/* Shared validation and selector ranking for the website-agnostic recording pipeline. */
(function (root) {
  "use strict";
  const MAX_EVENTS = 5000;
  const MAX_TEXT = 10000;
  const STRATEGY_WEIGHT = { testId: 100, role: 90, label: 80, placeholder: 70, attribute: 60, css: 40, xpath: 20 };
  function validateRecording(input) {
    const errors = [];
    if (!input || typeof input !== "object") return { ok: false, errors: ["Recording must be a JSON object or event array."] };
    if (input.schemaVersion != null && input.schemaVersion !== 1) errors.push("Unsupported recording schemaVersion: " + input.schemaVersion);
    const events = Array.isArray(input) ? input : (input.events || input.actions);
    if (!Array.isArray(events)) errors.push("Recording must contain an events array.");
    else {
      if (events.length > MAX_EVENTS) errors.push("Recording exceeds the " + MAX_EVENTS + " event limit.");
      events.forEach((event, index) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) { errors.push("Event " + (index + 1) + " must be an object."); return; }
        const kind = String(event.kind || event.type || event.action || "").toLowerCase().replace(/_/g, "-");
        const allowed = ["click","fill","select","check","uncheck","press","navigate","wait","assert-visible","assert-text","assert-url","assert-value"];
        if (!allowed.includes(kind) && !["input","type","change","navigation"].includes(kind)) errors.push("Event " + (index + 1) + " has unsupported kind: " + (kind || "(missing)"));
        for (const field of ["description","url","value"]) if (typeof event[field] === "string" && event[field].length > MAX_TEXT) errors.push("Event " + (index + 1) + " field " + field + " is too long.");
      });
    }
    return { ok: errors.length === 0, errors, count: Array.isArray(events) ? events.length : 0 };
  }
  const KIND_ALIASES = { input:"fill", type:"fill", change:"fill", navigation:"navigate", keypress:"press", assertion:"assert-visible" };
  function normalizeRecording(input) {
    const validation = validateRecording(input);
    if (!validation.ok) return { ok:false, errors:validation.errors, recording:null };
    const rawEvents = Array.isArray(input) ? input : (input.events || input.actions || []);
    const targetUrl = typeof input.targetUrl === "string" ? input.targetUrl : (typeof input.url === "string" ? input.url : "");
    const events = rawEvents.map((raw, index) => {
      const originalKind = String(raw.kind || raw.type || raw.action || "").toLowerCase().replace(/_/g, "-");
      const kind = KIND_ALIASES[originalKind] || originalKind;
      const target = raw.target && typeof raw.target === "object" && !Array.isArray(raw.target) ? {...raw.target} : {};
      const candidates = Array.isArray(raw.locators) ? raw.locators :
        (Array.isArray(raw.locatorCandidates) ? raw.locatorCandidates.map(c => ({
          strategy:c.strategy || c.type, value:c.value || c.selector, name:c.name, matchCount:c.matchCount
        })) : (raw.locator && typeof raw.locator === "object" ? [raw.locator] : []));
      const isRedacted = raw.redacted === true || raw.sensitivity === "sensitive" || raw.sensitivity === "secret";
      const event = {
        id: String(raw.id || "event-" + (index + 1)),
        sequence: Number.isFinite(Number(raw.sequence)) && Number(raw.sequence) > 0 ? Number(raw.sequence) : index + 1,
        kind,
        description: String(raw.description || raw.label || kind).slice(0, 150),
        timestamp: typeof raw.timestamp === "string" ? raw.timestamp : null,
        url: typeof raw.url === "string" ? raw.url.slice(0, 2000) : "",
        target,
        locators: candidates.filter(c => c && typeof c === "object").map(c => ({
          strategy:String(c.strategy || c.type || "").slice(0, 40),
          value:String(c.value || c.selector || "").slice(0, 1000),
          ...(c.name != null ? {name:String(c.name).slice(0, 300)} : {}),
          ...(Number.isFinite(c.matchCount) && c.matchCount >= 0 ? {matchCount:c.matchCount} : {})
        })).filter(c => c.strategy && c.value),
        source: String(raw.source || "import").slice(0, 80),
        redacted: isRedacted
      };
      if (isRedacted) {
        event.envVar = String(raw.envVar || "RECORDED_INPUT_" + event.sequence).replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 100);
      } else if (raw.value != null) {
        event.value = String(raw.value).slice(0, 500);
      }
      if (raw.assertion && typeof raw.assertion === "object") {
        event.assertion = { ...raw.assertion };
        if (event.assertion.expected != null) event.assertion.expected = String(event.assertion.expected).slice(0, 2000);
      }
      if (raw.milliseconds != null) event.milliseconds = Math.min(30000, Math.max(0, Number(raw.milliseconds) || 0));
      return event;
    });
    return { ok:true, errors:[], recording:{schemaVersion:1, targetUrl:targetUrl.slice(0, 2000), metadata:(!Array.isArray(input) && input.metadata && typeof input.metadata === "object") ? {...input.metadata} : {}, events} };
  }
  function rankLocators(candidates) {
    return (Array.isArray(candidates) ? candidates : []).filter(c => c && typeof c === "object" && c.value != null && String(c.value).length > 0)
      .map((c, index) => ({...c, _index:index, _weight:STRATEGY_WEIGHT[c.strategy] || 0,
        _unique: c.matchCount === 1, _ambiguous: typeof c.matchCount === "number" && c.matchCount > 1}))
      .sort((a,b) => Number(b._unique)-Number(a._unique) || b._weight-a._weight || a._index-b._index);
  }
  function assessLocator(candidate) {
    if (!candidate) return {status:"missing", message:"No usable locator candidate."};
    if (candidate.matchCount === 1) return {status:"unique", message:"Locator matched exactly one element when recorded."};
    if (typeof candidate.matchCount === "number" && candidate.matchCount > 1) return {status:"ambiguous", message:"Locator matched " + candidate.matchCount + " elements when recorded."};
    return {status:"unverified", message:"Locator uniqueness was not measured; verify it before running tests."};
  }
  root.Record2POMCore = Object.freeze({validateRecording, normalizeRecording, rankLocators, assessLocator, MAX_EVENTS});
})(typeof globalThis !== "undefined" ? globalThis : this);
