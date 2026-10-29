# Chrome Extension Validation Plan

**Scope:** Record2POM Manifest V3 extension  
**Creator attribution:** Satyendra Kumar Namdeo

This plan distinguishes automated simulation from real-browser validation. Passing a Node harness is not equivalent to installing the extension in Chrome.

## Test matrix

| ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| EXT-01 | Load unpacked extension | Manifest and icons load without extension errors | Chrome extensions page screenshot |
| EXT-02 | Open an HTTP/HTTPS fixture | Active tab URL is displayed | Popup screenshot |
| EXT-03 | Start recording | State changes to Recording and session resets | Popup state + action count |
| EXT-04 | Capture click and text entry | Supported events appear once in session | Exported synthetic recording |
| EXT-05 | Pause, interact, resume | Paused interactions are not recorded; resumed interactions are | Event sequence comparison |
| EXT-06 | Stop with events | Session is retained and Studio opens | Popup and Studio screenshots |
| EXT-07 | Studio acknowledges import | Transfer status becomes Imported with event count | Popup acknowledgement screenshot |
| EXT-08 | Force or simulate import failure | Error is visible and retry remains available | Failure-state screenshot |
| EXT-09 | Export JSON | Valid versioned JSON downloads | JSON file validated locally |
| EXT-10 | Password-like field | Sensitive value is not stored in exported event | Synthetic test only |
| EXT-11 | URL contains token-like parameter | Credentials are removed and sensitive parameter redacted | Sanitized URL assertion |
| EXT-12 | Browser-internal page | Start is rejected with clear guidance | Popup error state |
| EXT-13 | Empty session | Generate is rejected without opening a project | Popup error state |
| EXT-14 | Clear session | Events and active state are reset | Popup count/state |
| EXT-15 | Reload extension or browser | Persisted session behavior is understood and stable | Before/after session check |
| EXT-16 | Navigate to a new page while recording | Navigation is captured once after the new page initializes; paused sessions remain unchanged | Exported event sequence and sanitized URL assertions |\n| EXT-17 | Studio tab finishes loading before handoff listener is ready | Handoff checks the current tab state and still delivers the saved recording exactly once | Automated fast-load regression test |\n| EXT-18 | Studio emits repeated completed-navigation notifications | A successful handoff is not injected a second time | Automated idempotency regression test |

## Manual smoke-test procedure

1. Use a clean Chrome/Chromium profile and a synthetic test page. Do not use a production account.
2. Navigate to `chrome://extensions`, enable Developer mode and select **Load unpacked**.
3. Choose the repository's `extension/` folder. Resolve manifest or service-worker errors before proceeding.
4. Open the local fixture served from the repository and reload the tab so the content script is available.
5. Start recording, click the Details tab, fill the Full name field with a synthetic value, select a country, toggle Send updates, and submit.
6. Pause and resume once. Verify events recorded while paused are absent.
7. Stop the session. Verify the popup transfer state, open Studio, and inspect the imported action list.
8. Generate a project and verify that the ZIP downloads. Generation alone does not mean the generated tests passed.
9. Export a recording JSON and inspect it for secrets, personal information, browser-specific paths, or unintended values.
10. Save evidence under a dated local folder with Chrome version, extension version, OS, result and any issue ID. Redact sensitive page content before sharing.

## Popup keyboard and accessibility checks

Use these checks with the extension popup open in a clean Chrome profile:

1. Press `Tab` from the browser toolbar and confirm focus reaches visible controls in a logical order. Use `Shift+Tab` to move backwards.
2. Confirm every focused button and link has a high-contrast visible focus indicator that is not clipped.
3. Use `Enter` or `Space` to activate focused buttons; confirm disabled Pause/Stop controls cannot be activated while idle.
4. Confirm the recording state, active-tab target, captured-action count, session-start time, Studio transfer state, and status/error messages are exposed as text and announced politely by assistive technology.
5. Confirm Pause/Resume updates its accessible name and pressed state.
6. Enable the operating system/browser reduced-motion preference and confirm the popup remains usable without non-essential transitions.
7. Confirm the Setup & limitations link opens a new tab without granting that page access to the opener window.

Automated source-contract tests check the semantic labels, live regions, focus-visible styles, reduced-motion rules, and link safety attributes. They do not replace manual keyboard and screen-reader checks in Chrome.

## Automated coverage

GitHub Actions validates the Manifest V3 JSON, required extension assets, icon dimensions, branding, packaging and the Node message/session integration tests. Browser E2E tests use Playwright against the Studio and generated project. Navigation regression tests also simulate a delayed initial session read, duplicate completion notifications, URL-secret redaction, and paused-state behavior. These checks are valuable but do not replace the manual installed-extension scenarios above.

## Evidence record template

```text
Date/time:
OS:
Browser/version:
Extension version:
Test ID:
Preconditions:
Steps:
Expected:
Actual:
Result: PASS | FAIL | BLOCKED
Issue/commit:
Evidence files:
Sensitive data reviewed: YES | NO
```

## Known boundaries

- Browser-internal pages and restricted Chrome surfaces cannot be injected into.
- Closed shadow roots, complex custom controls, cross-origin frames and popup windows may require manual test design.
- Accessible-name and selector hints are candidates; users must review ambiguous locators.
- Sensitive-field detection is heuristic, not a guarantee that all sensitive data is removed.
