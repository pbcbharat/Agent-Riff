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
      name: "tunein_join_room",
      title: "Join a TuneIn room",
      description:
        "Join the live TuneIn music room identified by a key. Call this before collaborating when the user gives you a room key.",
      inputSchema: objectSchema(
        {
          room_key: { type: "string", minLength: 4, maxLength: 8, description: "The 4–8 character room key shared by the user." },
          display_name: { type: "string", minLength: 1, maxLength: 32, description: "A short name for the agent shown in the room." },
        },
        ["room_key"],
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async ({ room_key, display_name = "AI collaborator" }) => {
        const room = app.joinRoom(room_key, { actor: display_name, role: "agent" });
        return asToolResult({ ok: true, room, message: `Joined ${room}. Listen before playing so your response fits the human's idea.` });
      },
    },
    {
      name: "tunein_get_room_state",
      title: "Read the live room",
      description:
        "Inspect the current TuneIn room, shared musical settings, participants, and recent performance events. Read this before choosing what to play.",
      inputSchema: objectSchema({
        event_limit: {
          type: "integer",
          minimum: 1,
          maximum: 6,
          default: 6,
          description: "Number of the most recent room events to return.",
        },
      }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ event_limit = 6 } = {}) => asToolResult(app.getRoomState(event_limit)),
    },
    {
      name: "tunein_listen",
      title: "Listen to the human phrase",
      description:
        "Analyze the room's recent notes for pitch center, register, density, and space. Use the analysis to plan a compatible response rather than playing randomly.",
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
      name: "tunein_perform_phrase",
      title: "Perform a musical phrase",
      description:
        "Play a timed phrase into the shared room as the agent. Choose notes that complement the room state. Beats are offsets from the phrase start; notes may overlap to form harmony.",
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
      title: "Set the room's musical compass",
      description:
        "Update the shared tempo, key, or scale after the human asks for a musical direction. Omitted fields stay unchanged.",
      inputSchema: objectSchema({
        bpm: { type: "integer", minimum: 56, maximum: 160, description: "Room tempo in beats per minute." },
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
