---
name: Project overview
description: What DemoClip is and how it fits together — the app, the end-to-end flow, the runtime objects and their lifetimes, where each kind of code lives, and which document owns which fact. Use at the start of any work on this project, before reading the code.
---

# DemoClip, in one sitting

**A pure-browser screen recorder.** TypeScript + Vite, no server, no account, and
nothing leaves the machine unless a clip is published. Record a screen, window or
tab (or the webcam, or both) with the microphone, cut the result on a timeline,
export WebM or MP4 — or publish it to Bluesky or YouTube.

## The flow everything is built around

1. **A source.** Screen, Webcam and Mic are three independent toggles, **all off
   at start** — nothing is captured until one is pressed. The red box over the
   preview is the **crop**: which part of the screen is recorded (spatial).
2. **Record.** Every press is a **take**; a further press appends to the end of
   the **clip**. The preview is a live mirror of exactly what is going in.
3. **Review.** The takes play as one clip in a single `<video>` — they are **not**
   glued into one file. **Marks** bound a **section**; the scissors approve it into
   a **cut**, which leaves the timeline and what is left closes up (temporal).
4. **Export.** Encoded **offline** (Mediabunny + WebCodecs), faster than real
   time: WebM for the download, MP4 for Bluesky or YouTube. Publishing is optional.

## The runtime objects, and what ends them

`app` (`src/state.ts`) is the mutable model the views read. On it sit the objects
that have a lifetime, and `session.reset()` is the whole of "this session is
over" — the **New** button, or an exported clip:

- **`Clip`** — the aggregate: the takes and the cuts, with the length derived from
  them. The only thing that knows what the clip is. Unit-tested in node.
- **`Take`** — one press of Record: a blob, an object URL, a duration.
- **`Player`** — which take the `<video>` is holding. **`Playback`** — the
  transport over the clip, skipping the cuts. **`LiveTimeline`**, **`Strip`**,
  **`Waveform`** — what the timeline draws.
- **`Output`**, **`Mixer`** — a take's canvas (crop + webcam bubble) and its audio
  graph.
- The clip **outlives the page** in IndexedDB, so a reload — or the trip a Bluesky
  sign-in takes — comes back to it.

`GLOSSARY.md` has the full table of objects and lifetimes.

## Where the code lives

```
src/
  domain/       pure rules — no DOM, no browser. Span, SpanSet, TimelineMap, Take,
                Clip (the aggregate), ExportPlan, the annotation family (the base,
                its kinds, and the register),
                CropRegion and SourceSet, Session (the clip and the audio flag),
                and the YouTube family (Visibility, VideoDetails, UploadableVideo)
  application/ the use cases that run in node, and the ports they own:
                record a take, export a clip, publish (to Bluesky or YouTube), keep
                and restore a clip
  infra/        the browser boundary: capture, compositor, recorder, probe, clock,
                encoder, codecs, download, the takes' object URLs, the clip store,
                the image store, Bluesky
  ui/           the DOM and the interaction — renders the model, owns no rules;
                the annotation plugins and the shared canvas under annotating/;
                the view flows (record, review, export, publish to a service,
                resume) sequence;
                agent/ the surface an agent drives, published only when asked
  state.ts      the phase only
  session.ts    the composition: the single Session
  main.ts       the composition root
mcp/            the MCP server: a second artefact, released with the app, that
                opens a browser on the app and drives it through the surface
```

A rule about a range goes in the value object, about the clip as a whole in the
aggregate, about the browser in an adapter; collaborators behind a port. And **the
view listens**: the clip announces what changed and the modules that draw it react,
rather than a caller re-rendering around the call. The sibling **Domain model**
skill covers this properly — read it before adding a rule.

`mcp/` is not part of the app: it runs in node, reaches the app only through the
page, and is released from this repository with the app's version. The app's own
`src/` knows nothing of it; the **automation surface** it publishes is the whole of
the coupling (`GLOSSARY.md`, "Being driven by an agent").

It reaches that page over the browser's **DevTools Protocol** — Playwright is its
client for that protocol and nothing more, a library with no browser download, whose
browser the server never uses: a session launches the person's **own Chrome**. On
macOS that is forced rather than chosen, since screen recording is granted per
application bundle, so the browser is started through LaunchServices and the server
attaches to its debugging port. The protocol is the transport and it cannot be
bounded — anything holding the port can do anything to the page — so the bound is the
**tool list**, which is the app's own operations.

## Which document owns which fact

- `README.md` — what it is, how to use it, and the module map.
- `FEATURES.md` — the full feature list.
- `GLOSSARY.md` — **the words**, and the words we do not use. Use them in code,
  tests, commits and pull requests; a new concept is written there first.
- The sibling skills: **Domain model** (where a rule belongs, ports, lifetimes),
  **Verification** (unit test vs browser harness vs a real session), **Project
  workflow** (one change per PR, commit and PR shape), **Branding** (the mark, the
  name as live text, the colours and the files).

## Things that surprise a newcomer

- The recording is **never re-encoded**. A cut is *skipped* by playback and the
  export; the bytes are untouched — which is what makes one "undo" enough.
- The **export is offline**: it does not play, which is why it runs ~10× real time
  and why the file it writes carries a duration and cues that a `MediaRecorder`
  WebM does not.
- `src/domain/` runs in **node**, with a fake behind any port — the most tested
  part by far. Anything **drawn** needs a browser harness instead.
- Nothing is told how long the clip is; `Clip.total()` is the sum of the takes.
- `main` is written to through pull requests, and **CI owns the version** — never
  bump `package.json` by hand.

## Finding code quickly

Prefer the **codebase-memory MCP** — `search_graph`, `trace_path`,
`get_code_snippet`, `query_graph`, `get_architecture` — over grep for anything
structural. It is **not indexed by default** here: run `index_repository` once
(mode `fast` browses fine), or just read the files — the tree is only a few dozen
modules.
