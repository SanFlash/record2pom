# Locator Strategy and Failure Handling

**Creator attribution:** Satyendra Kumar Namdeo

Reliable generated automation depends on locator quality more than selector cleverness. Record2POM captures multiple locator candidates where possible, builds a measured CSS fallback for custom controls, and encourages review before execution.

## Recommended priority

| Priority | Strategy | Example | Notes |
|---:|---|---|---|
| 1 | Stable test ID | `data-testid="save-profile"` | Usually explicit and resilient when the app team maintains it |
| 2 | Accessible role + exact name | button named “Save profile” | Mirrors user-visible semantics; exact matching helps avoid accidental duplicates |
| 3 | Associated label | label “Full name” | Strong choice for standard form controls |
| 4 | Placeholder | “Enter your name” | Useful but may change with UX copy and may be absent |
| 5 | Stable custom attribute | `data-test` or `data-qa` | Good if the application has a documented convention |
| 6 | Stable CSS ID | `#full-name` | Useful when IDs are stable and unique |
| 7 | Other CSS/XPath | reviewed selector | Keep scoped and readable; avoid positional selectors where possible |

This is a guideline, not a guarantee. A selector recorded as unique can become ambiguous after an application update.

## Locator health states

- **Unique:** exactly one match was measured at capture time. Re-check at run time.
- **Ambiguous:** more than one match was measured. Prefer a stronger candidate or scope the locator.
- **Unverified:** uniqueness was not measured. Inspect it before running.
- **Missing:** no usable locator candidate was captured. First use the extension's **Inspect & Repair Locator** workflow; if inspection still cannot find a unique candidate, add or scope a locator manually.

## Repair a missing locator from the browser

1. Stop the recording and open the Record2POM extension popup on the recorded tab.
2. Enter the action number (for example, `24`) in **Action # (optional)**. Leave it blank to target the most recent action missing a locator.
3. Choose **Inspect & Repair Locator**. Record2POM enters inspect mode and highlights the element under your pointer.
4. Click the actual control (not a decorative outer container). Press Escape to cancel.
5. The extension reads the selected element's accessible role/name, associated label, placeholder, test attributes, name, ID, link target, and a measured CSS path.
6. Record2POM automatically selects the highest-priority candidate with exactly one match (test ID, role/name, label, placeholder, then CSS). It marks this candidate as preferred for Studio and generated framework code. If none is verified unique, it preserves ranked fallbacks and explicitly reports that no unique locator could be auto-selected.
7. It attaches the candidates to the specified action, or the most recent action missing a locator if no action number was entered. If no action is missing one, it attaches them to the latest non-navigation action.
8. Reopen the extension popup, export the recording JSON, then import that JSON into Studio and regenerate the project. The selected locator is preferred automatically; review the action and execute the generated tests to confirm behavior.

Inspect mode prevents the selection click from being recorded as a new test action. CSS paths may still change when the application DOM changes; measured uniqueness is a capture-time signal, not a guarantee for future runs. The extension does not guess between multiple equally plausible targets.

## Runtime locator self-healing in generated Playwright projects

Generated Playwright Page Objects now retain a compact fingerprint of the recorded element (tag, role, accessible name, label, placeholder, test ID, text, ID, field name, href, and title). If all saved locator candidates fail, the resolver inspects the current live DOM and scores visible, enabled interactive elements against that fingerprint. It accepts only one uniquely highest-scoring match and records the repair metadata in memory; equal-scoring candidates are rejected rather than guessed. Failure diagnostics include the current URL and page title so a wrong page/state can be distinguished from a stale selector.

This is a recovery mechanism, not permission to click an unrelated control. If the recorded action belongs to a different page state or the element no longer exists, the resolver stops safely. A recording should be replayed in the same workflow and state in which it was captured.

## Review checklist

- Is the target element unique at runtime?
- Does the locator express meaning rather than page layout?
- Is the accessible name exact and stable?
- Could a repeated card, menu or dialog contain the same label?
- Should the locator be scoped to a named region or component?
- Is there an assertion proving the action had the intended effect?
- Does the test use synthetic data and avoid real secrets?

## Fail-safe runtime expectations

Generated page objects should reject a locator when it cannot be resolved uniquely or when the element is not actionable. Do not silently choose the first result from an ambiguous locator. Failure messages should identify the action, candidate strategy and a repair hint without dumping secrets.

A robust recovery workflow is:

1. Capture the failed step and error.
2. Record candidate locator diagnostics and current match counts when safe.
3. Suggest a ranked alternative without changing the test silently.
4. Let a maintainer review and update the recording or page object.
5. Re-run the targeted test and the relevant regression suite.

## Assertions turn actions into tests

A click is only an action. Add assertions for visible outcomes, text, URL changes or form values. Prefer a meaningful outcome assertion after important state changes, and keep assertions independent enough that a failure identifies the broken behavior.

## Anti-patterns

Avoid fixed sleeps when a web-first wait or expected condition is available; selectors such as `:nth-child(7)` without a stable semantic scope; catching every exception and continuing; hidden automatic selector substitution that changes test meaning; and reporting generation success as a passing test.
