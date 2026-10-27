# Record2POM — Universal POM Automation Studio

Record2POM is a website-agnostic browser recorder and Page Object Model (POM) project generator. It pairs a static dashboard with a separately installed Chrome/Chromium extension, then generates Python automation projects from reviewed recordings.

**Production:** https://record2pom.vercel.app/  
**Repository:** https://github.com/SanFlash/record2pom

> **Project status:** MVP foundation. Generation, Node tests, and the browser-based fixture workflow are covered by GitHub Actions. Vercel reports production deployments as READY. This does not imply the extension has been manually smoke-tested on every browser or website; perform the local checks below before relying on a recording.

## Features

- User-supplied HTTP/HTTPS target URLs; no website-specific production branches.
- Chrome Manifest V3 recorder for supported clicks, form changes, select changes, checkbox/radio changes, Enter presses, and navigation metadata.
- Semantic role detection for buttons, links, textboxes, comboboxes, checkboxes, and radio buttons.
- Locator candidates for `data-testid`, role/name, label, placeholder, CSS IDs, and compatible `data-test`/`data-qa` attributes.
- Sensitive field value redaction in the content recorder and a second validation/redaction pass in the background service worker.
- File-input values are not recorded; action kinds, payload sizes, field lengths, and the 5,000-event session limit are validated.
- Local extension storage with explicit JSON export/import.
- Action timeline, manual action entry, action editing, and user-authored assertions.
- Pre-flight readiness report for missing configuration, uncertain locators, missing assertions, redacted values, and steps requiring local verification.
- Canonical versioned recording intermediate representation (IR), legacy event normalization, and bounded fields.
- Locator health labels: unique, ambiguous, unverified, or missing.
- Deterministic Python + Playwright + pytest and Python + Selenium + unittest project generators.
- Client-side ZIP export; generated tests run locally after download, not on the dashboard.
- Generated local runner with timeout, captured output, JSON results, log file, and pytest JUnit output.

## Local development and verification

Requires Node.js 20+.

```bash
npm test
npm start
```

Open `http://localhost:3000`.

The GitHub Actions workflow runs the Node test suite, installs Chromium, and runs the browser-based fixture and generated-project workflow:

```bash
python -m pip install "pytest-playwright>=0.5,<1"
python -m playwright install --with-deps chromium
python -m pytest -q tests/e2e
```

The Node suite includes mocked Chrome extension tests for background lifecycle handling and recorder event capture. These tests provide repeatable coverage, but they are not a substitute for a manual Chrome extension smoke test.

## Install and smoke-test the extension

1. Open `chrome://extensions` and enable **Developer mode**.
2. Select **Load unpacked** and choose this repository's `extension/` directory.
3. Open an authorized HTTP/HTTPS test site and reload the page after installing the extension.
4. Start recording, interact with a safe test form, pause/resume, stop, and export the JSON.
5. Confirm password-like values and file paths are absent from the exported recording.
6. Import the JSON into the dashboard, review locators and assertions, generate a project, download the ZIP, and execute it locally against a test target.

Use a neutral fixture or a system you are authorized to test. Browser extensions cannot inject into every browser-internal page, and some websites restrict content scripts.

## Deploy to Vercel

Import `SanFlash/record2pom` in Vercel. Use framework preset **Other**, repository root as the root directory, no build command, and repository root as the output directory. No environment variables are required for the static dashboard.

After a deployment reports READY, open the URL and manually verify dashboard load, recording JSON import, generated file preview, and ZIP download. A READY deployment alone is not an end-to-end smoke test.

## Generate and run a project

1. Import a recording and review every action and locator.
2. Add explicit assertions where appropriate and resolve uncertain locators.
3. Generate the project and download its ZIP.
4. Extract it, create a Python virtual environment, and install the generated requirements.
5. Install browser prerequisites for Playwright if using that adapter.
6. Read the generated README and inspect the code before running tests.
7. Execute the generated runner and review `reports/run-results.json`, `reports/run.log`, and JUnit output where applicable.

The generated `run_tests.py` invokes the declared pytest or unittest command with an argument array rather than a shell, enforces a timeout, and writes local reports. It is **not** an operating-system sandbox. Generation is not test execution, and the dashboard never claims generated tests passed merely because files were created.

## Supported generator combinations

| Engine | Language | Test framework | Status |
|---|---|---|---|
| Playwright | Python | pytest | MVP generator |
| Selenium WebDriver | Python | unittest | MVP generator |
| Other engines/languages | — | — | Not implemented |

## Known limitations and security

- Dynamic widgets, closed shadow roots, cross-origin frames, popups, file transfers, and highly customized controls may require manual locator or workflow adjustments.
- The extension is scoped to HTTP/HTTPS pages but uses broad host permissions to support user-selected targets; review permissions before installation.
- Sensitive-value detection is heuristic, not a guarantee. Inspect recordings before sharing and never use production credentials or personal data in test recordings.
- The dashboard has no accounts, database, server-side execution, cloud queue, hosted runner, or AI integration.
- The local runner is not sandboxed. Review generated code before running it.
- Authentication, CAPTCHA, MFA, access controls, or other security mechanisms are not bypassed.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PHASE-6-LOCAL-EXECUTION.md](docs/PHASE-6-LOCAL-EXECUTION.md).

Next milestone: improve locator correction and live uniqueness re-measurement, add broader real-browser extension smoke coverage, and validate generated projects across representative fixture journeys before adding new generator adapters.
