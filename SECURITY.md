# Security Policy

**Project:** Record2POM Universal POM Automation Studio  
**Creator attribution:** Satyendra Kumar Namdeo

## Supported use

Use Record2POM only on systems you own or are explicitly authorized to test. Use synthetic accounts and non-sensitive data. Do not use the recorder to collect credentials, private messages, payment data, personal records or production secrets.

## Reporting a vulnerability

Please do not publish exploit details, access tokens, real recordings, screenshots containing personal data, or sensitive generated reports in a public issue. Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If private reporting is unavailable, open a minimal issue asking for a private contact route without including exploit payloads or secrets.

Include a concise impact summary, affected commit/version, reproduction steps using a local or synthetic fixture, and a proposed mitigation if known. Allow maintainers reasonable time to investigate before public disclosure.

## Data handling and limitations

- Recordings and sessions are stored locally in the browser extension until exported or cleared; review browser storage and exports as you would any test artifact.
- The extension requests broad HTTP/HTTPS host access so the user can select a target site. Review permissions before enabling it.
- Sensitive-field and URL redaction is heuristic and may miss secrets in custom controls, text, URLs or page metadata.
- Generated tests and reports run locally. Screenshots, logs, traces and HTML reports can contain page content or test data.
- Generated projects are not sandboxed. Inspect source code and dependencies before running them.
- The hosted Studio does not provide server-side execution, user accounts, cloud test storage or a remote test queue.

## Safe defaults for contributors

- Never commit API keys, passwords, cookies, session tokens, personal data or private test recordings.
- Use synthetic fixtures for regression tests.
- Keep generated commands argument-based and bounded by timeouts.
- Do not add stealth, authentication bypass, CAPTCHA bypass or unauthorized scanning functionality.
- Document permission changes and add regression tests for validation and redaction behavior.
