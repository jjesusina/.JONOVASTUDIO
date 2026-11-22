"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/crestview%20college%202/index.html", ["crestview college 2/index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
  ,["/robots.txt", ["robots.txt", "text/plain; charset=utf-8"]]
  ,["/sitemap.xml", ["sitemap.xml", "application/xml; charset=utf-8"]]
]);

http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const file = publicFiles.get(url.pathname);
  if (!file || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end("Not found");
    return;
  }

  fs.readFile(path.join(root, file[0]), (error, content) => {
    if (error) {
      console.error(`Could not read ${file[0]}:`, error.message);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      response.end("Could not load the demo portal.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}).listen(port, () => {
  console.log(`Crestview College demo portal is running at http://localhost:${port}`);
});
