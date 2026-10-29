import { spawnSync } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const pythonCandidates = isWindows ? ["python", "py"] : ["python3", "python"];
const requireBrowser = process.argv.includes("--require-browser");

function run(command, args, label, options = {}) {
  console.log("\n▶ " + label);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
    shell: isWindows && command.endsWith(".cmd"),
    ...options
  });
  if (result.error) return { status: result.status ?? 1, error: result.error };
  return { status: result.status ?? 1 };
}

function findPython() {
  for (const candidate of pythonCandidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8", stdio: "ignore" });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

const fast = run(npmCommand, ["test"], "Run Record2POM fast test suite");
if (fast.status !== 0) {
  console.error("\n✖ Fast tests failed. Fix these failures before relying on generated output.");
  process.exit(fast.status);
}

const python = findPython();
if (!python) {
  console.log("\n⚠ Browser E2E checks skipped: Python was not found.");
  console.log("  Install Python 3.10+ and then run: python -m pip install \"pytest-playwright>=0.5,<1\"");
  console.log("  Install Chromium with: python -m playwright install chromium");
  console.log("\n✓ Fast checks passed; browser E2E checks were not run.");
  process.exit(requireBrowser ? 1 : 0);
}

const browserReady = run(
  python,
  ["-c", "import os, pytest, playwright; from playwright.sync_api import sync_playwright; p=sync_playwright().start(); path=p.chromium.executable_path; p.stop(); raise SystemExit(0 if os.path.isfile(path) else 2)"],
  "Check Python, pytest, Playwright and Chromium prerequisites"
);

if (browserReady.status !== 0) {
  console.log("\n⚠ Browser E2E checks skipped: Python dependencies or the Playwright Chromium browser are missing.");
  console.log("  Install dependencies: " + python + " -m pip install \"pytest-playwright>=0.5,<1\"");
  console.log("  Install Chromium: " + python + " -m playwright install chromium");
  console.log("\n" + (requireBrowser ? "✖ Strict validation failed: browser E2E checks were not run." : "✓ Fast checks passed; browser E2E checks were not run."));
  process.exit(requireBrowser ? 1 : 0);
}

const e2e = run(python, ["-m", "pytest", "-q", "tests/e2e"], "Run browser E2E tests against the local fixture");
if (e2e.status !== 0) {
  console.error("\n✖ Browser E2E tests failed.");
  process.exit(e2e.status);
}

console.log("\n✓ Fast checks and browser E2E tests passed.");
