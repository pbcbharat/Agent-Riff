import test from "node:test";
import assert from "node:assert/strict";
import { NOTES } from "../public/core.js";
import { createTuneInTools, registerTuneInTools } from "../public/webmcp.js";

const app = {
  joinRoom: (key) => key,
  getRoomState: () => ({ room: "MUSE42" }),
  listen: () => ({ analysis: { density: "open" } }),
  performPhrase: async () => ({ ok: true }),
  setCompass: () => ({ ok: true }),
};

test("TuneIn exposes a focused WebMCP collaboration surface", () => {
  const tools = createTuneInTools(app);
  assert.deepEqual(tools.map(({ name }) => name), [
    "tunein_join_room",
    "tunein_get_room_state",
    "tunein_listen",
    "tunein_perform_phrase",
    "tunein_set_compass",
  ]);
  assert.equal(tools.find(({ name }) => name === "tunein_listen").annotations.readOnlyHint, true);
  const performTool = tools.find(({ name }) => name === "tunein_perform_phrase");
  assert.equal(performTool.inputSchema.properties.steps.maxItems, 32);
  assert.deepEqual(performTool.inputSchema.properties.steps.items.properties.note.enum, NOTES);
  assert.ok(tools.every(({ name, description }) => name.length <= 30 && description.length <= 500));
  assert.ok(tools.every(({ annotations }) => (
    Object.keys(annotations).every((key) => ["readOnlyHint", "untrustedContentHint"].includes(key))
  )));
  assert.ok(tools.every(({ inputSchema }) => (
    Object.values(inputSchema.properties).every((property) => property.description || property.type === "array")
  )));
  assert.equal(tools.find(({ name }) => name === "tunein_get_room_state").inputSchema.properties.event_limit.maximum, 6);
  assert.equal(tools.find(({ name }) => name === "tunein_listen").inputSchema.properties.event_limit.maximum, 10);
});

test("tools register through document.modelContext-compatible API", async () => {
  const calls = [];
  const modelContext = { registerTool: async (tool, options) => calls.push({ tool, options }) };
  const registration = await registerTuneInTools(modelContext, app);
  assert.equal(calls.length, 5);
  assert.equal(registration.names.length, 5);
  assert.ok(calls.every(({ options }) => options.signal instanceof AbortSignal));
  registration.dispose();
  assert.ok(calls.every(({ options }) => options.signal.aborted));
});

test("read tools return compact serialized context", async () => {
  const tools = createTuneInTools(app);
  const state = await tools.find(({ name }) => name === "tunein_get_room_state").execute({ event_limit: 6 });
  const listening = await tools.find(({ name }) => name === "tunein_listen").execute({ event_limit: 8 });

  assert.deepEqual(JSON.parse(state), { room: "MUSE42" });
  assert.equal(JSON.parse(listening).analysis.density, "open");
  assert.doesNotMatch(state, /\n/);
  assert.doesNotMatch(listening, /\n/);
});

test("join tool provides the agent with a next-step recovery cue", async () => {
  const tool = createTuneInTools(app).find(({ name }) => name === "tunein_join_room");
  const result = JSON.parse(await tool.execute({ room_key: "MUSE42" }));

  assert.equal(result.ok, true);
  assert.match(result.message, /Listen before playing/);
});
