import { NOTES } from "./core.js";

const objectSchema = (properties, required = []) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

function asToolResult(payload) {
  return JSON.stringify(payload);
}

export function createTuneInTools(app) {
  return [
    {
      name: "tunein_join_session",
      title: "Join the TuneIn session",
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
          message: "Joined the current TuneIn session. Listen before playing so your response fits the human's idea. For a live jam, reply once, then call tunein_wait_for_human_phrase between turns so the human does not need to prompt you again.",
        });
      },
    },
    {
      name: "tunein_get_session_state",
      title: "Read the live session",
      description:
        "Inspect the current TuneIn session, shared musical settings, participants, and recent performance events. Read this before choosing what to play.",
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
      name: "tunein_listen",
      title: "Listen to the human phrase",
      description:
        "Analyze the session's recent notes for pitch center, register, density, and space. Use the analysis to plan a compatible response rather than playing randomly.",
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
      name: "tunein_wait_for_human_phrase",
      title: "Wait for the human's next phrase",
      description:
        "Wait on the current page for the next completed human phrase instead of ending the task or asking the user to type again. For a live jam, call this after each agent reply. When it returns human_phrase, listen, perform one compatible reply, then call this tool again. The wait ends when the human pauses or after at most ten minutes.",
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
          minimum: 500,
          maximum: 3000,
          default: 1200,
          description: "Silence after the latest human note that marks the phrase as complete.",
        },
      }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ timeout_seconds = 600, phrase_pause_ms = 1200 } = {}, context = {}) => asToolResult(
        await app.waitForHumanPhrase({ timeoutSeconds: timeout_seconds, phrasePauseMs: phrase_pause_ms }, context.signal),
      ),
    },
    {
      name: "tunein_perform_phrase",
      title: "Perform a musical phrase",
      description:
        "Play a timed phrase into the current session as the agent. Choose notes that complement the session state. Beats are offsets from the phrase start; notes may overlap to form harmony.",
      inputSchema: objectSchema(
        {
          instrument: { type: "string", enum: ["piano", "violin", "trumpet", "synth"], description: "The agent's instrument voice." },
          label: { type: "string", maxLength: 48, description: "A concise description shown to the human, such as 'gentle answer'." },
          velocity: { type: "number", minimum: 0.15, maximum: 1, default: 0.68, description: "Phrase loudness from 0.15 to 1." },
          steps: {
            type: "array",
            minItems: 1,
            maxItems: 32,
            description: "One to 32 notes. Matching beat values create a chord.",
            items: objectSchema(
              {
                note: { type: "string", enum: NOTES, description: "A pitch on the shared C4–E5 instrument, such as G4 or C#5." },
                beat: { type: "number", minimum: 0, maximum: 32, description: "Start offset in beats from the beginning of the phrase." },
                duration_beats: { type: "number", minimum: 0.1, maximum: 8, default: 0.45, description: "How long the note sounds in beats." },
              },
              ["note", "beat"],
            ),
          },
        },
        ["instrument", "steps"],
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, context = {}) => {
        const result = await app.performPhrase(input, context.signal);
        return asToolResult(result);
      },
    },
    {
      name: "tunein_set_compass",
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

export async function registerTuneInTools(modelContext, app) {
  if (!modelContext?.registerTool) return [];
  const controller = new AbortController();
  const tools = createTuneInTools(app);
  await Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })));
  return { names: tools.map((tool) => tool.name), dispose: () => controller.abort() };
}
