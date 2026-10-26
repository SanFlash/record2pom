# Record2POM MVP architecture

## Components
- index.html, styles.css, app.js: static Vercel dashboard. Imports JSON, allows review/editing, generates project files, and builds a ZIP in the browser.
- extension/manifest.json: Chrome Manifest V3 extension.
- extension/recorder.js: captures supported interaction events and locator metadata.
- extension/background.js: session lifecycle and chrome.storage.local persistence.
- extension/popup.*: controls recording and exports JSON.
- tests/generator.test.mjs: Node built-in checks.
- vercel.json: static hosting and basic security headers.

## Data flow
User-selected target → extension content recorder → local extension storage → explicit JSON export → dashboard import → user review → deterministic generator → client-side ZIP export → user-run local test framework.

## Trust boundaries
Target-page content and attributes are untrusted data. Recordings are not uploaded automatically. Sensitive input values are redacted where detected. The Vercel dashboard has no server-side recording store or test execution service.

## Limitations
This MVP supports Python + Playwright + pytest and Python + Selenium + unittest only. Complex custom widgets, closed shadow roots, cross-origin frames, file transfers and popups need further implementation. Review generated selectors and assertions before execution.

## Next milestones
1. Improve lifecycle and navigation capture reliability.
2. Add selector uniqueness inspection and correction UI.
3. Add fixture-based browser end-to-end tests.
4. Build a controlled local runner bridge.
5. Add language adapters only after compile/run validation.
6. Add optional AI with explicit consent and redaction.
7. Add a genuinely isolated cloud runner if justified.
