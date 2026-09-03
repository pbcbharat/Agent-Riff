import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePerformance,
  groupPerformanceEvents,
  isValidNote,
  notationForDuration,
  noteToFrequency,
  noteToStaffStep,
  scaleNotes,
  validatePhrase,
} from "../public/core.js";

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
});

test("phrases are constrained before audio is scheduled", () => {
  const phrase = validatePhrase({
    instrument: "violin",
    velocity: 2,
    steps: [{ note: "C4", beat: 0, duration_beats: 1 }],
  });
  assert.equal(phrase.instrument, "violin");
  assert.equal(phrase.velocity, 1);
  assert.throws(() => validatePhrase({ instrument: "piano", steps: [{ note: "Z9", beat: 0 }] }));
  assert.throws(() => validatePhrase({ instrument: "piano", steps: [{ note: "C3", beat: 0 }] }), /C4–E5/);
});
