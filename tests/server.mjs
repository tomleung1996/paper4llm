import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const port = 4173;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = normalize(requestPath).replace(/^([/\\])+/, "");
  let filePath = join(root, relativePath || "tests/browser-test.html");

  try {
    if (!filePath.startsWith(root) || statSync(filePath).isDirectory()) throw new Error("Not found");
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch (_error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Paper Markdown test server: http://127.0.0.1:${port}/tests/browser-test.html`);
});
