# Phase 6 — Local execution and honest reports

## Delivered in this phase
- Generated projects now include `run_tests.py`.
- The runner selects pytest/Playwright or unittest/Selenium based on the generated dependency manifest.
- Commands are passed as an argument array with `shell=False`; no shell command string is executed.
- Execution has a configurable timeout, clamped to 1–1800 seconds.
- The runner captures stdout/stderr and writes `reports/run-results.json` and `reports/run.log`.
- Playwright projects ask pytest to write `reports/junit.xml`.
- Reports include actual process status, exit code, duration, timestamps, timeout state and command.
- Added a neutral interaction fixture and a documented manual smoke-test procedure.
- Added regression tests for schema rejection, event limits, locator ranking, website-agnostic behavior, both generators, runner contents and generated Python syntax (when Python is installed).

## Run the project
1. Generate and download a project.
2. Inspect every generated file and verify the target is an authorized test environment.
3. Create and activate a virtual environment.
4. Install the generated `requirements.txt`.
5. Install browser prerequisites for the selected engine.
6. Run `python run_tests.py`.
7. Inspect `reports/run-results.json`, `reports/run.log`, and (for Playwright) `reports/junit.xml`.

## Trust and security boundary
This is a local convenience runner, **not a sandbox**. Generated test source is executable Python and can perform actions available to the user account. Review it before execution. Do not use production credentials or untrusted recordings. The Vercel dashboard does not execute code, and no HTTP endpoint accepts arbitrary commands.

## Evidence status
The source and test harness have been committed. JavaScript syntax and JSON configuration were checked through the repository tools. The repository's GitHub Actions status was not returned by the available connection, and a real browser journey plus a generated test run have **not** been executed in this session. Do not treat project generation or a READY Vercel deployment as proof that the browser test passed.
