export const NOTES = [
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
  "C5", "C#5", "D5", "D#5", "E5",
];

export const INSTRUMENTS = ["piano", "violin", "trumpet", "synth"];
export const SCALES = ["major", "minor", "pentatonic"];
export const KEYS = ["C", "D", "E", "F", "G", "A", "B"];
export const MAX_PHRASE_STEPS = 128;
export const MAX_SCORE_NOTES = 256;

const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

export const PUBLIC_DOMAIN_SONGS = Object.freeze({
  mary_had_a_little_lamb: Object.freeze({
    title: "Mary Had a Little Lamb",
    bpm: 110,
    key: "C",
    scale: "major",
    instrument: "piano",
    score: "E4 D4 C4 D4 E4 E4 E4/2 D4 D4 D4/2 E4 G4 G4/2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4/2",
  }),
  frere_jacques: Object.freeze({
    title: "Frère Jacques",
    bpm: 112,
    key: "C",
    scale: "major",
    instrument: "violin",
    score: "C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4/2 E4 F4 G4/2 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 C4 G4 C4/2 C4 G4 C4/2",
  }),
  row_row_row_your_boat: Object.freeze({
    title: "Row, Row, Row Your Boat",
    bpm: 120,
    key: "C",
    scale: "major",
    instrument: "synth",
    score: "C4/1.5 C4/1.5 C4 D4/0.5 E4/1.5 E4 D4/0.5 E4 F4/0.5 G4/3 C5/0.5 C5/0.5 C5/0.5 G4/0.5 G4/0.5 G4/0.5 E4/0.5 E4/0.5 E4/0.5 C4/0.5 C4/0.5 C4/0.5 G4 F4/0.5 E4 D4/0.5 C4/3",
  }),
  ode_to_joy: Object.freeze({
    title: "Ode to Joy",
    bpm: 104,
    key: "G",
    scale: "major",
    instrument: "trumpet",
    score: "B4 B4 C5 D5 D5 C5 B4 A4 G4 G4 A4 B4 B4/1.5 A4/0.5 A4/2 B4 B4 C5 D5 D5 C5 B4 A4 G4 G4 A4 B4 A4/1.5 G4/0.5 G4/2 A4 A4 B4 G4 A4 B4/0.5 C5/0.5 B4 G4 A4 B4/0.5 C5/0.5 B4 A4 G4 A4 D4/2 B4 B4 C5 D5 D5 C5 B4 A4 G4 G4 A4 B4 A4/1.5 G4/0.5 G4/2",
  }),
  entry_of_the_gladiators: Object.freeze({
    title: "Entry of the Gladiators — circus strain",
    bpm: 160,
    key: "C",
    scale: "major",
    instrument: "synth",
    score: "C5/0.5 B4/0.5 A#4/0.25 B4/0.25 A#4/0.25 A4/0.25 G#4/0.5 G4/0.5 F#4/0.5 G4/0.5 A4/0.5 G#4/0.5 G4/0.25 G#4/0.25 G4/0.25 F#4/0.25 F4/0.5 E4/0.5 D#4/0.5 F4/0.5 R/1 C5/0.5 B4/0.5 A#4/0.25 B4/0.25 A#4/0.25 A4/0.25 G#4/0.5 G4/0.5 F#4/0.5 G4/0.5 A4/0.5 G#4/0.5 G4/0.25 G#4/0.25 G4/0.25 F#4/0.25 F4/0.5 E4/0.5 D#4/0.5 F4/0.5 C5/1.5",
  }),
});

export const PUBLIC_DOMAIN_SONG_IDS = Object.freeze(Object.keys(PUBLIC_DOMAIN_SONGS));

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

  if (!steps.length || steps.length > MAX_PHRASE_STEPS) {
    throw new Error(`A phrase needs between 1 and ${MAX_PHRASE_STEPS} note steps.`);
  }

  const normalizedSteps = steps.map((step, index) => {
    if (!NOTES.includes(step?.note)) {
      throw new Error(`Step ${index + 1} is outside the shared C4–E5 instrument range.`);
    }
    const beat = Number(step.beat ?? index * 0.5);
    const durationBeats = Number(step.duration_beats ?? 0.45);
    if (!Number.isFinite(beat) || beat < 0 || beat > 256) throw new Error(`Step ${index + 1} has an invalid beat.`);
    if (!Number.isFinite(durationBeats) || durationBeats < 0.1 || durationBeats > 8) {
      throw new Error(`Step ${index + 1} has an invalid duration.`);
    }
    return { note: step.note, beat, durationBeats };
  });

  return {
    instrument,
    steps: normalizedSteps,
    label: String(input.label || "Agent phrase").slice(0, 64),
    velocity: Math.min(1, Math.max(0.15, Number(input.velocity ?? 0.68))),
  };
}

export function parseCompactScore(score) {
  const source = String(score || "").trim();
  if (!source) throw new Error("A compact score cannot be empty.");
  if (source.length > 6000) throw new Error("A compact score is limited to 6000 characters.");

  const tokens = source.replace(/[|,]/g, " ").split(/\s+/).filter(Boolean);
  const steps = [];
  let beat = 0;

  tokens.forEach((token, index) => {
    const slashIndex = token.lastIndexOf("/");
    const voice = slashIndex >= 0 ? token.slice(0, slashIndex) : token;
    const durationBeats = slashIndex >= 0 ? Number(token.slice(slashIndex + 1)) : 1;
    if (!Number.isFinite(durationBeats) || durationBeats < 0.125 || durationBeats > 16) {
      throw new Error(`Score token ${index + 1} has an invalid duration.`);
    }

    if (["R", "-"].includes(voice.toUpperCase())) {
      beat += durationBeats;
      return;
    }

    const chord = voice.split("+").filter(Boolean);
    if (!chord.length || chord.length > 4) throw new Error(`Score token ${index + 1} has an invalid chord.`);
    chord.forEach((note) => {
      if (!NOTES.includes(note)) {
        throw new Error(`Score token ${index + 1} uses ${note}, outside the shared C4–E5 instrument range.`);
      }
      steps.push({ note, beat: Number(beat.toFixed(3)), durationBeats });
    });
    beat += durationBeats;
  });

  if (!steps.length) throw new Error("A compact score needs at least one note.");
  if (steps.length > MAX_SCORE_NOTES) throw new Error(`A compact score is limited to ${MAX_SCORE_NOTES} notes.`);
  if (beat > 512) throw new Error("A compact score is limited to 512 beats.");
  return { steps, totalBeats: Number(beat.toFixed(3)) };
}

export function validatePerformanceSet(input = {}, fallback = { bpm: 96, key: "C", scale: "major" }) {
  const entries = Array.isArray(input.songs) ? input.songs : [];
  if (!entries.length || entries.length > 8) throw new Error("A performance set needs between 1 and 8 songs.");

  let totalNotes = 0;
  const songs = entries.map((entry = {}, index) => {
    const songId = String(entry.song || "custom");
    const preset = PUBLIC_DOMAIN_SONGS[songId];
    if (!preset && songId !== "custom") throw new Error(`Song ${index + 1} is not in the public-domain catalog.`);
    if (songId === "custom" && !String(entry.score || "").trim()) {
      throw new Error(`Song ${index + 1} needs a compact score.`);
    }

    const score = parseCompactScore(preset?.score || entry.score);
    totalNotes += score.steps.length;
    if (totalNotes > 512) throw new Error("A performance set is limited to 512 scheduled notes.");

    const bpm = Number(entry.bpm ?? preset?.bpm ?? fallback.bpm ?? 96);
    if (!Number.isInteger(bpm) || bpm < 56 || bpm > 160) throw new Error(`Song ${index + 1} has an invalid tempo.`);
    const key = entry.key ?? preset?.key ?? fallback.key ?? "C";
    if (!KEYS.includes(key)) throw new Error(`Song ${index + 1} has an invalid key.`);
    const scale = entry.scale ?? preset?.scale ?? fallback.scale ?? "major";
    if (!SCALES.includes(scale)) throw new Error(`Song ${index + 1} has an invalid scale.`);
    const instrument = entry.instrument ?? preset?.instrument ?? "piano";
    if (!INSTRUMENTS.includes(instrument)) throw new Error(`Song ${index + 1} has an invalid instrument.`);
    const gapBeats = Number(entry.gap_beats ?? 2);
    if (!Number.isFinite(gapBeats) || gapBeats < 0 || gapBeats > 16) throw new Error(`Song ${index + 1} has an invalid gap.`);
    const velocity = Number(entry.velocity ?? 0.68);
    if (!Number.isFinite(velocity) || velocity < 0.15 || velocity > 1) throw new Error(`Song ${index + 1} has an invalid velocity.`);

    return {
      songId,
      title: String(entry.label || preset?.title || `Custom song ${index + 1}`).slice(0, 64),
      instrument,
      bpm,
      key,
      scale,
      gapBeats,
      velocity,
      steps: score.steps,
      totalBeats: score.totalBeats,
    };
  });

  return { songs, totalNotes };
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
  if (event.type === "presence") return `${event.actor} joined the session`;
  if (event.type === "settings") return `${event.actor} set ${event.detail}`;
  if (event.type === "phrase") return `${event.actor} began “${event.label}”`;
  return event.detail || "Session updated";
}
