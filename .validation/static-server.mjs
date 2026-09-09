import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("./", import.meta.url).pathname;
const port = Number(process.env.PORT || 4178);
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const pathname = normalize(new URL(request.url || "/", `http://${request.headers.host}`).pathname).replace(/^\/+/, "");
  try {
    const filePath = join(root, pathname || "direct-canvas-probe.html");
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => console.log(`validation server listening on ${port}`));
