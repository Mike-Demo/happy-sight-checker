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

if (!(await isDirectory(source))) {
  if (await isDirectory(target)) {
    console.log("Static output already present at dist/client — nothing to copy.");
    process.exit(0);
  }
  console.error("No static output found at .output/public. Run the build first.");
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
console.log("Copied .output/public -> dist/client");
