export const NOTES = [
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
  "C5", "C#5", "D5", "D#5", "E5",
];

export const INSTRUMENTS = ["piano", "violin", "trumpet", "synth"];
export const SCALES = ["major", "minor", "pentatonic"];
export const KEYS = ["C", "D", "E", "F", "G", "A", "B"];

const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

export function normalizeRoomCode(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function isValidRoomCode(value) {
  return /^[A-Z0-9]{4,8}$/.test(normalizeRoomCode(value));
}

export function createRoomCode(random = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  }
  return code;
}

export function isValidNote(note) {
  return /^[A-G](?:#|b)?[2-6]$/.test(String(note));
}

export function noteToMidi(note) {
  if (!isValidNote(note)) return null;
  const match = String(note).match(/^([A-G](?:#|b)?)([2-6])$/);
  return 12 * (Number(match[2]) + 1) + NOTE_INDEX[match[1]];
}

const STAFF_LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

export function noteToStaffStep(note, reference = "E4") {
  if (!isValidNote(note) || !isValidNote(reference)) return null;
  const position = (value) => {
    const match = String(value).match(/^([A-G])(?:#|b)?([2-6])$/);
    return Number(match[2]) * 7 + STAFF_LETTER_INDEX[match[1]];
  };
  return position(note) - position(reference);
}

const NOTATION_DURATIONS = [
  { beats: 0.25, kind: "sixteenth", filled: true, flags: 2, stem: true },
  { beats: 0.5, kind: "eighth", filled: true, flags: 1, stem: true },
  { beats: 1, kind: "quarter", filled: true, flags: 0, stem: true },
  { beats: 2, kind: "half", filled: false, flags: 0, stem: true },
  { beats: 4, kind: "whole", filled: false, flags: 0, stem: false },
];

export function notationForDuration(durationSeconds, bpm = 96, durationBeats = null) {
  const measuredBeats = Number.isFinite(Number(durationBeats)) && Number(durationBeats) > 0
    ? Number(durationBeats)
    : Number(durationSeconds) * Math.max(1, Number(bpm) || 96) / 60;
  if (!Number.isFinite(measuredBeats) || measuredBeats <= 0) {
    return { beats: null, kind: "pending", filled: false, flags: 0, stem: false };
  }
  const notation = NOTATION_DURATIONS.reduce((closest, candidate) => (
    Math.abs(Math.log2(measuredBeats / candidate.beats)) < Math.abs(Math.log2(measuredBeats / closest.beats))
      ? candidate
      : closest
  ));
  return { ...notation, measuredBeats };
}

export function noteToFrequency(note) {
  const midi = noteToMidi(note);
  return midi === null ? null : 440 * 2 ** ((midi - 69) / 12);
}

export function scaleNotes(key = "C", scale = "major", octave = 4) {
  const root = NOTE_INDEX[key] ?? 0;
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return intervals.map((interval) => {
    const absolute = root + interval;
    return `${names[absolute % 12]}${octave + Math.floor(absolute / 12)}`;
  });
}

export function analyzePerformance(events = [], fallback = { key: "C", scale: "major", bpm: 96 }) {
  const notes = events.filter((event) => event.type === "note" && isValidNote(event.note)).slice(-32);
  if (!notes.length) {
    return {
      noteCount: 0,
      pitchCenter: null,
      register: "mid",
      density: "open",
      suggestion: `Begin with notes from ${fallback.key} ${fallback.scale} at ${fallback.bpm} BPM.`,
    };
  }

  const midi = notes.map((event) => noteToMidi(event.note));
  const average = midi.reduce((sum, value) => sum + value, 0) / midi.length;
  const pitchCounts = new Map();
  notes.forEach((event) => {
    const pitch = event.note.replace(/[2-6]$/, "");
    pitchCounts.set(pitch, (pitchCounts.get(pitch) || 0) + 1);
  });
  const pitchCenter = [...pitchCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return {
    noteCount: notes.length,
    pitchCenter,
    register: average < 60 ? "low" : average > 72 ? "high" : "mid",
    density: notes.length < 5 ? "open" : notes.length > 16 ? "busy" : "conversational",
    suggestion: notes.length > 16
      ? "Leave space: answer with a short phrase or held harmony."
      : `Echo ${pitchCenter}, then resolve inside ${fallback.key} ${fallback.scale}.`,
  };
}

export function validatePhrase(input = {}) {
  const instrument = INSTRUMENTS.includes(input.instrument) ? input.instrument : "violin";
  const steps = Array.isArray(input.steps) ? input.steps : [];

  if (!steps.length || steps.length > 32) {
    throw new Error("A phrase needs between 1 and 32 note steps.");
  }

  const normalizedSteps = steps.map((step, index) => {
    if (!NOTES.includes(step?.note)) {
      throw new Error(`Step ${index + 1} is outside the shared C4–E5 instrument range.`);
    }
    const beat = Number(step.beat ?? index * 0.5);
    const durationBeats = Number(step.duration_beats ?? 0.45);
    if (!Number.isFinite(beat) || beat < 0 || beat > 32) throw new Error(`Step ${index + 1} has an invalid beat.`);
    if (!Number.isFinite(durationBeats) || durationBeats < 0.1 || durationBeats > 8) {
      throw new Error(`Step ${index + 1} has an invalid duration.`);
    }
    return { note: step.note, beat, durationBeats };
  });

  return {
    instrument,
    steps: normalizedSteps,
    label: String(input.label || "Agent phrase").slice(0, 48),
    velocity: Math.min(1, Math.max(0.15, Number(input.velocity ?? 0.68))),
  };
}

export function groupPerformanceEvents(events = []) {
  const groups = [];
  for (const event of events) {
    if (!event || !["note", "phrase"].includes(event.type)) continue;
    const role = event.role === "agent" ? "agent" : "human";
    const actor = String(event.actor || (role === "agent" ? "Agent" : "You"));
    let group = groups.at(-1);
    const continuesLegacyTurn = !event.turnId && group?.role === role && group?.actor === actor;
    const turnId = continuesLegacyTurn
      ? group.id
      : String(event.turnId || event.id || `performance-${event.timestamp || 0}-${groups.length}`);
    if (!group || group.id !== turnId || group.role !== role || group.actor !== actor) {
      group = {
        id: turnId,
        role,
        actor,
        events: [],
      };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

export function eventSummary(event) {
  if (event.type === "note") return `${event.note} on ${event.instrument}`;
  if (event.type === "presence") return `${event.actor} joined the room`;
  if (event.type === "settings") return `${event.actor} set ${event.detail}`;
  if (event.type === "phrase") return `${event.actor} began “${event.label}”`;
  return event.detail || "Room updated";
}
