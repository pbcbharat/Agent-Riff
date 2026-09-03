import {
  INSTRUMENTS,
  NOTES,
  analyzePerformance,
  createRoomCode,
  eventSummary,
  groupPerformanceEvents,
  isValidRoomCode,
  normalizeRoomCode,
  notationForDuration,
  noteToFrequency,
  noteToMidi,
  noteToStaffStep,
  scaleNotes,
  validatePhrase,
} from "./core.js";
import { createTuneInTools } from "./webmcp.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const instrumentMeta = {
  piano: { name: "Piano", description: "Warm & clear", glyph: "", glyphClass: "piano-glyph" },
  violin: { name: "Violin", description: "Soft & lyrical", glyph: "⌁", glyphClass: "violin-glyph" },
  trumpet: { name: "Trumpet", description: "Bright & bold", glyph: "◁", glyphClass: "trumpet-glyph" },
  synth: { name: "Night synth", description: "Deep & electric", glyph: "⌇", glyphClass: "synth-glyph" },
};

const performanceColors = {
  human: "#c8ff4d",
  agent: "#b18cff",
  system: "#ff8c67",
};

const whiteKeys = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];
const blackKeys = [
  ["C#4", 0.1], ["D#4", 0.2], ["F#4", 0.4], ["G#4", 0.5],
  ["A#4", 0.6], ["C#5", 0.8], ["D#5", 0.9],
];
const whiteBindings = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];
const blackBindings = ["w", "e", "t", "y", "u", "o", "p"];

const state = {
  room: null,
  instrument: "piano",
  bpm: 96,
  key: "C",
  scale: "major",
  agentName: null,
  events: [],
  channel: null,
  metronomeTimer: null,
  audio: null,
  agentPlaying: new Map(),
};

const activeVoices = new Map();
let toastTimer;
let humanTrackTimer;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function ensureAudio() {
  if (!state.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audio = new AudioContext();
  }
  if (state.audio?.state === "suspended") state.audio.resume();
  return state.audio;
}

function makeVoice(note, instrument, velocity = 0.7, duration = null) {
  const audio = ensureAudio();
  const frequency = noteToFrequency(note);
  if (!audio || !frequency) return { stop() {} };

  const now = audio.currentTime;
  const master = audio.createGain();
  const filter = audio.createBiquadFilter();
  const oscillators = [];
  const gain = Math.max(0.02, Math.min(0.22, velocity * 0.18));

  filter.connect(master);
  master.connect(audio.destination);
  filter.Q.value = instrument === "trumpet" ? 5 : 1.2;
  filter.frequency.value = instrument === "violin" ? 1900 : instrument === "trumpet" ? 1250 : 3200;

  const profiles = {
    piano: [["triangle", 1, 0], ["sine", 2, -12]],
    violin: [["sawtooth", 1, 0], ["triangle", 1.002, -10]],
    trumpet: [["sawtooth", 1, 0], ["square", 2, -16]],
    synth: [["square", 0.5, -9], ["triangle", 1, -4]],
  };

  for (const [type, ratio, cents] of profiles[instrument] || profiles.piano) {
    const oscillator = audio.createOscillator();
    const partialGain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency * ratio;
    oscillator.detune.value = cents;
    partialGain.gain.value = type === "sine" ? 0.45 : 0.65;
    oscillator.connect(partialGain);
    partialGain.connect(filter);
    oscillator.start(now);
    oscillators.push(oscillator);
  }

  const attack = instrument === "violin" ? 0.12 : instrument === "trumpet" ? 0.04 : 0.008;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(gain, now + attack);

  let stopped = false;
  const stop = (when = audio.currentTime) => {
    if (stopped) return;
    stopped = true;
    const release = instrument === "violin" ? 0.32 : instrument === "piano" ? 0.42 : 0.18;
    master.gain.cancelScheduledValues(when);
    master.gain.setTargetAtTime(0.0001, when, release / 4);
    oscillators.forEach((oscillator) => oscillator.stop(when + release));
  };

  if (duration) setTimeout(() => stop(), duration * 1000);
  return { stop };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderNotationGlyph(container, event) {
  const notation = notationForDuration(event.duration, state.bpm, event.durationBeats);
  const midi = noteToMidi(event.note) || 60;
  const staffStep = noteToStaffStep(event.note) ?? 0;
  const stemDown = midi >= 71;
  const accidental = event.note.includes("#") ? "♯" : event.note.includes("b") ? "♭" : "";
  const svg = svgElement("svg", { viewBox: "0 0 56 56", focusable: "false", "aria-hidden": "true" });
  const title = svgElement("title");
  title.textContent = notation.kind === "pending"
    ? `${event.note}, held note`
    : `${event.note}, ${notation.kind} note`;
  svg.append(title);

  if (staffStep <= -2 || staffStep >= 10) {
    svg.append(svgElement("line", { class: "notation-ledger", x1: "15", y1: "29", x2: "40", y2: "29" }));
  }

  if (accidental) {
    const accidentalMark = svgElement("text", { class: "notation-accidental", x: "3", y: "35" });
    accidentalMark.textContent = accidental;
    svg.append(accidentalMark);
  }

  const noteHead = svgElement("ellipse", {
    class: `notation-head ${notation.filled ? "filled" : "open"}`,
    cx: "27",
    cy: "29",
    rx: notation.kind === "whole" ? "10" : "9",
    ry: "6",
    transform: "rotate(-18 27 29)",
  });
  svg.append(noteHead);

  if (notation.stem) {
    const stemX = stemDown ? 19 : 35;
    const stemEnd = stemDown ? 53 : 5;
    svg.append(svgElement("line", { class: "notation-stem", x1: stemX, y1: "29", x2: stemX, y2: stemEnd }));
    for (let flag = 0; flag < notation.flags; flag += 1) {
      const offset = flag * (stemDown ? -8 : 8);
      const path = stemDown
        ? `M 19 ${49 + offset} C 8 ${44 + offset}, 8 ${36 + offset}, 13 ${33 + offset}`
        : `M 35 ${7 + offset} C 47 ${11 + offset}, 48 ${20 + offset}, 41 ${24 + offset}`;
      svg.append(svgElement("path", { class: "notation-flag", d: path }));
    }
  }

  container.classList.toggle("pending", notation.kind === "pending");
  container.dataset.notation = notation.kind;
  container.replaceChildren(svg);
}

function visualNote(event) {
  $("#score-empty").classList.add("hidden");
  const field = $("#note-field");
  const existing = [...field.children].find((item) => item.dataset.eventId === event.id);
  if (existing) {
    renderNotationGlyph(existing, event);
    return existing;
  }

  const note = document.createElement("span");
  const staffStep = noteToStaffStep(event.note) ?? 0;
  note.className = `score-note ${event.role === "agent" ? "agent" : "human"}`;
  note.dataset.eventId = event.id;
  note.style.top = `${Math.max(9, Math.min(91, 74 - staffStep * 6))}%`;
  note.style.setProperty("--note-color", performanceColors[event.role] || performanceColors.human);
  note.style.setProperty("--travel-delay", `${Math.min(0, (event.timestamp - Date.now()) / 1000)}s`);
  renderNotationGlyph(note, event);
  field.append(note);
  note.addEventListener("animationend", () => note.remove(), { once: true });
  return note;
}

function nowLabel(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 4) return "now";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function renderActivity() {
  const list = $("#activity-list");
  const groups = groupPerformanceEvents(state.events).slice(-12);
  const noteCount = state.events.filter((event) => event.type === "note").length;
  $("#event-count").textContent = `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
  const shouldStickToBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 28;

  if (!groups.length) {
    list.querySelectorAll(".activity-turn").forEach((item) => item.remove());
    if (!list.querySelector(".empty-activity")) {
      const empty = document.createElement("li");
      empty.className = "empty-activity";
      const symbol = document.createElement("span");
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "♪";
      const copy = document.createElement("p");
      copy.textContent = "Your duet will unfold here.";
      empty.append(symbol, copy);
      list.append(empty);
    }
    renderAgentPanel();
    return;
  }

  list.querySelector(".empty-activity")?.remove();
  const wantedIds = new Set(groups.map((group) => group.id));
  list.querySelectorAll(".activity-turn").forEach((item) => {
    if (!wantedIds.has(item.dataset.groupId)) item.remove();
  });

  groups.forEach((group, index) => {
    let card = [...list.children].find((item) => item.dataset.groupId === group.id);
    if (!card) card = createActivityCard(group);
    updateActivityCard(card, group);
    const itemAtPosition = list.children[index];
    if (itemAtPosition !== card) list.insertBefore(card, itemAtPosition || null);
  });

  if (shouldStickToBottom) list.scrollTop = list.scrollHeight;
  renderAgentPanel();
}

function createActivityCard(group) {
  const card = document.createElement("li");
  card.className = `activity-turn ${group.role}`;
  card.dataset.groupId = group.id;

  const header = document.createElement("div");
  header.className = "activity-turn-header";
  const color = document.createElement("span");
  color.className = "activity-color";
  color.setAttribute("aria-hidden", "true");
  const actor = document.createElement("strong");
  actor.className = "activity-actor";
  const time = document.createElement("time");
  time.className = "activity-time";
  header.append(color, actor, time);

  const notes = document.createElement("div");
  notes.className = "activity-note-sequence";
  const summary = document.createElement("p");
  summary.className = "activity-turn-summary";
  card.append(header, notes, summary);
  return card;
}

function updateActivityCard(card, group) {
  const signature = group.events.map((event) => event.id || `${event.type}-${event.timestamp}`).join("|");
  if (card.dataset.signature === signature) return;
  const noteEvents = group.events.filter((event) => event.type === "note");
  const phrase = [...group.events].reverse().find((event) => event.type === "phrase");
  const instruments = [...new Set(noteEvents.map((event) => instrumentMeta[event.instrument]?.name || event.instrument).filter(Boolean))];
  const latest = group.events.at(-1);
  const sequence = card.querySelector(".activity-note-sequence");
  const wantedNoteIds = new Set(noteEvents.map((event) => String(event.id || `${event.note}-${event.timestamp}`)));
  const existingNoteIds = new Set([...sequence.querySelectorAll(".activity-note")].map((item) => item.dataset.noteId));

  sequence.querySelectorAll(".activity-note").forEach((item) => {
    if (!wantedNoteIds.has(item.dataset.noteId)) item.remove();
  });
  sequence.querySelector(".activity-notes-placeholder")?.remove();
  noteEvents.forEach((event) => {
    const noteId = String(event.id || `${event.note}-${event.timestamp}`);
    if (existingNoteIds.has(noteId)) return;
    const note = document.createElement("span");
    note.className = "activity-note";
    note.dataset.noteId = noteId;
    note.textContent = event.note;
    sequence.append(note);
    existingNoteIds.add(noteId);
  });
  if (!noteEvents.length) {
    const placeholder = document.createElement("span");
    placeholder.className = "activity-notes-placeholder";
    placeholder.textContent = "Preparing a phrase…";
    sequence.append(placeholder);
  }
  sequence.scrollTop = sequence.scrollHeight;

  const actor = card.querySelector(".activity-actor");
  if (actor.textContent !== group.actor) actor.textContent = group.actor;
  const summaryText = [
    phrase?.label ? `“${phrase.label}”` : null,
    instruments.join(" + ") || null,
    noteEvents.length ? `${noteEvents.length} ${noteEvents.length === 1 ? "note" : "notes"}` : null,
  ].filter(Boolean).join(" · ");
  const summary = card.querySelector(".activity-turn-summary");
  if (summary.textContent !== summaryText) summary.textContent = summaryText;

  const time = card.querySelector(".activity-time");
  time.dateTime = new Date(latest.timestamp).toISOString();
  time.textContent = nowLabel(latest.timestamp);
  card.dataset.signature = signature;
}

function renderAgentPanel() {
  const list = $("#agent-activity-list");
  if (!list) return;
  const agentEvents = state.events.filter((event) => event.role === "agent");
  const musicalEvents = agentEvents.filter((event) => ["note", "phrase", "settings"].includes(event.type));
  const lastNote = [...agentEvents].reverse().find((event) => event.type === "note");
  const lastPhrase = [...agentEvents].reverse().find((event) => event.type === "phrase");
  const playing = [...state.agentPlaying.values()];
  const instrument = playing.at(-1)?.instrument || lastNote?.instrument || lastPhrase?.instrument;

  $("#agent-instrument").textContent = instrument ? instrumentMeta[instrument]?.name || instrument : "Not selected";
  $("#agent-playing-dot").classList.toggle("active", playing.length > 0);

  if (playing.length) {
    const notes = [...new Set(playing.map((item) => item.note))];
    $("#agent-performance-heading").textContent = `Playing ${notes.join(" + ")}`;
    $("#agent-action").textContent = lastPhrase?.label || "Answering your phrase";
  } else if (lastPhrase) {
    $("#agent-performance-heading").textContent = lastPhrase.label || "Phrase complete";
    $("#agent-action").textContent = lastNote ? `Last played ${lastNote.note}` : "Preparing to play";
  } else {
    $("#agent-performance-heading").textContent = "Waiting for a phrase";
    $("#agent-action").textContent = state.agentName ? "Listening" : "Waiting to join";
  }

  const recent = musicalEvents.slice(-6).reverse();
  list.innerHTML = recent.length
    ? recent.map((event) => `<li>
        <span class="agent-event-note">${escapeHtml(event.type === "note" ? event.note : event.type === "phrase" ? "Phrase" : "Compass")}</span>
        <span>${escapeHtml(eventSummary(event))}</span>
        <time datetime="${new Date(event.timestamp).toISOString()}">${nowLabel(event.timestamp)}</time>
      </li>`).join("")
    : `<li class="empty-agent-activity">Agent notes and musical choices will appear here.</li>`;
}

function showAgentNote(note, instrument, duration = 0.45) {
  const token = crypto.randomUUID();
  state.agentPlaying.set(token, { note, instrument });
  renderAgentPanel();
  setTimeout(() => {
    state.agentPlaying.delete(token);
    renderAgentPanel();
  }, Math.max(120, Number(duration) * 1000));
}

function setHumanTrackLive(live, settleDelay = 180) {
  const label = $("#track-status");
  clearTimeout(humanTrackTimer);
  if (live) {
    label.textContent = "Your track · live";
    label.classList.add("live");
    return;
  }
  humanTrackTimer = setTimeout(() => {
    label.textContent = "Your track · ready";
    label.classList.remove("live");
  }, settleDelay);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function storageKey() {
  return state.room ? `tunein:room:${state.room}` : null;
}

function saveRoom() {
  const key = storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      bpm: state.bpm,
      key: state.key,
      scale: state.scale,
      agentName: state.agentName,
      events: state.events.slice(-64),
    }));
  } catch {
    // The room remains usable when storage is unavailable.
  }
}

function loadRoom(room) {
  try {
    const saved = JSON.parse(localStorage.getItem(`tunein:room:${room}`));
    if (!saved) return;
    state.bpm = Number(saved.bpm) || state.bpm;
    state.key = saved.key || state.key;
    state.scale = saved.scale || state.scale;
    state.agentName = saved.agentName || null;
    state.events = Array.isArray(saved.events) ? withStableTurnIds(saved.events.slice(-64)) : [];
  } catch {
    state.events = [];
  }
}

function broadcast(message) {
  state.channel?.postMessage({ ...message, sender: window.name || crypto.randomUUID() });
}

function withStableTurnIds(events) {
  let currentTurn = null;
  return events.map((event) => {
    if (!["note", "phrase"].includes(event.type)) return event;
    const role = event.role === "agent" ? "agent" : "human";
    const actor = String(event.actor || (role === "agent" ? "Agent" : "You"));
    const startsTurn = !currentTurn
      || currentTurn.role !== role
      || currentTurn.actor !== actor
      || (event.turnId && event.turnId !== currentTurn.id);
    if (startsTurn) currentTurn = { id: String(event.turnId || event.id), role, actor };
    return event.turnId === currentTurn.id ? event : { ...event, turnId: currentTurn.id };
  });
}

function recordEvent(event, shouldBroadcast = true) {
  let completeEvent = {
    id: event.id || crypto.randomUUID(),
    timestamp: event.timestamp || Date.now(),
    ...event,
  };
  if (["note", "phrase"].includes(completeEvent.type) && !completeEvent.turnId) {
    const role = completeEvent.role === "agent" ? "agent" : "human";
    const actor = String(completeEvent.actor || (role === "agent" ? "Agent" : "You"));
    const previous = [...state.events].reverse().find((item) => ["note", "phrase"].includes(item.type));
    const previousRole = previous?.role === "agent" ? "agent" : "human";
    const previousActor = String(previous?.actor || (previousRole === "agent" ? "Agent" : "You"));
    completeEvent = {
      ...completeEvent,
      turnId: previous && previousRole === role && previousActor === actor
        ? String(previous.turnId || previous.id)
        : completeEvent.id,
    };
  }
  if (state.events.some((existing) => existing.id === completeEvent.id)) return completeEvent;
  state.events = [...state.events.slice(-63), completeEvent];
  if (completeEvent.type === "note") visualNote(completeEvent);
  renderActivity();
  saveRoom();
  if (shouldBroadcast) broadcast({ type: "event", event: completeEvent });
  return completeEvent;
}

function updateAgentSeat() {
  const joined = Boolean(state.agentName);
  $("#agent-name").textContent = joined ? state.agentName : "Open chair";
  $("#agent-message").textContent = joined
    ? `${state.agentName} can hear the room state and perform through WebMCP.`
    : "Create a room, then share its key with your browser agent.";
  $("#agent-status").textContent = joined ? "Tuned in" : "Waiting";
  $("#agent-status").classList.toggle("joined", joined);
  renderAgentPanel();
}

function updateCompassUI() {
  $("#tempo").value = String(state.bpm);
  $("#tempo-value").textContent = `${state.bpm} bpm`;
  $("#key-select").value = state.key;
  $("#scale-select").value = state.scale;
  const percent = ((state.bpm - 56) / (160 - 56)) * 100;
  $("#tempo").style.setProperty("--tempo-percent", `${percent}%`);
  $("#tempo").setAttribute("aria-valuetext", `${state.bpm} beats per minute`);
}

function connectRoomChannel(room) {
  state.channel?.close();
  if (!("BroadcastChannel" in window)) return;
  state.channel = new BroadcastChannel(`tunein-room-${room}`);
  state.channel.addEventListener("message", ({ data }) => {
    if (data?.type === "event" && data.event) {
      recordEvent(data.event, false);
      if (data.event.type === "note") {
        makeVoice(data.event.note, data.event.instrument, data.event.velocity, data.event.duration);
        if (data.event.role === "agent") showAgentNote(data.event.note, data.event.instrument, data.event.duration);
      }
      if (data.event.type === "settings" && data.event.settings) {
        Object.assign(state, data.event.settings);
        updateCompassUI();
        saveRoom();
      }
      if (data.event.type === "presence" && data.event.role === "agent") {
        state.agentName = data.event.actor;
        updateAgentSeat();
      }
    } else if (data?.type === "clear") {
      state.events = [];
      state.agentPlaying.clear();
      saveRoom();
      $("#note-field").replaceChildren();
      $("#score-empty").classList.remove("hidden");
      renderActivity();
    }
  });
}

function joinRoom(rawRoom, { actor = "You", role = "human", announce = true } = {}) {
  const room = normalizeRoomCode(rawRoom);
  if (!isValidRoomCode(room)) throw new Error("Room keys contain 4–8 letters or numbers.");

  const changedRoom = state.room !== room;
  state.room = room;
  if (changedRoom) {
    state.events = [];
    loadRoom(room);
    connectRoomChannel(room);
  }

  if (role === "agent") state.agentName = String(actor).slice(0, 32);
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  history.replaceState({}, "", url);
  $("#room-code").textContent = room;
  $("#room-state").textContent = "Room open · shared in this browser";
  $("#copy-room").disabled = false;
  $("#join-code").value = "";
  $("#prompt-room").textContent = room;
  updateCompassUI();
  updateAgentSeat();
  renderActivity();

  if (announce) recordEvent({ type: "presence", actor, role });
  return room;
}

function createRoom() {
  const room = createRoomCode();
  joinRoom(room, { announce: false });
  state.events = [];
  recordEvent({ type: "presence", actor: "You", role: "human" });
  showToast(`Room ${room} is ready`);
}

function setInstrumentMenuOpen(open) {
  const trigger = $("#instrument-trigger");
  const options = $("#instrument-options");
  trigger.setAttribute("aria-expanded", String(open));
  options.hidden = !open;
  $(".instrument-menu").classList.toggle("open", open);
}

function setInstrument(instrument) {
  if (!INSTRUMENTS.includes(instrument)) return;
  state.instrument = instrument;
  const meta = instrumentMeta[instrument];
  $("#instrument-name").textContent = meta.name;
  $("#instrument-description").textContent = meta.description;
  $("#instrument-glyph").className = `instrument-glyph ${meta.glyphClass}`;
  $("#instrument-glyph").textContent = meta.glyph;
  $$(".instrument-option").forEach((option) => {
    const selected = option.dataset.instrument === instrument;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
  setInstrumentMenuOpen(false);
}

function playHumanNote(note, inputKey) {
  const voiceKey = inputKey || note;
  if (activeVoices.has(voiceKey)) return;
  const startedAt = Date.now();
  const eventId = crypto.randomUUID();
  const voice = makeVoice(note, state.instrument, 0.72);
  activeVoices.set(voiceKey, { voice, startedAt, eventId, note });
  $$(`[data-note="${note}"]`).forEach((key) => key.classList.add("active"));
  recordEvent({
    id: eventId,
    timestamp: startedAt,
    type: "note",
    note,
    instrument: state.instrument,
    actor: "You",
    role: "human",
    duration: null,
    durationBeats: null,
    velocity: 0.72,
  }, false);
  setHumanTrackLive(true);
}

function stopHumanNote(note, inputKey) {
  const voiceKey = inputKey || note;
  const active = activeVoices.get(voiceKey);
  if (!active) return;
  active.voice.stop();
  activeVoices.delete(voiceKey);
  $$(`[data-note="${note}"]`).forEach((key) => key.classList.remove("active"));
  const duration = Math.max(0.08, (Date.now() - active.startedAt) / 1000);
  const durationBeats = duration * state.bpm / 60;
  const eventIndex = state.events.findIndex((event) => event.id === active.eventId);
  const existing = state.events[eventIndex];
  const completeEvent = {
    ...(existing || {
      id: active.eventId,
      timestamp: active.startedAt,
      type: "note",
      note,
      instrument: state.instrument,
      actor: "You",
      role: "human",
      velocity: 0.72,
    }),
    duration,
    durationBeats,
  };
  if (eventIndex >= 0) state.events = state.events.with(eventIndex, completeEvent);
  else state.events = [...state.events.slice(-63), completeEvent];
  visualNote(completeEvent);
  renderActivity();
  saveRoom();
  broadcast({ type: "event", event: completeEvent });
  if (!activeVoices.size) setHumanTrackLive(false);
}

function buildKeyboard() {
  const keyboard = $("#keyboard");
  const whiteMarkup = whiteKeys.map((note, index) => (
    `<button class="key white" type="button" data-note="${note}" aria-label="Play ${note}"><span>${whiteBindings[index].toUpperCase()}</span></button>`
  )).join("");
  const blackMarkup = blackKeys.map(([note, position], index) => (
    `<button class="key black" style="left: calc(7px + (100% - 14px) * ${position})" type="button" data-note="${note}" aria-label="Play ${note}"><span>${blackBindings[index].toUpperCase()}</span></button>`
  )).join("");
  keyboard.innerHTML = whiteMarkup + blackMarkup;

  $$(".key").forEach((key) => {
    key.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      key.setPointerCapture(event.pointerId);
      playHumanNote(key.dataset.note, `pointer-${event.pointerId}`);
    });
    const release = (event) => stopHumanNote(key.dataset.note, `pointer-${event.pointerId}`);
    key.addEventListener("pointerup", release);
    key.addEventListener("pointercancel", release);
  });
}

function setCompass(input = {}, actor = "You") {
  const updates = {};
  if (Number.isInteger(Number(input.bpm)) && Number(input.bpm) >= 56 && Number(input.bpm) <= 160) updates.bpm = Number(input.bpm);
  if (["C", "D", "E", "F", "G", "A", "B"].includes(input.key)) updates.key = input.key;
  if (["major", "minor", "pentatonic"].includes(input.scale)) updates.scale = input.scale;
  Object.assign(state, updates);
  updateCompassUI();
  if (updates.bpm && state.metronomeTimer) {
    clearInterval(state.metronomeTimer);
    state.metronomeTimer = null;
    $("#metronome").setAttribute("aria-pressed", "false");
    toggleMetronome();
  }
  const detail = Object.entries(updates).map(([key, value]) => `${key} to ${value}`).join(", ") || "no settings";
  recordEvent({ type: "settings", actor, role: actor === "You" ? "human" : "agent", detail, settings: updates });
  return { ok: true, room: state.room || "SOLO", compass: { bpm: state.bpm, key: state.key, scale: state.scale } };
}

function roomState(eventLimit = 16) {
  const recentEvents = state.events.slice(-Math.max(1, Math.min(6, eventLimit)));
  const firstTimestamp = recentEvents[0]?.timestamp || Date.now();
  return {
    room: state.room || "SOLO",
    status: state.room ? "open" : "private_rehearsal",
    compass: { bpm: state.bpm, key: state.key, scale: state.scale },
    availableInstruments: INSTRUMENTS,
    participants: ["Human", ...(state.agentName ? [state.agentName] : [])],
    recentEvents: recentEvents.map((event) => ({
      type: event.type,
      actor: event.actor,
      role: event.role,
      note: event.note,
      instrument: event.instrument,
      label: event.label,
      beatOffset: Number((((event.timestamp - firstTimestamp) * state.bpm) / 60000).toFixed(2)),
      durationBeats: Number.isFinite(event.durationBeats) ? Number(event.durationBeats.toFixed(2)) : undefined,
    })),
  };
}

function listen(eventLimit = 16) {
  const recent = state.events.filter((event) => event.type === "note").slice(-Math.max(3, Math.min(10, eventLimit)));
  const firstTimestamp = recent[0]?.timestamp || Date.now();
  return {
    room: state.room || "SOLO",
    compass: { bpm: state.bpm, key: state.key, scale: state.scale },
    analysis: analyzePerformance(recent, state),
    notesHeard: recent.map((event) => ({
      note: event.note,
      beatOffset: Number((((event.timestamp - firstTimestamp) * state.bpm) / 60000).toFixed(2)),
      durationBeats: Number.isFinite(event.durationBeats) ? Number(event.durationBeats.toFixed(2)) : null,
      instrument: event.instrument,
      player: event.actor,
    })),
    safeNotesToTry: scaleNotes(state.key, state.scale, 4),
  };
}

async function performPhrase(input, signal) {
  if (!state.room) throw new Error("Join a room before performing a phrase.");
  const phrase = validatePhrase(input);
  const actor = state.agentName || "AI collaborator";
  if (!state.agentName) {
    state.agentName = actor;
    updateAgentSeat();
  }

  const phraseStartedAt = Date.now();
  recordEvent({ type: "phrase", actor, role: "agent", instrument: phrase.instrument, label: phrase.label, timestamp: phraseStartedAt });
  const secondsPerBeat = 60 / state.bpm;
  const timers = [];

  for (const step of phrase.steps) {
    const timer = setTimeout(() => {
      if (signal?.aborted) return;
      const duration = step.durationBeats * secondsPerBeat;
      makeVoice(step.note, phrase.instrument, phrase.velocity, duration);
      showAgentNote(step.note, phrase.instrument, duration);
      $$(`[data-note="${step.note}"]`).forEach((key) => {
        key.classList.add("active");
        setTimeout(() => key.classList.remove("active"), duration * 1000);
      });
      recordEvent({
        type: "note",
        note: step.note,
        instrument: phrase.instrument,
        actor,
        role: "agent",
        duration,
        durationBeats: step.durationBeats,
        velocity: phrase.velocity,
        timestamp: phraseStartedAt + step.beat * secondsPerBeat * 1000,
      });
    }, step.beat * secondsPerBeat * 1000);
    timers.push(timer);
  }

  signal?.addEventListener("abort", () => timers.forEach(clearTimeout), { once: true });
  const endingBeat = Math.max(...phrase.steps.map((step) => step.beat + step.durationBeats));
  return {
    ok: true,
    room: state.room,
    performer: actor,
    instrument: phrase.instrument,
    scheduledNotes: phrase.steps.length,
    durationSeconds: Number((endingBeat * secondsPerBeat).toFixed(2)),
    message: `Scheduled “${phrase.label}”. Listen again after the human responds.`,
  };
}

function playStarterMotif() {
  const notes = scaleNotes(state.key, state.scale, 4).filter((note) => NOTES.includes(note));
  const motif = [notes[0], notes[2] || notes[1], notes[4] || notes[2], notes[3] || notes[1], notes[1], notes[0]];
  const interval = (60 / state.bpm) * 500;
  setHumanTrackLive(true);
  motif.forEach((note, index) => setTimeout(() => {
    if (!note) return;
    makeVoice(note, state.instrument, 0.65, 0.32);
    recordEvent({
      type: "note",
      note,
      instrument: state.instrument,
      actor: "You",
      role: "human",
      duration: 0.32,
      durationBeats: 0.32 * state.bpm / 60,
      velocity: 0.65,
    });
  }, index * interval));
  setTimeout(() => setHumanTrackLive(false), motif.length * interval + 360);
}

function toggleMetronome() {
  const button = $("#metronome");
  const isRunning = Boolean(state.metronomeTimer);
  if (isRunning) {
    clearInterval(state.metronomeTimer);
    state.metronomeTimer = null;
    button.setAttribute("aria-pressed", "false");
    $("#metronome-state").textContent = "Off";
    return;
  }

  const tick = () => {
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.045);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.05);
    $("#playhead").animate([{ opacity: 0.9 }, { opacity: 0.2 }], { duration: 180 });
  };
  tick();
  state.metronomeTimer = setInterval(tick, (60 / state.bpm) * 1000);
  button.setAttribute("aria-pressed", "true");
  $("#metronome-state").textContent = "On";
}

function bindUI() {
  $("#new-room").addEventListener("click", createRoom);
  $("#join-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      joinRoom(new FormData(event.currentTarget).get("room"));
      showToast("You’re in the room");
    } catch (error) {
      showToast(error.message);
      $("#join-code").focus();
    }
  });
  $("#join-code").addEventListener("input", (event) => { event.target.value = normalizeRoomCode(event.target.value); });
  $("#copy-room").addEventListener("click", async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Room link copied");
  });
  $("#copy-prompt").addEventListener("click", async () => {
    const room = state.room || "the room on this page";
    const prompt = `Open ${window.location.href}, join room ${room}, listen to my recent phrase, and answer with a short compatible phrase on violin.`;
    await navigator.clipboard.writeText(prompt);
    showToast("Agent prompt copied");
  });
  const instrumentTrigger = $("#instrument-trigger");
  const instrumentOptions = $("#instrument-options");
  instrumentTrigger.addEventListener("click", () => {
    setInstrumentMenuOpen(instrumentTrigger.getAttribute("aria-expanded") !== "true");
  });
  instrumentTrigger.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    setInstrumentMenuOpen(true);
    const choices = $$(".instrument-option");
    (choices.find((choice) => choice.dataset.instrument === state.instrument) || choices[0])?.focus();
  });
  $$(".instrument-option").forEach((option) => option.addEventListener("click", () => {
    setInstrument(option.dataset.instrument);
    instrumentTrigger.focus();
  }));
  instrumentOptions.addEventListener("keydown", (event) => {
    const choices = $$(".instrument-option");
    const currentIndex = choices.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setInstrumentMenuOpen(false);
      instrumentTrigger.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? choices.length - 1
        : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
    choices[nextIndex]?.focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".instrument-menu")) setInstrumentMenuOpen(false);
  });
  $("#tempo").addEventListener("input", (event) => {
    state.bpm = Number(event.target.value);
    updateCompassUI();
  });
  $("#tempo").addEventListener("change", () => setCompass({ bpm: state.bpm }));
  $("#key-select").addEventListener("change", (event) => setCompass({ key: event.target.value }));
  $("#scale-select").addEventListener("change", (event) => setCompass({ scale: event.target.value }));
  $("#metronome").addEventListener("click", toggleMetronome);
  $("#clear").addEventListener("click", () => {
    state.events = [];
    state.agentPlaying.clear();
    saveRoom();
    $("#note-field").replaceChildren();
    $("#score-empty").classList.remove("hidden");
    renderActivity();
    broadcast({ type: "clear" });
    showToast("Notes and activity cleared · room settings kept");
  });
  $("#play-starter").addEventListener("click", playStarterMotif);

  const keyMap = Object.fromEntries([
    ...whiteBindings.map((binding, index) => [binding, whiteKeys[index]]),
    ...blackBindings.map((binding, index) => [binding, blackKeys[index][0]]),
  ]);
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    const note = keyMap[event.key.toLowerCase()];
    if (note) {
      event.preventDefault();
      playHumanNote(note, `key-${event.key.toLowerCase()}`);
    }
  });
  window.addEventListener("keyup", (event) => {
    const note = keyMap[event.key.toLowerCase()];
    if (note) stopHumanNote(note, `key-${event.key.toLowerCase()}`);
  });
  window.addEventListener("blur", () => {
    [...activeVoices.entries()].forEach(([voiceKey, active]) => stopHumanNote(active.note, voiceKey));
  });
}

async function initializeWebMCP() {
  const status = $(".header-status");
  const label = $("#mcp-status");
  const modelContext = document.modelContext;
  window.__TUNEIN_TOOLS__ = createTuneInTools(appAdapter);

  if (!modelContext?.registerTool) {
    label.textContent = "Human mode · WebMCP available in supported browsers";
    return;
  }

  try {
    const tools = createTuneInTools(appAdapter);
    const controller = new AbortController();
    await Promise.all(tools.map((tool) => document.modelContext.registerTool(tool, { signal: controller.signal })));
    status.classList.add("ready");
    label.textContent = `${tools.length} WebMCP tools live`;
  } catch (error) {
    label.textContent = "WebMCP tools unavailable";
    console.warn("TuneIn could not register its WebMCP tools.", error);
  }
}

const appAdapter = {
  joinRoom,
  getRoomState: roomState,
  listen,
  performPhrase,
  setCompass,
};

buildKeyboard();
bindUI();
updateCompassUI();
updateAgentSeat();
renderActivity();

const roomFromUrl = normalizeRoomCode(new URL(window.location.href).searchParams.get("room") || "");
if (isValidRoomCode(roomFromUrl)) joinRoom(roomFromUrl, { announce: false });

initializeWebMCP();
