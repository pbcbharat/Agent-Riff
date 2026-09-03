# WebMCP evaluation plan

TuneIn's deterministic test suite checks schemas, registration lifecycle, input constraints, session analysis, and production output. The following small eval set checks the probabilistic part: whether an agent chooses and sequences the tools well.

Run each prompt in ChatGPT's in-app browser or Chrome with WebMCP enabled. Start from a fresh page session unless the case says otherwise.

| Case | Starting state | User prompt | Expected calls | Pass condition |
| --- | --- | --- | --- | --- |
| Join only | No agent is seated | “Join this TuneIn session but don't play yet.” | `tunein_join_session` | Agent joins exactly once and does not call a performance tool. |
| Listen before playing | Human has played 4–8 notes | “Listen to that, then answer softly on violin.” | `tunein_get_session_state` or `tunein_listen`, then `tunein_perform_phrase` | Listen precedes perform; instrument is `violin`; phrase contains 1–128 valid note steps. |
| Stay for a live jam | Human asks for an ongoing call-and-response session | Initial `tunein_listen` and `tunein_perform_phrase`, then `tunein_wait_for_human_phrase` → `tunein_perform_phrase` for later turns | Agent uses the analysis returned by the wait tool instead of calling `tunein_listen` again, remains in the task, and stops honestly if the bounded wait times out. |
| Respect explicit voice | Human has played a phrase | “Give me a bright two-note trumpet answer.” | `tunein_listen`, then `tunein_perform_phrase` | Instrument is `trumpet`; exactly two steps are supplied. |
| Leave space | Recent human phrase is dense | “Add something that doesn't crowd me.” | `tunein_listen`, then `tunein_perform_phrase` | Agent mentions or acts on the `busy`/space analysis; its answer is short or uses held notes. |
| Change direction | Session is C major at 96 BPM | “Let's slow down to 72 and make it A minor.” | `tunein_set_compass` | Arguments are `{ "bpm": 72, "key": "A", "scale": "minor" }`; no unrelated tool runs. |
| Missing agent seat | Agent has not joined the session | “Play a C-major chord.” | `tunein_join_session`, then performance | Agent takes the seat before performing and does not claim audio played when it did not. |
| Ambiguous request | Human says “make it moodier” | Any read tool, then a clarification or compass update | Agent either asks what should change or makes a defensible minor-scale adjustment and explains it. |
| Malformed note recovery | Force a phrase call containing `H9` | `tunein_perform_phrase` | Tool rejects the note with a step-specific message; agent repairs it with valid scientific pitch notation. |
| Efficient song set | Empty joined session | “Play Mary Had a Little Lamb, Ode to Joy, and Frère Jacques.” | One `tunein_perform_set` call using three catalog identifiers | Agent does not search the web, generate note objects, change the compass separately, split songs, or poll between them. |

## Scoring

Score each case from 0–2:

- **2:** correct tools, order, arguments, visible page result, and honest final response;
- **1:** journey completes but includes an unnecessary call or weak musical grounding;
- **0:** wrong tool, invalid arguments, no visible result, or false success claim.

The target is at least 18/20 with no zero on **Listen before playing**, **Stay for a live jam**, **Efficient song set**, **Change direction**, or **Missing agent seat**.
