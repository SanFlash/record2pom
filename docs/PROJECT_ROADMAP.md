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
- [ ] Failure-injection coverage for missing/ambiguous locators and failure artifact assertions.
- [ ] Per-step screenshot capture with secret-aware evidence handling.
- [ ] Recovery recommendations that never silently change test meaning.
- [ ] Installed Chrome smoke-test evidence collected and reviewed.

## Extension experience

- [x] Start, pause/resume, stop, clear and JSON export controls.
- [x] Studio handoff with import acknowledgement state.
- [x] Retry affordance for a failed or stalled handoff.
- [ ] Manual Chrome validation across a clean profile and supported Chromium version.
- [ ] Document and test behavior when the target tab navigates or the extension reloads.
- [ ] Expand accessibility and keyboard checks for the popup.

## Developer experience

- [x] Architecture, recording format, locator strategy and extension smoke-test documentation.
- [x] Synthetic sample recording checked into the repository.
- [x] Contributor and security policies.
- [ ] Add a one-command validation script that runs fast checks and reports skipped browser prerequisites clearly.
- [ ] Publish a tagged release with a versioned extension ZIP and checksums.
- [ ] Add a changelog and release notes policy.

## Acceptance criteria for future work

1. A new feature has a test that fails before the change and passes after it.
2. Browser-dependent behavior is exercised against a deterministic local fixture where practical.
3. Failures are actionable and do not silently skip test steps.
4. Generated output is inspected for valid syntax and safe archive paths.
5. CI status is checked after the final commit.
6. Documentation separates implemented behavior from future plans and manual-only verification.
