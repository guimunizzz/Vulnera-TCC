/**
 * Servidor local de QA para o bundle web do mobile, com proxy da API real.
 * Permite conferir layout em viewports de celular sem alterar CORS ou o .env.
 * Consumidor: smoke visual desta refatoração; não participa do app distribuído.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist-preview");
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:8087");
  if (url.pathname.startsWith("/api/")) {
    const proxy = http.request({ hostname: "127.0.0.1", port: 3001, path: url.pathname + url.search, method: request.method,
      headers: { ...request.headers, host: "localhost:3001" } }, (upstream) => {
      response.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(response);
    });
    proxy.on("error", () => { response.writeHead(502); response.end("API indisponível"); });
    request.pipe(proxy); return;
  }
  let target;
  try { target = path.resolve(directory, "." + decodeURIComponent(url.pathname)); } catch { response.writeHead(400); response.end(); return; }
  if (!target.startsWith(directory + path.sep) && target !== directory) { response.writeHead(403); response.end(); return; }
  try {
    let content;
    if (!path.extname(target)) { target = path.join(directory, "index.html"); }
    try { content = await readFile(target); } catch { if (path.extname(target) !== ".html") throw new Error("NOT_FOUND"); content = await readFile(path.join(directory, "index.html")); }
    response.writeHead(200, { "content-type": types[path.extname(target)] ?? "application/octet-stream", "cache-control": "no-store" }); response.end(content);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(8087, "127.0.0.1", () => process.stdout.write("Preview mobile: http://localhost:8087\n"));
