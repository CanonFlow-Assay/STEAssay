import { cp, mkdir } from "node:fs/promises";
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
