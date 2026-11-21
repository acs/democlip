# Contract — the MCP tools

What the harness sees: the tools the server offers an agent, what each takes, what it
answers, and what the server promises. The operations behind them are in
`contracts/agent-surface.md`; the decisions are in `research.md`.

## 1. The tools

Named in the app's vocabulary, so a person reading the chat recognises what was done
(spec FR-016).

| Tool | Takes | Answers |
|---|---|---|
| `describe_clip` | — | the clip as data (length, kept length, takes, cuts, annotations with their properties) |
| `cut` | `from`, `to` (fractions of the clip) | what was removed, in seconds |
| `annotate` | `kind`, the shape's own numbers, and the stretch | the new annotation's id |
| `add_image` | the stretch, and where the rect goes (optional); the picture is read from the person's clipboard, not passed in | the new annotation's id |
| `set_property` | `id`, `property`, `value` | the value that now holds |
| `remove_annotation` | `id` | the annotation that went |
| `undo` | — | what was taken back |
| `seek` | `seconds` | where the playhead now is |
| `start_take` / `stop_take` | — | the take that started / the take that arrived, with its length |
| `turn_source_on` / `turn_source_off` | `source`: `screen`, `webcam` or `microphone` | the sources that are on |
| `import_take` | `path`: a video file on this machine, as an absolute path | the take that arrived, with its index and its length — and the annotations beside it, when a **sidecar** was written there |
| `export_clip` | `target`: `webm` or `mp4`; `annotations` (optional): `drawn` or `carried` | the path the file was written to, its size, and — when carried — the path of the sidecar written beside it |
| `publish_clip` | `text`, `alt` | the post's address |

**Guarantees**

- **one tool per operation**, and no tool that evaluates code, scripts the page, or reaches
  the network except through `publish_clip` (spec FR-015). Two tools reach outside the
  clip, and both are named here so the next one has to be argued for rather than slipped
  in. **`add_image` reads the person's clipboard**, which is not a file and takes no path:
  it is the one picture source an agent has for now, read in the server because a browser
  gives a picture only to a focused window a hand has just touched; and **`import_take`
  names a path** — the only path any tool takes. The *browser* reads that file, not the
  server, and what becomes of it is the app's own rule, so what an agent may bring in is
  exactly what a person could have chosen in the app's own Import;
- **the two the server delivers itself are the browser's own doors**: `turn_source_on` for
  `screen` is a real press on the app's Screen button, so the browser grants the
  activation the share picker needs (D2), and `import_take` fills the app's own file
  input, because a page cannot read a disk. Every other tool goes through the surface;
- **an app-level no is a result, not an error**: the tool answers with the reason, so the
  agent can read it and try something else (FR-008);
- **`export_clip` answers with a path** the person can reach, taken from the browser's own
  download (D5) — or, with `annotations: "carried"`, with **two**: the video, and the
  **sidecar** written beside it holding the annotations as data. The app names it, the
  video's own name with `.democlip.json` where the video's extension was
  (`democlip-1755021992.webm` beside `democlip-1755021992.democlip.json`), and
  `import_take` finds it by looking there. That name is the whole of the convention the two
  halves of a release share, and the round trip in `mcp/src/integration.test.ts` is what
  notices if they stop agreeing on it;
- **`publish_clip` needs the person's sign-in** in that window; without it, it answers with
  the reason and nothing leaves the machine (FR-013, FR-014).

## 2. The session's life

```text
the harness starts the server (stdio)      → one process, one session
the server launches the browser (headful,   → the person sees DemoClip
  its own profile) and serves the app's
  build on loopback
the person records, choosing what to share → the picker is theirs
the agent calls tools                      → the clip changes, the person watches
the window is closed                       → the browser goes; the clip stays with the app
```

**Guarantees**

- **one session at a time**: one browser, one clip, one agent (D8);
- **the server owns the browser it opened**, and closes it when the session ends;
- **the app's build is the server's own**, shipped in the package, so the version agrees
  by construction (D3);
- **the version is checked**: the surface reports the app's version, and the server refuses
  to drive a page that does not match, with a reason (D7);
- **no network is required** to record, edit or export; only `publish_clip` reaches out,
  as the app's own publishing does.

## 3. What the server promises not to do

- **not to choose what is shared** — the picker is the person's (FR-004);
- **not to publish without the person's sign-in** (FR-014);
- **not to re-encode the recording** — every edit is the app's own (FR-009);
- **not to hold a credential**: the publishing session lives in the browser profile, as it
  does for a person (D6);
- **not to keep the clip**: it is the app's, kept where the app keeps it (D3).

## 4. Installing it

The harness starts the server as a local process. For OpenCode, one line writes the
configuration, and the tools appear named after the server:

```sh
opencode mcp add democlip -- npx -y democlip-mcp
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "democlip": { "type": "local", "command": ["npx", "-y", "democlip-mcp"] }
    }
  }
}
```

**Guarantees**

- the server needs no port, no URL and no secret to be configured: it is a local command;
- `opencode mcp list` shows whether it is connected, as for any server;
- a harness that denies a tool (for example `democlip_publish_clip`) keeps every other
  tool working — the server offers tools, the harness decides what may be called.

## 5. The dependency rule

- the server imports no module of the app: it reaches the app through the page alone, so
  the two can be released apart and still agree (they are not, in this version — one
  version, `research.md` D3);
- the app knows nothing of the server: the surface it publishes is the whole of the
  coupling.