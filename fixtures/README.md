# Universal fixture smoke test

Serve this directory over HTTP so the browser extension can access it:

    python -m http.server 8765 --directory fixtures/universal-demo

Open http://127.0.0.1:8765, load the extension in Chrome/Chromium, start recording, then try:
- click Overview or Details;
- fill Full name and Notes;
- select a country;
- toggle Send updates;
- submit the form.

Stop and export the recording JSON, import it into the dashboard, inspect the generated locators and add explicit assertions for the observed outcome. Generate and download the project, then run it locally after reviewing the code and installing its dependencies.

This fixture is deliberately neutral and does not prove cross-site compatibility by itself. No real browser end-to-end result is claimed until the workflow is actually executed.
