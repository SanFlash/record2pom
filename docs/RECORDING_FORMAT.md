# Recording JSON Format

**Creator attribution:** Satyendra Kumar Namdeo  
**Current schema version:** `1`

A recording is a portable description of browser actions. Treat it as test input, review it before sharing, and keep real credentials and personal information out of it.

## Top-level fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | integer | Recommended | Current canonical version is `1` |
| `targetUrl` | string | Recommended | HTTP/HTTPS page under test |
| `metadata` | object | No | Non-sensitive provenance and notes |
| `events` | array | Yes | Ordered journey steps |

## Event fields

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable event identifier |
| `sequence` | integer | Position in the journey |
| `kind` | string | Supported action or assertion kind |
| `description` | string | Human-readable intent |
| `target` | object | Element hints such as role, name, label, testId or CSS ID |
| `locators` | array | Candidate locator strategies and values |
| `value` | string | Synthetic input or expected text where applicable |
| `assertion` | object | Assertion expectation when applicable |
| `redacted` | boolean | Indicates that the original value was intentionally omitted |
| `envVar` | string | Optional environment-variable name for externally supplied sensitive test data |
| `source` | string | Capture/import provenance |

Supported canonical kinds: `click`, `fill`, `select`, `check`, `uncheck`, `press`, `navigate`, `wait`, `assert-visible`, `assert-text`, `assert-url`, and `assert-value`.

The shared normalizer accepts selected legacy aliases such as `input`, `type`, `change`, and `navigation`, then canonicalizes them. Unknown kinds and unsupported schema versions should fail validation rather than being silently interpreted.

## Example

See [`examples/recording-example.json`](../examples/recording-example.json) for a complete synthetic journey that fills a form, selects a country, toggles a checkbox, submits and asserts an outcome.

## Compatibility and safety rules

- Add new canonical fields in a backward-compatible way when possible.
- If the meaning or required structure changes, introduce a new schema version and migration tests.
- Keep the event count bounded; the shared core currently caps recordings at 5,000 events.
- Limit long strings and validate every imported event.
- Never assume a JSON recording is trusted just because it came from the extension.
- Do not include cookies, passwords, access tokens, real customer data or production URLs with sensitive query parameters.
- Redaction is heuristic; review the file manually before attaching it to an issue or sharing it publicly.

## Change checklist

When editing the schema or normalizer, update `core.js`, the Node tests, the sample JSON, generated-project tests and this document together.
