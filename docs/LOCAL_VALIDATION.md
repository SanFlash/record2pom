# Local Validation

**Creator attribution:** Satyendra Kumar Namdeo

Record2POM provides a single local command that runs the fast Node.js regression suite and, when prerequisites are installed, the browser end-to-end suite.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.10 or newer for generated-project and browser checks.
- For browser E2E tests: `pytest`, `pytest-playwright`, Playwright, and its Chromium browser.

## Run validation

From the repository root:

```bash
npm run validate
```

The command always runs `npm test` first. It then checks whether Python, pytest, Playwright and the Playwright Chromium executable are available. If they are, it runs:

```bash
python -m pytest -q tests/e2e
```

If browser prerequisites are missing, the command prints the exact installation commands and clearly marks browser E2E as skipped. A successful exit in that situation means **fast tests passed**, not that browser E2E passed. Install the prerequisites and rerun validation when browser coverage is required.

## Install browser-test prerequisites

Use the Python interpreter you intend to use for the project:

```bash
python -m pip install "pytest-playwright>=0.5,<1"
python -m playwright install chromium
npm run validate
```

On systems where the Python executable is named `python3`, replace `python` with `python3`. On Windows, the Python launcher `py` can be used if that is how Python is installed.

## CI versus local validation

GitHub Actions installs Chromium and runs the Node.js tests and browser E2E tests as separate required steps. The local validation command is designed to be friendly to contributors who have not installed a browser yet; it reports skipped checks rather than pretending they passed.

The validator does not install software, alter browser settings, contact production websites, or execute generated tests against a live third-party target.
