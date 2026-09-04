# WebMCP evaluation plan

Agent Riff's deterministic test suite checks schemas, registration lifecycle, input constraints, session analysis, and production output. The following small eval set checks the probabilistic part: whether an agent chooses and sequences the tools well.

Run each prompt in ChatGPT's in-app browser or Chrome with WebMCP enabled. Start from a fresh page session unless the case says otherwise.

| Case | Starting state | User prompt | Expected calls | Pass condition |
| --- | --- | --- | --- | --- |
| Join only | No agent is seated | “Join this Agent Riff session but don't play yet.” | `riff_join_session` | Agent joins exactly once and does not call a performance tool. |
| Stay idle | Agent is seated and no human phrase is pending | “Wait for me.” | `riff_wait_for_human_phrase` only | A timeout ends the jam without a performance or another wait; a direct performance call is rejected. |
| Listen before playing | Human has played 4–8 notes | “Listen to that, then answer softly on violin.” | `riff_get_session_state` or `riff_listen`, then `riff_perform_phrase` | Listen precedes perform; instrument is `violin`; absent an explicit length request, the reply follows the returned 12–16-note plan and has an audible echo, variation, and resolution. |
| Stay for a live jam | Human asks for an ongoing call-and-response session | Initial `riff_listen` and `riff_perform_phrase`, then `riff_wait_for_human_phrase` → `riff_perform_phrase` for later turns | Agent uses the reply plan returned by the wait tool instead of calling `riff_listen` again, prefers compact score notation, remains in the task, and stops honestly if the bounded wait times out. |
| Respect explicit voice | Human has played a phrase | “Give me a bright two-note trumpet answer.” | `riff_listen`, then `riff_perform_phrase` | Instrument is `trumpet`; exactly two steps are supplied. |
| Leave space | Recent human phrase is dense | “Add something that doesn't crowd me.” | `riff_listen`, then `riff_perform_phrase` | Agent mentions or acts on the `busy`/space analysis; its answer is short or uses held notes. |
| Change direction | Session is C major at 96 BPM | “Let's slow down to 72 and make it A minor.” | `riff_set_compass` | Arguments are `{ "bpm": 72, "key": "A", "scale": "minor" }`; no unrelated tool runs. |
| Missing agent seat | Human has played a phrase, but no agent has joined | “Answer with a C-major chord.” | `riff_join_session`, then performance | Agent takes the seat before performing and does not claim audio played when it did not. |
| Ambiguous request | Human says “make it moodier” | Any read tool, then a clarification or compass update | Agent either asks what should change or makes a defensible minor-scale adjustment and explains it. |
| Malformed note recovery | Force a phrase call containing `H9` | `riff_perform_phrase` | Tool rejects the note with a step-specific message; agent repairs it with valid scientific pitch notation. |
| Efficient song set | Human has played a short cue in a joined session | “Answer with Mary Had a Little Lamb, Ode to Joy, and Frère Jacques.” | One `riff_perform_set` call using three catalog identifiers | Agent does not search the web, generate note objects, change the compass separately, split songs, or poll between them. |

## Scoring

Score each case from 0–2:

- **2:** correct tools, order, arguments, visible page result, and honest final response;
- **1:** journey completes but includes an unnecessary call or weak musical grounding;
- **0:** wrong tool, invalid arguments, no visible result, or false success claim.

The target is at least 20/22 with no zero on **Stay idle**, **Listen before playing**, **Stay for a live jam**, **Efficient song set**, **Change direction**, or **Missing agent seat**.
