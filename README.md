# Record2POM — Universal POM Automation Studio

A website-agnostic browser recording and Page Object Model generation MVP. It combines a static dashboard suitable for Vercel with a separately installed Chrome/Chromium extension that records interactions in the active browser tab.\n\n**Production deployment:** https://record2pom.vercel.app/ (Vercel reports the deployment as READY; an interactive browser smoke test has not been verified from this session).

**Honest status:** This is an MVP foundation, not a claim that every feature in the full specification is complete. The dashboard generates project files locally in the browser. It does not execute generated tests or claim tests passed.

## Features
- Runtime user-supplied HTTP/HTTPS target URL; no website-specific production branches.
- Browser extension records clicks, form changes, select changes, checkbox/radio changes, Enter and navigation metadata.
- Sensitive field values are redacted by the extension.
- Local extension storage and explicit JSON export/import.
- Action timeline, manual action entry, editing and user-authored assertions.
- Pre-flight readiness report that explains missing URL/configuration, unusable or uncertain locators, missing assertions, redacted inputs, and what still requires local verification.
- Export of the reviewed, normalized recording JSON for portable backups and repeatable debugging.
- Canonical versioned recording intermediate representation (IR), legacy event normalization, event-count/field limits, and sensitive-value removal.
- Locator health labels (unique, ambiguous, unverified, missing) and editable test ID, role/name, label, placeholder, and CSS locator strategies.
- Generated local runner with timeout, captured output, JSON result report, log file, and pytest JUnit output.
- Deterministic Python + Playwright + pytest and Python + Selenium + unittest project generators.
- Client-side ZIP export of generated project files.
- Vercel static hosting configuration and dependency-free local server.

## Run locally
Requires Node.js 20+.
    npm test
    npm start
Open http://localhost:3000. The GitHub Actions workflow also installs Chromium and runs the real-browser fixture test with `python -m pytest -q tests/e2e`.

## Deploy to Vercel
Import SanFlash/record2pom in Vercel. Select framework preset Other, root directory repository root, build command empty, and output directory repository root. No environment variables are required. After deployment, verify the URL loads and test import and ZIP download. Do not claim deployment verified until this smoke test has been performed.

## Install extension
Open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension directory. Open an authorized HTTP/HTTPS site, reload it, start recording, stop and export JSON, then import it into the dashboard.

## Generate and run
Review actions and locators, add explicit assertions, generate and download the project, extract it, create a Python virtual environment, install requirements and browser prerequisites, and run the generated README commands. Generation alone is not test execution. The dashboard normalizes imported recordings into a canonical schema before generation; legacy `input`/`type`/`navigation` aliases are mapped explicitly, and values marked sensitive are discarded. The exported `run_tests.py` runs only the generated project's declared pytest or unittest command using an argument array (not a shell), enforces a timeout, and writes `reports/run-results.json` and `reports/run.log`. It is not an operating-system sandbox: inspect the generated code before running it.

## Supported generator combinations
- Playwright + Python + pytest: MVP generator.
- Selenium WebDriver + Python + unittest: MVP generator.
- Other languages/frameworks: not implemented.

## Limitations and security
The initial extension cannot guarantee every website or browser surface. Complex widgets, closed shadow roots, cross-origin frames, file transfers and popups need more work. Enterprise profile is a starter skeleton. The dashboard has no accounts, database, server execution, cloud queue, AI integration or hosted test runner. Review broad HTTP/HTTPS extension permissions. Inspect recordings before sharing. Never commit secrets or test production data without authorization. Authentication, CAPTCHA and MFA are not bypassed.
