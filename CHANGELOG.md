# Changelog

- Chrome extension `0.2.2` now selects the highest-priority locator verified as unique during recording and carries it into Studio and generated projects.


## Unreleased — runtime locator self-healing

- Generated Playwright Page Objects now fall back to live-DOM fingerprint matching when captured selectors become stale.
- The fallback uses recorded element metadata and only accepts a uniquely highest-scoring visible, enabled element; ambiguous matches fail closed.
- Locator failure diagnostics now include the current page URL and title to expose wrong-page or wrong-state recordings.
- Added an end-to-end regression scenario that deliberately supplies an obsolete test ID and expects the generated test to recover using the live button semantics.


## Unreleased — integrated recorder and generated-project setup

- Bumped the Chrome recorder to `0.2.1` and added recorder-version metadata to Studio handoffs for compatibility diagnostics.
- Added a generated Windows `run.ps1` bootstrap that creates a virtual environment, installs dependencies, prepares `.env`, installs Playwright Chromium, validates the project, and runs the recorded journey.
- Unified generated action sequence numbers and redacted environment-variable names so `.env.example` matches the generated Page Object code even when imported event sequence values are non-contiguous.
- Added dotenv loading to Selenium-generated test modules as well as Playwright projects.


Notable project changes are documented here. Entries describe repository changes and do not imply that an unperformed manual browser test passed.

## Unreleased

- Automatically select and mark the best verified-unique locator found in Inspect mode, preserve the selection through Studio import, and prioritize it in generated framework actions. If no unique locator is verified, retain ranked fallbacks and report the limitation.

- Improve automatic locator discovery for custom controls using semantic names, associated labels, placeholders, test attributes, names, IDs, link targets, and measured CSS paths.
- Add extension **Inspect & Repair Locator** mode to select an element in the page and attach its locator candidates to a recorded action that needs repair.

- Scope extension recording events and navigation to the tab where the recording started.
- Add one-command local validation with clear browser-prerequisite reporting.
- Add versioned Chrome extension ZIP packaging with archive integrity checks and a SHA-256 sidecar.
- Publish the packaged extension and checksum as a CI artifact for inspection before a formal release.

## 0.2.0

- Initial documented Manifest V3 extension package version.
- Recording lifecycle, Studio handoff, session export, and sensitive-value redaction.
