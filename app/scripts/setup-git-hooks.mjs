import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..");

if (process.env.CI) {
  process.exit(0);
}

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
} catch {
  process.exit(0);
}

try {
  const currentHooksPath = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  if (currentHooksPath && currentHooksPath !== ".githooks") {
    console.warn(`Skipping hooks install because core.hooksPath is already set to "${currentHooksPath}".`);
    process.exit(0);
  }
} catch {
  // No hooksPath configured yet.
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
} catch {
  console.warn("Unable to configure git hooks automatically. Run `cd app && pnpm hooks:install` manually.");
}
