# Record2POM MVP architecture

## Components
- index.html, styles.css, app.js: static Vercel dashboard. Imports JSON, allows review/editing, generates project files, and builds a ZIP in the browser.
- extension/manifest.json: Chrome Manifest V3 extension.
- extension/recorder.js: captures supported interaction events and locator metadata.
- extension/background.js: session lifecycle and chrome.storage.local persistence.
- extension/popup.*: controls recording and exports JSON.
- core.js: versioned recording validation, canonical intermediate-representation (IR) normalization, sensitive-value removal, and locator-candidate ranking.
- fixtures/universal-demo/: neutral fixture site for manual recorder smoke testing.
- generated run_tests.py: local, bounded-time execution of the generated project and structured JSON/log reporting.
- tests/generator.test.mjs: Node built-in generator, schema, selector and Python-syntax checks.
- vercel.json: static hosting and basic security headers.

## Data flow
User-selected target → extension content recorder → local extension storage → explicit JSON export → schema validation and canonical IR normalization → dashboard review → locator ranking → deterministic generator → client-side ZIP export → generated local runner → test process → JSON/log report (plus pytest JUnit XML for the Playwright adapter).

## Trust boundaries
Target-page content and attributes are untrusted data. Recordings are not uploaded automatically. Sensitive input values are redacted where detected. The Vercel dashboard has no server-side recording store or test execution service. The generated runner executes only after download on the user's machine; it is not a sandbox.

## Limitations
This MVP supports Python + Playwright + pytest and Python + Selenium + unittest only. Complex custom widgets, closed shadow roots, cross-origin frames, file transfers and popups need further implementation. Review generated selectors and assertions before execution.

## Next milestones
1. Improve lifecycle and navigation capture reliability.
2. Add selector uniqueness inspection and correction UI.
3. Run the documented neutral fixture workflow in a real Chrome/Chromium session and retain observed evidence.
4. Add a controlled local runner bridge only if the user explicitly needs dashboard-triggered execution; do not expose arbitrary commands over HTTP.
5. Add a canonical typed intermediate representation before expanding generator adapters.
6. Add language adapters only after compile/run validation.
7. Add optional AI with explicit consent and redaction.
8. Add a genuinely isolated cloud runner if justified.
