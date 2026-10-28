# Contributing to Record2POM

Thank you for helping improve Record2POM. This repository focuses on transparent browser recording, reviewable Page Object Model generation, and locally executed tests.

**Creator attribution:** Satyendra Kumar Namdeo

## Before opening a change

1. Search existing issues and tests for related behavior.
2. Keep changes focused and explain the user problem they solve.
3. Add or update tests for behavior changes.
4. Update documentation when the recording schema, generated project, extension permissions or workflow changes.
5. Use synthetic test data only.

## Local setup

Requirements: Node.js 20+ and Python 3.12 recommended for the current CI matrix.

```bash
git clone https://github.com/SanFlash/record2pom.git
cd record2pom
npm test
npm start
```

Open `http://localhost:3000` for the Studio.

To run the browser-based tests:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
python -m pip install "pytest-playwright>=0.5,<1"
python -m playwright install chromium
python -m pytest -q tests/e2e
```

On Linux CI or a fresh Linux machine, browser system dependencies may also be required; see Playwright's installation guidance.

## Quality gates

- `npm test` passes.
- `python -m pytest -q tests/e2e` passes when browser prerequisites are installed.
- Generated ZIPs have safe paths and expected files.
- Generated Python source parses and behaves against the local fixture.
- Extension manifest, icons and referenced assets remain valid.
- README and security notes accurately describe the behavior.
- Accessibility, responsive behavior and reduced-motion support remain intact.

## Engineering conventions

- Prefer explicit validation and actionable errors.
- Do not silently choose the first element when a locator is ambiguous.
- Do not log secret values to make debugging easier.
- Keep generated output deterministic where possible.
- Avoid adding runtime dependencies to the dashboard without a clear reason.
- Treat UI animation as progressive enhancement, not a requirement for task completion.
- Never claim a manual browser test was performed unless it actually was.

## Pull request checklist

- [ ] Problem and intended behavior are described.
- [ ] Tests cover the change and relevant edge cases.
- [ ] No credentials or personal data are included.
- [ ] Documentation and examples are updated.
- [ ] Keyboard navigation and reduced-motion behavior were considered for UI changes.
- [ ] CI results are reviewed and any known limitation is stated.
