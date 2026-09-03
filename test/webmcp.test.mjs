import test from "node:test";
import assert from "node:assert/strict";
import { NOTES } from "../public/core.js";
import { createAgentRiffTools, registerAgentRiffTools } from "../public/webmcp.js";

const app = {
  joinSession: ({ actor }) => actor,
  getSessionState: () => ({ session: "current_page" }),
  listen: () => ({ analysis: { density: "open" } }),
  waitForHumanPhrase: async () => ({ outcome: "human_phrase" }),
  performPhrase: async () => ({ ok: true }),
  performSet: async () => ({ ok: true }),
  setCompass: () => ({ ok: true }),
};

test("Agent Riff exposes a focused WebMCP collaboration surface", () => {
  const tools = createAgentRiffTools(app);
  assert.deepEqual(tools.map(({ name }) => name), [
    "riff_join_session",
    "riff_get_session_state",
    "riff_listen",
    "riff_wait_for_human_phrase",
    "riff_perform_phrase",
    "riff_perform_set",
    "riff_set_compass",
  ]);
  assert.equal(tools.find(({ name }) => name === "riff_listen").annotations.readOnlyHint, true);
  assert.equal(tools.find(({ name }) => name === "riff_wait_for_human_phrase").annotations.readOnlyHint, true);
  const performTool = tools.find(({ name }) => name === "riff_perform_phrase");
  assert.equal(performTool.inputSchema.properties.steps.maxItems, 128);
  assert.equal(performTool.inputSchema.properties.score.type, "string");
  assert.deepEqual(performTool.inputSchema.required, ["instrument"]);
  assert.deepEqual(performTool.inputSchema.anyOf, [{ required: ["score"] }, { required: ["steps"] }]);
  assert.deepEqual(performTool.inputSchema.properties.steps.items.properties.note.enum, NOTES);
  assert.match(performTool.description, /12–16 notes/);
  const setTool = tools.find(({ name }) => name === "riff_perform_set");
  assert.equal(setTool.inputSchema.properties.songs.maxItems, 8);
  assert.ok(setTool.inputSchema.properties.songs.items.properties.song.enum.includes("ode_to_joy"));
  assert.match(setTool.description, /avoid web searches/);
  assert.ok(tools.every(({ name, description }) => name.length <= 30 && description.length <= 500));
  assert.ok(tools.every(({ annotations }) => (
    Object.keys(annotations).every((key) => ["readOnlyHint", "untrustedContentHint"].includes(key))
  )));
  assert.ok(tools.every(({ inputSchema }) => (
    Object.values(inputSchema.properties).every((property) => property.description || property.type === "array")
  )));
  assert.equal(tools.find(({ name }) => name === "riff_get_session_state").inputSchema.properties.event_limit.maximum, 6);
  assert.equal(tools.find(({ name }) => name === "riff_listen").inputSchema.properties.event_limit.maximum, 10);
});

test("tools register through document.modelContext-compatible API", async () => {
  const calls = [];
  const modelContext = { registerTool: async (tool, options) => calls.push({ tool, options }) };
  const registration = await registerAgentRiffTools(modelContext, app);
  assert.equal(calls.length, 7);
  assert.equal(registration.names.length, 7);
  assert.ok(calls.every(({ options }) => options.signal instanceof AbortSignal));
  registration.dispose();
  assert.ok(calls.every(({ options }) => options.signal.aborted));
});

test("read tools return compact serialized context", async () => {
  const tools = createAgentRiffTools(app);
  const state = await tools.find(({ name }) => name === "riff_get_session_state").execute({ event_limit: 6 });
  const listening = await tools.find(({ name }) => name === "riff_listen").execute({ event_limit: 8 });

  assert.deepEqual(JSON.parse(state), { session: "current_page" });
  assert.equal(JSON.parse(listening).analysis.density, "open");
  assert.doesNotMatch(state, /\n/);
  assert.doesNotMatch(listening, /\n/);
});

test("join tool takes the agent seat with an optional display name", async () => {
  const tool = createAgentRiffTools(app).find(({ name }) => name === "riff_join_session");
  const result = JSON.parse(await tool.execute({ display_name: "ChatGPT" }));

  assert.equal(result.ok, true);
  assert.equal(result.session, "current_page");
  assert.equal(result.participant, "ChatGPT");
  assert.deepEqual(Object.keys(tool.inputSchema.properties), ["display_name"]);
  assert.match(result.message, /Listen before playing/);
  assert.match(result.message, /riff_wait_for_human_phrase/);
});

test("wait tool forwards bounded session controls and cancellation", async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const waitApp = {
    ...app,
    waitForHumanPhrase: async (options, receivedSignal) => {
      calls.push({ options, receivedSignal });
      return { ok: true, outcome: "human_phrase" };
    },
  };
  const tool = createAgentRiffTools(waitApp).find(({ name }) => name === "riff_wait_for_human_phrase");
  const result = JSON.parse(await tool.execute({ timeout_seconds: 420, phrase_pause_ms: 900 }, { signal }));

  assert.equal(result.outcome, "human_phrase");
  assert.deepEqual(calls[0].options, { timeoutSeconds: 420, phrasePauseMs: 900 });
  assert.equal(calls[0].receivedSignal, signal);
  assert.equal(tool.inputSchema.properties.timeout_seconds.maximum, 600);
  assert.equal(tool.inputSchema.properties.phrase_pause_ms.minimum, 400);
  assert.equal(tool.inputSchema.properties.phrase_pause_ms.default, 850);
});

test("set tool forwards one compact multi-song request and cancellation", async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const setApp = {
    ...app,
    performSet: async (input, receivedSignal) => {
      calls.push({ input, receivedSignal });
      return { ok: true, scheduledSongs: input.songs.length };
    },
  };
  const tool = createAgentRiffTools(setApp).find(({ name }) => name === "riff_perform_set");
  const input = { songs: [{ song: "mary_had_a_little_lamb" }, { song: "ode_to_joy" }] };
  const result = JSON.parse(await tool.execute(input, { signal }));

  assert.equal(result.scheduledSongs, 2);
  assert.deepEqual(calls[0].input, input);
  assert.equal(calls[0].receivedSignal, signal);
});
