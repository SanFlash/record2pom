# Changelog

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
