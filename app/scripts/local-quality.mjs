import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";


import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..");

function runGit(args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    }).trim();
  } catch (error) {
    return "";
  }
}

function hasGitRef(ref) {
  return Boolean(runGit(["rev-parse", "--verify", ref]));
}

function resolveBaseRef() {
  const candidates = ["origin/main", "main"];

  for (const candidate of candidates) {
    if (hasGitRef(candidate)) {
      return candidate;
    }
  }

  return "";
}

function resolveDiffBase() {
  const baseRef = resolveBaseRef();

  if (baseRef) {
    const mergeBase = runGit(["merge-base", "HEAD", baseRef]);

    if (mergeBase) {
      const headSha = runGit(["rev-parse", "HEAD"]);

      if (mergeBase !== headSha) {
        return mergeBase;
      }
    }
  }

  if (hasGitRef("HEAD~1")) {
    return runGit(["rev-parse", "HEAD~1"]);
  }

  return "";
}

function getChangedFiles() {
  const diffBase = resolveDiffBase();

  if (!diffBase) {
    return [];
  }

  const output = runGit(["diff", "--name-only", diffBase, "HEAD"]);

  return output ? output.split("\n").filter(Boolean) : [];
}

function getChangedAppCodeFiles() {

  const diffBase = resolveDiffBase();
  if (!diffBase) return [];

  const output = runGit(["diff", "--name-only", diffBase, "HEAD"]);
  if (!output) return [];

  return output.split("\n")
    .filter(Boolean)
    .filter((file) => /^app\/.+\.(js|jsx|mjs|cjs)$/.test(file))
    .map((file) => file.replace(/^app\//, ""))
    .filter((file) => fs.existsSync(path.resolve(appDir, file)));
}


function runCommand(command, args, label) {
  console.log(`\n> ${label}`);
  const nextEnv = { ...process.env };

  if (command === "pnpm" && args.includes("jest")) {
    const existingNodeOptions = process.env.NODE_OPTIONS || "";
    const heapOption = "--max-old-space-size=4096";
    nextEnv.NODE_OPTIONS = existingNodeOptions.includes(heapOption)
      ? existingNodeOptions
      : `${existingNodeOptions} ${heapOption}`.trim();
  }

  const result = spawnSync(command, args, {
    cwd: appDir,
    stdio: "inherit",
    env: nextEnv,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runLintChanged() {
  const files = getChangedAppCodeFiles();

  if (files.length === 0) {
    console.log("No changed app JS files detected for ESLint.");
    return;
  }

  runCommand("pnpm", ["exec", "eslint", ...files], "Lint changed app files");
}

function runRelatedTests() {
  const files = getChangedAppCodeFiles();

  if (files.length === 0) {
    console.log("No changed app JS files detected for related Jest tests.");
    return;
  }

  runCommand(
    "pnpm",
    ["exec", "jest", "--runInBand", "--findRelatedTests", ...files],
    "Run Jest related tests for changed app files",
  );
}

function runFullTests() {
  runCommand("pnpm", ["exec", "jest", "--runInBand"], "Run full Jest suite");
}

function runBuild() {
  runCommand("pnpm", ["build"], "Run production build");
}

const mode = process.argv[2];

switch (mode) {
  case "lint:changed":
    runLintChanged();
    break;
  case "test:related":
    runRelatedTests();
    break;
  case "validate:changed":
    runLintChanged();
    runRelatedTests();
    break;
  case "validate:local":
    runLintChanged();
    runFullTests();
    runBuild();
    break;
  default:
    console.error(
      "Usage: node ./scripts/local-quality.mjs <lint:changed|test:related|validate:changed|validate:local>",
    );
    process.exit(1);
}
