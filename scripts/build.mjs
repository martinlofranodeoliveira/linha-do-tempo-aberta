import { mkdir, copyFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const files = [
  "index.html",
  "favicon.svg",
  "src/main.js",
  "src/app.js",
  "src/engine.js",
  "src/storage.js",
  "src/example.js",
  "src/styles.css",
  "assets/fonts/atkinson-hyperlegible-next-variable.ttf",
  "assets/fonts/OFL-Atkinson-Hyperlegible-Next.txt",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output"))
  throw new Error("Use: node scripts/build.mjs [--output NOVA_PASTA]");
const output = args.length ? resolve(args[1]) : join(root, "dist");
// A build creates a new directory and never recursively deletes or overwrites an existing one.
await mkdir(output, { recursive: false });
await mkdir(join(output, "src"));
await mkdir(join(output, "assets", "fonts"), { recursive: true });
for (const file of files)
  await copyFile(join(root, file), join(output, file), constants.COPYFILE_EXCL);
if (
  !(await readFile(join(output, "index.html"), "utf8")).includes("seed1f359dd3")
)
  throw new Error("Direction contract missing from built output");
console.log(
  JSON.stringify({
    build: "static",
    files: files.length,
    runtimeDependencies: 0,
    output,
  }),
);
