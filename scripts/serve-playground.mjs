import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const port = Number(process.env.PLAYGROUND_PORT ?? "4173");
const root = resolve(process.cwd(), "dist", "playground");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

const pathFor = (requestUrl) => {
  const pathname = new URL(requestUrl ?? "/", "http://localhost").pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = resolve(root, requested);
  const fromRoot = relative(root, file);
  return fromRoot === "" ||
    (!fromRoot.startsWith("..") && !fromRoot.includes(".."))
    ? file
    : undefined;
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const file = pathFor(request.url);
  if (file === undefined) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "content-type":
        contentTypes.get(extname(file)) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Playground server listening on ${port}\n`);
});
