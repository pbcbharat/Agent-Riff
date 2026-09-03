import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = join(import.meta.dirname, "..");
const source = join(projectRoot, "public");
const destination = join(projectRoot, "dist");
const clientDestination = join(destination, "client");
const serverDestination = join(destination, "server");

await rm(destination, { recursive: true, force: true });
await mkdir(clientDestination, { recursive: true });
await mkdir(serverDestination, { recursive: true });
await cp(source, clientDestination, { recursive: true });

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const assets = {};
for (const relative of await collectFiles(source)) {
  const extension = `.${relative.split(".").pop()}`;
  const body = await readFile(join(source, relative));
  assets[`/${relative}`] = {
    body: body.toString("base64"),
    type: mimeTypes[extension] || "application/octet-stream",
  };
}

const worker = `const ASSETS = ${JSON.stringify(assets)};

function decode(base64) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = ASSETS[url.pathname] || ASSETS["/index.html"];
    return new Response(decode(asset.body), {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": url.pathname === "/" || url.pathname.endsWith(".html") ? "no-cache" : "public, max-age=3600",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Permissions-Policy": "microphone=(), camera=(), geolocation=()",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
`;

await writeFile(join(serverDestination, "index.js"), worker);

console.log(`Built Agent Riff into dist/ with ${Object.keys(assets).length} bundled assets`);
