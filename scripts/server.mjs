import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
const logPath = join(root, ".server.log");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".md": "text/markdown; charset=utf-8",
};

process.on("uncaughtException", (error) => {
  appendFileSync(logPath, `[error] ${error.stack || error.message}\n`);
  process.exit(1);
});

export function startServer(options = {}) {
  const serverRoot = options.root ? resolve(options.root) : root;
  const serverPort = Number(options.port || port);
  const serverLogPath = join(serverRoot, ".server.log");
  const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${serverPort}`);
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
  let filePath = resolve(join(serverRoot, requestedPath || "index.html"));

  if (!filePath.startsWith(serverRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
  createReadStream(filePath).pipe(response);
  });

  server.on("error", (error) => {
    appendFileSync(serverLogPath, `[listen-error] ${error.stack || error.message}\n`);
    if (!options.noExitOnError) process.exit(1);
  });

  server.listen(serverPort, () => {
    const message = `Local astrology app: http://localhost:${serverPort}`;
    appendFileSync(serverLogPath, `[ready] ${message}\n`);
    if (!options.silent) console.log(message);
  });

  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
