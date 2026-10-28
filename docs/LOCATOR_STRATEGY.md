# Locator Strategy and Failure Handling

**Creator attribution:** Satyendra Kumar Namdeo

Reliable generated automation depends on locator quality more than selector cleverness. Record2POM captures multiple locator candidates where possible and encourages review before execution.

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
- **Missing:** no usable locator candidate was captured. Add a locator manually.

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
