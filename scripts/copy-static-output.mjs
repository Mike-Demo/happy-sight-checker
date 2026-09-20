// Copies the prerendered static site into dist/client, where static hosts
// expect it. Idempotent: safe to run repeatedly, and a no-op when the build
// already emitted into dist/client.
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, ".output", "public");
const target = path.join(root, "dist", "client");

async function isDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

if (await isDirectory(source)) {
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  console.log("Copied .output/public -> dist/client");
} else if (await isDirectory(target)) {
  console.log("Static output already present at dist/client — nothing to copy.");
} else {
  console.error("No static output found at .output/public. Run the build first.");
  process.exit(1);
}

// A published folder without index.html serves nothing. Fail the build rather
// than shipping assets with no entry page.
if (!(await isFile(path.join(target, "index.html")))) {
  console.error(
    "dist/client/index.html is missing — the prerender pass did not run. " +
      "Use the static build (STATIC_EXPORT=1) so pages are emitted as HTML.",
  );
  process.exit(1);
}
console.log("Verified dist/client/index.html exists.");
