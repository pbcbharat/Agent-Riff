# Agent Riff — WebMCP Challenge submission kit

## Tagline

Play a thought together.

## Short description

Agent Riff is a live music board where a person and their browser agent improvise together. The person plays a phrase; the agent joins the current page session through structured WebMCP tools, chooses a complementary instrument, and answers in time.

## Full project description

Most music software treats AI as a generator behind a prompt box. Agent Riff treats the agent as another musician in the session.

A person opens the board and plays on a responsive instrument using touch, mouse, or keyboard. Their performance becomes shared musical context: recent notes, instrument voices, tempo, key, scale, density, and pitch center. A browser agent can join the current page session with WebMCP, inspect that context, listen before acting, and perform a precisely timed answer on piano, violin, trumpet, or synth. The shared score makes every human and agent contribution visible.

The result is a conversation instead of a one-shot generation. The person supplies instinct and expression. The agent supplies attention, recall, and a second musical voice. Each new phrase changes what a good next response should be.

## Why WebMCP is a strong fit

A screenshot can show piano keys, but it cannot reliably communicate the timing and musical meaning of what just happened. WebMCP gives the agent a compact contract for joining the page session, reading live state, analyzing a phrase, and contributing notes with explicit beat offsets and durations. The agent can act through the same product logic as a person while the person stays in the loop and sees every action.

Without WebMCP, the agent would have to infer notes from pixels and click keys at fragile screen coordinates. With WebMCP, it can reason about music and spend its effort on the creative choice.

## What people and agents do together

- A person begins an original musical idea with timing and feel.
- The agent listens to the actual recent performance rather than a textual summary.
- The agent chooses a compatible register, amount of space, instrument, and phrase.
- The person hears and sees the answer immediately, then changes direction.
- Both can update the shared musical compass and continue the exchange.

This back-and-forth is difficult to achieve with a traditional chatbot or an agent actuating a visual interface.

## WebMCP implementation

Agent Riff uses the current imperative API at `document.modelContext.registerTool()` and registers seven focused tools:

1. `riff_join_session`
2. `riff_get_session_state`
3. `riff_listen`
4. `riff_wait_for_human_phrase`
5. `riff_perform_phrase`
6. `riff_perform_set`
7. `riff_set_compass`

Each tool has a descriptive JSON Schema and security-relevant annotations. Read tools return compact, structured musical context. Mutating tools reuse the same validated application functions as the visible interface. The phrase tool supports overlapping notes, beat-relative scheduling, multiple timbres, bounded phrase length, bounded velocity, and cancellation. The set tool provides a compact score format and a small public-domain melody catalog so an explicit song request can be scheduled in one call instead of many model/browser round trips.

## Judging-criteria framing

### WebMCP leverage

The agent workflow is genuinely tool-driven: joining, listening, analyzing, performing, and adjusting shared state. The musical result depends on live page context and changes after every human phrase.

### Execution

The project is a complete instrument: responsive audio, visual score, event history, multiple voices, keyboard/touch access, empty and connected states, validation, tests, documentation, and deployment output.

### Potential impact

Agent Riff lowers the social and technical barrier to musical collaboration. It can help a learner explore call-and-response, give a solo player an attentive practice partner, or let anyone sketch an idea with a second voice without installing music software.

### Creativity and ambition

The agent is not a song vending machine. It becomes a present, visible collaborator whose musical turn is grounded in what the person just played.

## Demo video script (target: 2:20)

### 0:00–0:18 — The idea

“Music apps usually make you prompt an AI and wait. Agent Riff puts the agent on the other side of the instrument. I play an idea; it listens and plays back.”

Show the full board, change from piano to synth, and play three notes.

### 0:18–0:40 — Start the session

Point out the shared compass, live score, and waiting agent seat. Copy the provided agent prompt.

### 0:40–1:05 — Human phrase

Play a short original phrase on piano. Pause deliberately. Show the event history and score capturing the notes.

### 1:05–1:35 — WebMCP in action

Ask the agent: “Use Agent Riff’s WebMCP tools to join this session and stay for a live call-and-response jam.”

Show the agent calling `riff_join_session`, `riff_listen`, and `riff_perform_phrase`. Let the violin answer play. Point out the agent's named seat and violet events.

### 1:35–1:58 — A real duet

Answer the agent on piano, then ask it to listen again and add a trumpet harmony. Change the tempo or scale through `riff_set_compass`.

### 1:58–2:20 — Why WebMCP

“The agent does not guess where keys are or reconstruct music from pixels. WebMCP gives it the session's actual musical state and a safe, expressive way to contribute. Agent Riff becomes more useful because a person and an agent are present together.”

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
