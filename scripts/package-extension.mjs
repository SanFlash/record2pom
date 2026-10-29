import { spawnSync } from "node:child_process";
import process from "node:process";

const candidates = process.platform === "win32"
  ? [{ command: "python", args: [] }, { command: "py", args: ["-3"] }, { command: "python3", args: [] }]
  : [{ command: "python3", args: [] }, { command: "python", args: [] }];

for (const candidate of candidates) {
  const probe = spawnSync(candidate.command, [...candidate.args, "--version"], { encoding: "utf8", stdio: "ignore" });
  if (probe.error || probe.status !== 0) continue;

  const result = spawnSync(
    candidate.command,
    [...candidate.args, "scripts/package_extension.py"],
    { cwd: process.cwd(), encoding: "utf8", stdio: "inherit" }
  );
  if (result.error) {
    console.error("Could not start Python packaging script:", result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error("Python 3 was not found. Install Python 3.10+ and rerun: npm run package:extension");
process.exit(1);
