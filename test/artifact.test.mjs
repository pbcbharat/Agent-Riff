import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../dist/server/index.js";

test("production worker serves the app shell and static modules", async () => {
  const page = await worker.fetch(new Request("https://tunein.example/"));
  const script = await worker.fetch(new Request("https://tunein.example/webmcp.js"));

  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  const pageHtml = await page.text();
  assert.match(pageHtml, /TuneIn — play a thought together/);
  assert.match(pageHtml, /Play the first phrase/);
  assert.match(pageHtml, /class="workspace-shell"/);
  assert.match(pageHtml, /Agent performance/);
  assert.match(pageHtml, /id="instrument-trigger"/);
  assert.match(pageHtml, /id="instrument-options"/);
  assert.doesNotMatch(pageHtml, /id="instrument-select"/);
  assert.match(script.headers.get("content-type"), /text\/javascript/);
  assert.match(await script.text(), /tunein_perform_phrase/);
});

test("production worker falls back to the app shell for navigation paths", async () => {
  const response = await worker.fetch(new Request("https://tunein.example/play"));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="instrument"/);
});

test("Vercel publishes the static client artifact with hardened response headers", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, "dist/client");
  assert.ok(config.headers[0].headers.some(({ key, value }) => key === "X-Content-Type-Options" && value === "nosniff"));
});
