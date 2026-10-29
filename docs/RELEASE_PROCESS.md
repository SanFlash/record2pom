# Extension Packaging and Release Process

**Creator attribution:** Satyendra Kumar Namdeo

This process produces a reviewable extension archive. A CI artifact is not itself a published GitHub Release, and a successful CI run does not replace a manual Chrome smoke test.

## Build locally

Requirements: Node.js 20+ and Python 3.10+.

From the repository root:

\`\`\`bash
npm run package:extension
\`\`\`

The command reads the extension version from \`extension/manifest.json\`, checks Manifest V3 and required assets, creates a versioned archive under \`dist/\`, validates ZIP CRCs and archive membership, and writes a SHA-256 sidecar.

Expected output for the current manifest version:

- \`dist/record2pom-extension-v0.2.0.zip\`
- \`dist/record2pom-extension-v0.2.0.zip.sha256\`

The output version is derived from the manifest; do not hardcode a new version into the packaging script.

## Verify the checksum

Linux/macOS:

\`\`\`bash
cd dist
sha256sum -c record2pom-extension-v0.2.0.zip.sha256
\`\`\`

Windows PowerShell:

\`\`\`powershell
$expected = (Get-Content .\\dist\\record2pom-extension-v0.2.0.zip.sha256).Split()[0]
$actual = (Get-FileHash .\\dist\\record2pom-extension-v0.2.0.zip -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "Extension archive checksum mismatch" }
\`\`\`

Replace the example version with the filename generated from the manifest if the version changes.

## CI artifact

GitHub Actions builds the versioned ZIP, validates it, and uploads the ZIP plus its checksum sidecar as a short-retention workflow artifact. Download and inspect both files from the successful workflow run. Do not publish an artifact if the workflow fails.

## Release gates

Before creating a Git tag or GitHub Release:

1. Update \`extension/manifest.json\` to the intended release version.
2. Update \`CHANGELOG.md\` with user-visible changes and any known limitations.
3. Run \`npm test\`, \`npm run validate\`, and \`npm run package:extension\`.
4. Confirm CI passed on the exact commit intended for release.
5. Install the unpacked extension in a clean Chrome profile and complete [the extension test plan](EXTENSION_TEST_PLAN.md), recording evidence for the manual-only cases.
6. Inspect the archive contents and verify the SHA-256 sidecar independently.
7. Publish the versioned ZIP and checksum together, with concise release notes and the tested commit identifier.

Do not mark manual Chrome verification complete based on unit tests or CI packaging alone. Keep recordings synthetic and avoid including secrets, personal data, or real session exports in release artifacts.
