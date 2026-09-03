import {
  MAX_PHRASE_STEPS,
  NOTES,
  PUBLIC_DOMAIN_SONG_IDS,
} from "./core.js";

const objectSchema = (properties, required = []) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

function asToolResult(payload) {
  return JSON.stringify(payload);
}

export function createAgentRiffTools(app) {
  return [
    {
      name: "riff_join_session",
      title: "Join the Agent Riff session",
      description:
        "Take the agent seat in the live session on this page. Call this before listening or performing.",
      inputSchema: objectSchema({
        display_name: { type: "string", minLength: 1, maxLength: 32, description: "A short name for the agent shown in the session." },
      }),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async ({ display_name = "AI collaborator" } = {}) => {
        const participant = app.joinSession({ actor: display_name });
        return asToolResult({
          ok: true,
          session: "current_page",
          participant,
          message: "Joined the current Agent Riff session. Listen before playing so your response fits the human's idea. For a live jam, reply once, then call riff_wait_for_human_phrase between turns so the human does not need to prompt you again.",
        });
      },
    },
    {
      name: "riff_get_session_state",
      title: "Read the live session",
      description:
        "Inspect the current Agent Riff session, shared musical settings, participants, and recent performance events. Read this before choosing what to play.",
      inputSchema: objectSchema({
        event_limit: {
          type: "integer",
          minimum: 1,
          maximum: 6,
          default: 6,
          description: "Number of the most recent session events to return.",
        },
      }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ event_limit = 6 } = {}) => asToolResult(app.getSessionState(event_limit)),
    },
    {
      name: "riff_listen",
      title: "Listen to the human phrase",
      description:
        "Analyze recent notes and return pitch, density, safe notes, and a concrete reply plan. Perform directly from that plan without another read call.",
      inputSchema: objectSchema({
        event_limit: {
          type: "integer",
          minimum: 3,
          maximum: 10,
          default: 8,
          description: "Number of the most recent note events to analyze.",
        },
      }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ event_limit = 8 } = {}) => asToolResult(app.listen(event_limit)),
    },
    {
      name: "riff_wait_for_human_phrase",
      title: "Wait for the human's next phrase",
      description:
        "Wait for the next completed human phrase. The result includes its notes, analysis, safe notes, and a target length and shape for a fuller reply. Perform directly without calling riff_listen again, then call this tool again. The wait ends when the human pauses or after ten minutes.",
      inputSchema: objectSchema({
        timeout_seconds: {
          type: "integer",
          minimum: 15,
          maximum: 600,
          default: 600,
          description: "How long to remain available for the next phrase, from 15 seconds through 10 minutes.",
        },
        phrase_pause_ms: {
          type: "integer",
          minimum: 400,
          maximum: 3000,
          default: 850,
          description: "Silence after the latest human note that marks the phrase as complete.",
        },
      }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ timeout_seconds = 600, phrase_pause_ms = 850 } = {}, context = {}) => asToolResult(
        await app.waitForHumanPhrase({ timeoutSeconds: timeout_seconds, phrasePauseMs: phrase_pause_ms }, context.signal),
      ),
    },
    {
      name: "riff_perform_phrase",
      title: "Perform a musical phrase",
      description:
        "Play one timed reply. Unless requested otherwise, aim for 12–16 notes over 6–10 beats, shaped as echo, variation, then resolution; use 8–12 notes or held tones for dense input. Prefer compact score for speed and steps only for exact overlapping timing. Optional compass changes apply here. Use riff_perform_set for songs.",
      inputSchema: {
        ...objectSchema({
          instrument: { type: "string", enum: ["piano", "violin", "trumpet", "synth"], description: "The agent's instrument voice." },
          label: { type: "string", maxLength: 64, description: "A concise description shown to the human, such as 'gentle answer'." },
          velocity: { type: "number", minimum: 0.15, maximum: 1, default: 0.68, description: "Phrase loudness from 0.15 to 1." },
          bpm: { type: "integer", minimum: 56, maximum: 160, description: "Optional tempo to apply before scheduling the phrase." },
          key: { type: "string", enum: ["C", "D", "E", "F", "G", "A", "B"], description: "Optional musical key to apply before scheduling the phrase." },
          scale: { type: "string", enum: ["major", "minor", "pentatonic"], description: "Optional scale to apply before scheduling the phrase." },
          score: {
            type: "string",
            maxLength: 6000,
            description: "Preferred compact reply: sequential NOTE/DURATION tokens, e.g. 'C4/0.5 E4/0.5 G4 R/0.5 G4+B4/2'. Duration defaults to one beat; R is a rest and + forms a chord.",
          },
          steps: {
            type: "array",
            minItems: 1,
            maxItems: MAX_PHRASE_STEPS,
            description: `Alternative to score for exact timing: one to ${MAX_PHRASE_STEPS} notes. Matching beat values create a chord.`,
            items: objectSchema(
              {
                note: { type: "string", enum: NOTES, description: "A pitch on the shared C4–E5 instrument, such as G4 or C#5." },
                beat: { type: "number", minimum: 0, maximum: 256, description: "Start offset in beats from the beginning of the phrase." },
                duration_beats: { type: "number", minimum: 0.1, maximum: 8, default: 0.45, description: "How long the note sounds in beats." },
              },
              ["note", "beat"],
            ),
          },
        }, ["instrument"]),
        anyOf: [{ required: ["score"] }, { required: ["steps"] }],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, context = {}) => {
        const result = await app.performPhrase(input, context.signal);
        return asToolResult(result);
      },
    },
    {
      name: "riff_perform_set",
      title: "Perform songs in one call",
      description:
        "Schedule up to eight songs or sections in one call. Prefer catalog songs to avoid web searches and note generation. Catalog: mary_had_a_little_lamb, frere_jacques, row_row_row_your_boat, ode_to_joy, entry_of_the_gladiators. Use song 'custom' with a compact score for anything else. The entire set continues playing after the tool returns; do not wait or poll between songs.",
      inputSchema: objectSchema(
        {
          songs: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            description: "Ordered songs or sections to schedule as one uninterrupted set.",
            items: objectSchema(
              {
                song: {
                  type: "string",
                  enum: [...PUBLIC_DOMAIN_SONG_IDS, "custom"],
                  description: "A built-in public-domain song, or custom when providing compact score notation.",
                },
                score: {
                  type: "string",
                  maxLength: 6000,
                  description: "Required only for custom: whitespace-separated NOTE/DURATION tokens, such as 'E4 D4 C4/2 R/1 C4+E4+G4/2'. Duration defaults to one beat; R is a rest and + forms a chord.",
                },
                label: { type: "string", maxLength: 64, description: "Optional display label; catalog songs already have one." },
                instrument: { type: "string", enum: ["piano", "violin", "trumpet", "synth"], description: "Optional instrument override." },
                bpm: { type: "integer", minimum: 56, maximum: 160, description: "Optional tempo override for this song." },
                key: { type: "string", enum: ["C", "D", "E", "F", "G", "A", "B"], description: "Optional key override for this song." },
                scale: { type: "string", enum: ["major", "minor", "pentatonic"], description: "Optional scale override for this song." },
                velocity: { type: "number", minimum: 0.15, maximum: 1, description: "Optional loudness override from 0.15 to 1." },
                gap_beats: { type: "number", minimum: 0, maximum: 16, default: 2, description: "Silence after this song before the next one." },
              },
              ["song"],
            ),
          },
        },
        ["songs"],
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, context = {}) => asToolResult(await app.performSet(input, context.signal)),
    },
    {
      name: "riff_set_compass",
      title: "Set the session's musical compass",
      description:
        "Update the shared tempo, key, or scale after the human asks for a musical direction. Omitted fields stay unchanged.",
      inputSchema: objectSchema({
        bpm: { type: "integer", minimum: 56, maximum: 160, description: "Session tempo in beats per minute." },
        key: { type: "string", enum: ["C", "D", "E", "F", "G", "A", "B"], description: "Root note for the shared musical key." },
        scale: { type: "string", enum: ["major", "minor", "pentatonic"], description: "Scale used for compatible-note suggestions." },
      }),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input = {}) => asToolResult(app.setCompass(input, "Agent")),
    },
  ];
}

export async function registerAgentRiffTools(modelContext, app) {
  if (!modelContext?.registerTool) return [];
  const controller = new AbortController();
  const tools = createAgentRiffTools(app);
  await Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })));
  return { names: tools.map((tool) => tool.name), dispose: () => controller.abort() };
}
