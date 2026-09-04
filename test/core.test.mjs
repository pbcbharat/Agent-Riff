import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PHRASE_STEPS,
  PUBLIC_DOMAIN_SONG_IDS,
  analyzePerformance,
  completedHumanTurnNotes,
  createAgentReplyGate,
  groupPerformanceEvents,
  isValidNote,
  notationForDuration,
  noteToFrequency,
  noteToStaffStep,
  parseCompactScore,
  performanceReplaySchedule,
  scaleNotes,
  validatePerformanceSet,
  validatePhrase,
} from "../public/core.js";

test("agent playback requires and consumes a completed human turn", () => {
  const gate = createAgentReplyGate();
  assert.equal(gate.canReply(), false);
  assert.throws(() => gate.consume(), /no new completed human phrase/);

  gate.observe({ id: "held", type: "note", role: "human", durationBeats: null });
  assert.equal(gate.canReply(), false);

  gate.observe({ id: "h1", turnId: "human-turn", type: "note", role: "human", durationBeats: 1 });
  gate.observe({ id: "a1", type: "note", role: "agent", durationBeats: 1 });
  assert.equal(gate.canReply(), true);
  assert.equal(gate.consume(), "human-turn");
  assert.equal(gate.canReply(), false);
  assert.throws(() => gate.consume(), /idle timeout does not authorize music/);
});

test("agent reply gate restores only a human phrase not followed by an agent performance", () => {
  const answered = [
    { id: "h1", turnId: "human-turn", type: "note", role: "human", durationBeats: 1 },
    { id: "a-turn", type: "phrase", role: "agent" },
    { id: "a1", turnId: "a-turn", type: "note", role: "agent", durationBeats: 1 },
  ];
  const gate = createAgentReplyGate(answered);
  assert.equal(gate.canReply(), false);

  gate.reset([...answered, { id: "h2", turnId: "next-human-turn", type: "note", role: "human", durationBeats: 0.5 }]);
  assert.equal(gate.canReply(), true);
  assert.equal(gate.pendingTurnId(), "next-human-turn");
});

test("pending phrase selection never feeds agent notes back as human input", () => {
  const notes = completedHumanTurnNotes([
    { id: "h1", turnId: "human-turn", type: "note", role: "human", durationBeats: 1 },
    { id: "a1", turnId: "human-turn", type: "note", role: "agent", durationBeats: 1 },
    { id: "held", turnId: "human-turn", type: "note", role: "human", durationBeats: null },
    { id: "h2", turnId: "other-turn", type: "note", role: "human", durationBeats: 1 },
  ], "human-turn");

  assert.deepEqual(notes.map(({ id }) => id), ["h1"]);
});

test("scientific notes map to useful frequencies", () => {
  assert.equal(isValidNote("C#4"), true);
  assert.equal(isValidNote("H4"), false);
  assert.ok(Math.abs(noteToFrequency("A4") - 440) < 0.001);
});

test("notation maps exact pitches to treble-staff steps", () => {
  assert.equal(noteToStaffStep("E4"), 0);
  assert.equal(noteToStaffStep("C4"), -2);
  assert.equal(noteToStaffStep("C#4"), -2);
  assert.equal(noteToStaffStep("E5"), 7);
});

test("performed duration is quantized into the nearest readable note value", () => {
  assert.equal(notationForDuration(0.625, 96).kind, "quarter");
  assert.equal(notationForDuration(1.25, 96).kind, "half");
  assert.equal(notationForDuration(null, 96).kind, "pending");
  assert.equal(notationForDuration(9, 96, 0.5).kind, "eighth");
});

test("performance events are grouped into stable human and agent turns", () => {
  const groups = groupPerformanceEvents([
    { id: "join", type: "presence", actor: "You", role: "human", timestamp: 1 },
    { id: "h1", type: "note", note: "C4", actor: "You", role: "human", timestamp: 2 },
    { id: "h2", type: "note", note: "E4", actor: "You", role: "human", timestamp: 3 },
    { id: "a0", type: "phrase", label: "Answer", actor: "Agent", role: "agent", timestamp: 4 },
    { id: "a1", type: "note", note: "G4", actor: "Agent", role: "agent", timestamp: 5 },
    { id: "h3", type: "note", note: "D4", actor: "You", role: "human", timestamp: 6 },
  ]);

  assert.deepEqual(groups.map(({ id, role, events }) => [id, role, events.map((event) => event.id)]), [
    ["h1", "human", ["h1", "h2"]],
    ["a0", "agent", ["a0", "a1"]],
    ["h3", "human", ["h3"]],
  ]);

  const longTurn = Array.from({ length: 80 }, (_, index) => ({
    id: `note-${index}`,
    turnId: "human-turn",
    type: "note",
    note: "C4",
    actor: "You",
    role: "human",
    timestamp: index,
  }));
  assert.equal(groupPerformanceEvents(longTurn.slice(-64))[0].id, "human-turn");
});

test("scales are returned inside the requested key", () => {
  assert.deepEqual(scaleNotes("C", "major", 4), ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]);
  assert.deepEqual(scaleNotes("A", "pentatonic", 4), ["A4", "B4", "C#5", "E5", "F#5"]);
});

test("performance analysis turns session notes into a compact listening brief", () => {
  const events = ["C4", "E4", "G4", "C4"].map((note) => ({ type: "note", note }));
  const result = analyzePerformance(events, { key: "C", scale: "major", bpm: 96 });
  assert.equal(result.noteCount, 4);
  assert.equal(result.pitchCenter, "C");
  assert.equal(result.density, "open");
  assert.deepEqual(result.replyPlan, {
    targetNotes: 12,
    targetBeats: 7,
    shape: "echo 3–4 notes → vary rhythm or contour → resolve",
  });

  const conversational = analyzePerformance(
    Array.from({ length: 10 }, (_, index) => ({ type: "note", note: index % 2 ? "E4" : "C4" })),
    { key: "C", scale: "major", bpm: 96 },
  );
  assert.equal(conversational.replyPlan.targetNotes, 15);

  const busy = analyzePerformance(
    Array.from({ length: 20 }, () => ({ type: "note", note: "G4" })),
    { key: "C", scale: "major", bpm: 96 },
  );
  assert.equal(busy.replyPlan.targetNotes, 10);
});

test("phrases are constrained before audio is scheduled", () => {
  const phrase = validatePhrase({
    instrument: "violin",
    velocity: 2,
    steps: [{ note: "C4", beat: 0, duration_beats: 1 }],
  });
  assert.equal(phrase.instrument, "violin");
  assert.equal(phrase.velocity, 1);
  assert.equal(validatePhrase({
    instrument: "piano",
    steps: Array.from({ length: MAX_PHRASE_STEPS }, (_, beat) => ({ note: "C4", beat })),
  }).steps.length, MAX_PHRASE_STEPS);
  assert.throws(() => validatePhrase({
    instrument: "piano",
    steps: Array.from({ length: MAX_PHRASE_STEPS + 1 }, (_, beat) => ({ note: "C4", beat })),
  }), /128 note steps/);
  assert.throws(() => validatePhrase({ instrument: "piano", steps: [{ note: "Z9", beat: 0 }] }));
  assert.throws(() => validatePhrase({ instrument: "piano", steps: [{ note: "C3", beat: 0 }] }), /C4–E5/);

  const compact = validatePhrase({
    instrument: "synth",
    score: "C4/0.5 R/0.5 E4+G4/1 C5/2",
  });
  assert.deepEqual(compact.steps, [
    { note: "C4", beat: 0, durationBeats: 0.5 },
    { note: "E4", beat: 1, durationBeats: 1 },
    { note: "G4", beat: 1, durationBeats: 1 },
    { note: "C5", beat: 2, durationBeats: 2 },
  ]);
  assert.throws(() => validatePhrase({
    instrument: "piano",
    score: "C4 E4",
    steps: [{ note: "G4", beat: 0 }],
  }), /not both/);
});

test("compact scores expand rests, durations, and chords without verbose note objects", () => {
  const score = parseCompactScore("C4/0.5 R/0.5 E4+G4/2 | C5");
  assert.deepEqual(score.steps, [
    { note: "C4", beat: 0, durationBeats: 0.5 },
    { note: "E4", beat: 1, durationBeats: 2 },
    { note: "G4", beat: 1, durationBeats: 2 },
    { note: "C5", beat: 3, durationBeats: 1 },
  ]);
  assert.equal(score.totalBeats, 4);
  assert.throws(() => parseCompactScore("H9"), /outside the shared/);
});

test("performance cards can replay stored timing, duration, and instruments independently", () => {
  const schedule = performanceReplaySchedule([
    { id: "phrase", type: "phrase", timestamp: 900 },
    { id: "one", type: "note", note: "C4", instrument: "piano", velocity: 0.7, timestamp: 1000, duration: 0.4 },
    { id: "two", type: "note", note: "E4", instrument: "violin", velocity: 0.6, timestamp: 1500, durationBeats: 1 },
    { id: "three", type: "note", note: "G4", instrument: "synth", timestamp: 1500, duration: 0.25 },
  ], 120);

  assert.deepEqual(schedule, [
    { id: "one", note: "C4", instrument: "piano", velocity: 0.7, delaySeconds: 0, durationSeconds: 0.4 },
    { id: "two", note: "E4", instrument: "violin", velocity: 0.6, delaySeconds: 0.5, durationSeconds: 0.5 },
    { id: "three", note: "G4", instrument: "synth", velocity: 0.68, delaySeconds: 0.5, durationSeconds: 0.25 },
  ]);
  assert.deepEqual(performanceReplaySchedule([{ type: "settings" }]), []);
});

test("the public-domain catalog validates an entire five-song set in one input", () => {
  const set = validatePerformanceSet({
    songs: PUBLIC_DOMAIN_SONG_IDS.map((song) => ({ song })),
  });
  assert.equal(set.songs.length, 5);
  assert.equal(set.totalNotes, 188);
  assert.equal(set.songs[0].title, "Mary Had a Little Lamb");
  assert.equal(set.songs.at(-1).bpm, 160);

  const custom = validatePerformanceSet({
    songs: [{ song: "custom", score: "C4 E4 G4 C5/2", instrument: "piano", bpm: 100 }],
  });
  assert.equal(custom.totalNotes, 4);
  assert.throws(() => validatePerformanceSet({ songs: [{ song: "custom" }] }), /compact score/);
});
