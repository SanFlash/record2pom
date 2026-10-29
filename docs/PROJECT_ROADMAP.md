# Record2POM Product Roadmap

**Creator attribution:** Satyendra Kumar Namdeo

This roadmap is an engineering plan, not a promise that every idea is already implemented. A checkbox should be marked complete only after the implementation exists and the stated verification has passed.

## Foundation — recording and generation

- [x] Versioned recording normalization and input limits.
- [x] Chrome Manifest V3 recording lifecycle.
- [x] Python + Playwright + pytest generation.
- [x] Python + Selenium + unittest generation.
- [x] Locator ranking and generated page-object helpers.
- [x] Downloadable project archive and generated local runner.
- [x] Synthetic browser fixture and generated-project validation.

## Reliability and evidence

- [x] CI executes a generated Playwright project against the local fixture.
- [x] CI extracts and validates the generated Selenium archive and checks Python syntax.
- [x] Diagnostics regression coverage for JSON/HTML reports, step timelines, logs and repair hints.
- [x] Multi-step journey covering dynamic tab state, text input, select, checkbox, submission and outcome assertion.
- [x] Failure-injection E2E coverage for missing/ambiguous locators, non-zero exit status, step diagnostics and screenshots (CI passed).
- [ ] Per-step screenshot capture with secret-aware evidence handling.
- [x] Explainable locator candidate rankings include measured match status, strategy score, reasons, and explicit recommendations without silently changing test meaning.
- [x] Per-run evidence index with normalized relative paths and artifact integrity metadata; CI verifies indexed paths, sizes and SHA-256 hashes.
- [ ] Installed Chrome smoke-test evidence collected and reviewed.

## Extension experience

- [x] Start, pause/resume, stop, clear and JSON export controls.
- [x] Studio handoff with import acknowledgement state.
- [x] Retry affordance for a failed or stalled handoff.
- [ ] Manual Chrome validation across a clean profile and supported Chromium version.
- [x] Navigation capture rechecks persisted session state to avoid page-initialization races; automated tests cover duplicate notifications and paused sessions.
- [ ] Manual validation of navigation and session recovery in installed Chrome (automated simulation is not a substitute).
- [x] Add semantic labels, polite status/live regions, dynamic accessible recording-state announcements, visible keyboard focus, and reduced-motion styling to the popup; source-contract tests cover these safeguards.
- [ ] Manually verify keyboard-only operation and screen-reader announcements in installed Chrome.

## Developer experience

- [x] Architecture, recording format, locator strategy and extension smoke-test documentation.
- [x] Synthetic sample recording checked into the repository.
- [x] Contributor and security policies.
- [x] Add a one-command validation script (`npm run validate`) that runs fast checks and reports skipped browser prerequisites clearly; CI confirms the fast and browser E2E suites pass.
- [x] Build a versioned Chrome extension ZIP in CI; validate required files, safe archive paths, ZIP CRCs, membership, and SHA-256 checksum sidecar.
- [x] Add a changelog and documented release notes policy with manual Chrome smoke-test gates.
- [ ] Publish a tagged GitHub Release after installed-Chrome validation and checksum review.

## Acceptance criteria for future work

1. A new feature has a test that fails before the change and passes after it.
2. Browser-dependent behavior is exercised against a deterministic local fixture where practical.
3. Failures are actionable and do not silently skip test steps.
4. Generated output is inspected for valid syntax and safe archive paths.
5. CI status is checked after the final commit.
6. Documentation separates implemented behavior from future plans and manual-only verification.
