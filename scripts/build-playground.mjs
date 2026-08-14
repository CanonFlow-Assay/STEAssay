import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "playground");
const output = resolve(root, "dist", "playground");

await mkdir(output, { recursive: true });
await Promise.all(
  ["index.html", "styles.css"].map((file) =>
    cp(resolve(source, file), resolve(output, file)),
  ),
);
await mkdir(resolve(output, "core"), { recursive: true });
await Promise.all([
  cp(
    resolve(root, "dist", "src", "core", "analyzer.js"),
    resolve(output, "core", "analyzer.js"),
  ),
  cp(resolve(root, "dist", "src", "rules.js"), resolve(output, "rules.js")),
]);
const previewPath = resolve(output, "preview.js");
const preview = await readFile(previewPath, "utf8");
await writeFile(
  previewPath,
  preview.replace("../src/core/analyzer.js", "./core/analyzer.js"),
  "utf8",
);
