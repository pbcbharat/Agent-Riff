# TuneIn

**Play a thought together.**

TuneIn is a shared musical canvas for a person and their browser agent. The person plays a short idea on the on-screen instrument. The agent joins the current page session through WebMCP, listens to structured performance context, chooses a complementary voice, and answers with a timed phrase.

The useful part is the exchange: a human contributes taste, timing, and surprise; an agent contributes attentive recall, music-theory context, and a second pair of hands.

## What works

- A playable C4–E5 board with piano, violin, trumpet, and synth voices
- Mouse, touch, and computer-keyboard input through the Web Audio API
- One focused, local page session with no account or setup required
- A scrolling, pitch-accurate notation view and accessible event history showing human and agent turns
- Shared tempo, key, and scale controls
- Seven imperative WebMCP tools for joining, observing, listening, waiting, performing, batching songs, and steering the session
- A dependency-free build with automated tests and a Cloudflare Worker-compatible output

## WebMCP tools

TuneIn registers tools with the current `document.modelContext.registerTool()` API:

| Tool | Purpose | Mutates state |
| --- | --- | --- |
| `tunein_join_session` | Take the agent seat in the current page session | Yes |
| `tunein_get_session_state` | Read participants, compass, instruments, and recent events | No |
| `tunein_listen` | Analyze recent pitch center, register, density, and musical space | No |
| `tunein_wait_for_human_phrase` | Wait for the next completed human phrase and return its listening analysis | No |
| `tunein_perform_phrase` | Play a compact-score or exactly timed reply, optionally changing the compass in the same call | Yes |
| `tunein_perform_set` | Schedule up to eight catalog or compact-score songs in one call | Yes |
| `tunein_set_compass` | Change tempo, key, or scale at the person's request | Yes |

Read-only and state-changing tools are annotated accordingly. Tool inputs use bounded JSON Schemas, phrases are validated again at execution time, and cancellation signals stop notes that have not yet been scheduled. Compact `NOTE/DURATION` scores keep fuller 12–16-note improvisations inexpensive, while explicit step objects remain available for exact overlapping timing. The public-domain catalog applies the same compact approach to complete-song requests.

## Run locally

TuneIn requires Node.js 20 or newer and has no runtime dependencies.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

To run all automated checks and create the production artifact:

```bash
npm run check
```

The production build is written to `dist/`. It includes static assets in `dist/client` and a Cloudflare Worker-compatible entry point at `dist/server/index.js`.

For Vercel, import the repository as a project. The checked-in `vercel.json` runs the build, publishes `dist/client`, and applies the same security headers used by the Worker artifact. No environment variables are required.

## Test with an agent

Use ChatGPT's in-app browser, which supports WebMCP, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.

1. Open TuneIn in a WebMCP-capable browser.
2. Play a short phrase with the on-screen keys or the `A`–`;` keyboard row.
3. Copy the suggested agent prompt.
4. Ask your agent to use TuneIn’s WebMCP tools to join the current session and stay for a live call-and-response jam.
5. Keep playing. After each answer, the agent can wait on the page for the next phrase without another chat message. The wait result includes the musical analysis needed for the next response, so the agent does not need a second listening call.

For development in a browser without native WebMCP, the same tool definitions are exposed read-only at `window.__TUNEIN_TOOLS__` for manual inspection. The app does not install a fake `document.modelContext` implementation.

## Architecture

- `public/app.js` owns the local session state, audio synthesis, and performance events.
- `public/core.js` contains deterministic music and validation functions.
- `public/webmcp.js` defines and registers the WebMCP tool contracts.
- `scripts/build.mjs` creates a self-contained Worker deployment without third-party build tooling.
- `test/` verifies music analysis, phrase constraints, tool schemas, and registration cleanup.
- `docs/WEBMCP_EVALS.md` defines agent-journey evals for call selection, ordering, grounding, and recovery.

The session is intentionally local to the current page and browser. TuneIn does not imply remote multiplayer or cross-browser synchronization; the browser agent collaborates through the WebMCP tools exposed by the page the person is using.

## Public-repository safety

- There are no API keys, credentials, analytics IDs, or user accounts.
- No microphone, camera, location, or media-library permission is requested.
- Notes are synthesized in the browser; the repository contains no sampled recordings. Its small built-in melody catalog contains public-domain material.
- `.env` files and common local artifacts are ignored.

Please report security concerns using [SECURITY.md](SECURITY.md).

## Challenge references

TuneIn follows the [WebMCP Challenge requirements](https://webmcp.devpost.com/rules), the [current WebMCP draft specification](https://webmachinelearning.github.io/webmcp/), and the [Chrome WebMCP implementation guidance](https://developer.chrome.com/docs/ai/agents).

## License

[MIT](LICENSE)
