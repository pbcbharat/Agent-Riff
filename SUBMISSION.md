# TuneIn — WebMCP Challenge submission kit

## Tagline

Play a thought together.

## Short description

TuneIn is a live music board where a person and their browser agent improvise together. The person plays a phrase; the agent joins with a room key, listens through structured WebMCP tools, chooses a complementary instrument, and answers in time.

## Full project description

Most music software treats AI as a generator behind a prompt box. TuneIn treats the agent as another musician in the room.

A person opens the board, creates a room, and plays on a responsive instrument using touch, mouse, or keyboard. Their performance becomes shared musical context: recent notes, instrument voices, tempo, key, scale, density, and pitch center. A browser agent can join the room with WebMCP, inspect that context, listen before acting, and perform a precisely timed answer on piano, violin, trumpet, or synth. The shared score makes every human and agent contribution visible.

The result is a conversation instead of a one-shot generation. The person supplies instinct and expression. The agent supplies attention, recall, and a second musical voice. Each new phrase changes what a good next response should be.

## Why WebMCP is a strong fit

A screenshot can show piano keys, but it cannot reliably communicate the timing and musical meaning of what just happened. WebMCP gives the agent a compact contract for joining a room, reading live state, analyzing a phrase, and contributing notes with explicit beat offsets and durations. The agent can act through the same product logic as a person while the person stays in the loop and sees every action.

Without WebMCP, the agent would have to infer notes from pixels and click keys at fragile screen coordinates. With WebMCP, it can reason about music and spend its effort on the creative choice.

## What people and agents do together

- A person begins an original musical idea with timing and feel.
- The agent listens to the actual recent performance rather than a textual summary.
- The agent chooses a compatible register, amount of space, instrument, and phrase.
- The person hears and sees the answer immediately, then changes direction.
- Both can update the shared musical compass and continue the exchange.

This back-and-forth is difficult to achieve with a traditional chatbot or an agent actuating a visual interface.

## WebMCP implementation

TuneIn uses the current imperative API at `document.modelContext.registerTool()` and registers five focused tools:

1. `tunein_join_room`
2. `tunein_get_room_state`
3. `tunein_listen`
4. `tunein_perform_phrase`
5. `tunein_set_compass`

Each tool has a descriptive JSON Schema and security-relevant annotations. Read tools return compact, structured musical context. Mutating tools reuse the same validated application functions as the visible interface. The performance tool supports overlapping notes, beat-relative scheduling, multiple timbres, bounded phrase length, bounded velocity, and cancellation.

## Judging-criteria framing

### WebMCP leverage

The agent workflow is genuinely tool-driven: joining, listening, analyzing, performing, and adjusting shared state. The musical result depends on live page context and changes after every human phrase.

### Execution

The project is a complete instrument: room lifecycle, responsive audio, visual score, event history, multiple voices, keyboard/touch access, empty and connected states, cross-tab synchronization, validation, tests, documentation, and deployment output.

### Potential impact

TuneIn lowers the social and technical barrier to musical collaboration. It can help a learner explore call-and-response, give a solo player an attentive practice partner, or let anyone sketch an idea with a second voice without installing music software.

### Creativity and ambition

The agent is not a song vending machine. It becomes a present, visible collaborator whose musical turn is grounded in what the person just played.

## Demo video script (target: 2:20)

### 0:00–0:18 — The idea

“Music apps usually make you prompt an AI and wait. TuneIn puts the agent on the other side of the instrument. I play an idea; it listens and plays back.”

Show the full board, change from piano to synth, and play three notes.

### 0:18–0:40 — Create the room

Create a new room. Point out the room key, shared compass, live score, and open agent chair. Copy the provided agent prompt.

### 0:40–1:05 — Human phrase

Play a short original phrase on piano. Pause deliberately. Show the event history and score capturing the notes.

### 1:05–1:35 — WebMCP in action

Ask the agent: “Join this room, listen to my recent phrase, then answer on violin.”

Show the agent calling `tunein_join_room`, `tunein_listen`, and `tunein_perform_phrase`. Let the violin answer play. Point out the agent's named seat and violet events.

### 1:35–1:58 — A real duet

Answer the agent on piano, then ask it to listen again and add a trumpet harmony. Change the tempo or scale through `tunein_set_compass`.

### 1:58–2:20 — Why WebMCP

“The agent does not guess where keys are or reconstruct music from pixels. WebMCP gives it the room's actual musical state and a safe, expressive way to contribute. TuneIn becomes more useful because a person and an agent are present together.”

End on the animated score and the line “Play a thought together.”

## Recording notes

- Use only phrases improvised for the demo; do not perform recognizable copyrighted music.
- Keep tool-call names visible long enough to read.
- Record the app and agent in one continuous flow where possible.
- Use spoken narration and confirm audio levels before the final take.
- Keep the public YouTube video under three minutes.

## Submission checklist

- [ ] Join the challenge on Devpost.
- [ ] Add the working public app URL.
- [ ] Create a public GitHub, GitLab, or Bitbucket repository from this folder.
- [ ] Confirm the MIT license is detected in the repository header.
- [ ] Add repository and app URLs to this description.
- [ ] Record a clear demo with audible original music and narration.
- [ ] Upload the demo publicly to YouTube.
- [ ] Confirm the video is under three minutes.
- [ ] Test the public URL in ChatGPT's in-app browser or Chrome with WebMCP enabled.
- [ ] Submit before September 3, 2026 at 1:00 p.m. Pacific Time.
