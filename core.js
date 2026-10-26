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
  root.Record2POMCore = Object.freeze({validateRecording, rankLocators, assessLocator, MAX_EVENTS});
})(typeof globalThis !== "undefined" ? globalThis : this);
