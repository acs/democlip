# Implementation Plan: Export to YouTube

**Branch**: `feat/youtube-export` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-youtube-export/spec.md`

## Summary

A clip goes from the review to the person's own YouTube channel in one pass: **YouTube** in
the Export menu, a Google sign-in in that window, a title, a description and a visibility
(private at the start), and an upload. The kept clip is written as **MP4** — the same
encoder the Bluesky path already uses — sent to YouTube's own upload endpoint as a
**resumable session**, and answered with the video's own address — and what YouTube does with
the video afterwards is **said rather than watched**, because the one scope the app asks for
allows the upload and nothing that reads the account (`research.md` D4).

The shape is the Bluesky path, a second time: pure rules in `src/domain/youtube/`
(`Visibility`, `VideoDetails`, `UploadableVideo`), a use case in `src/application/` with the
network behind a port (`YouTubeService`), the browser and the token in one adapter
(`src/infra/youtube.ts`), and a dialog and a menu entry in `src/ui/`. The app gains **no
runtime dependency**: Google's Identity Services client is a hosted script, loaded only when
a sign-in is asked for, exactly as the Bluesky client is.

Two things make YouTube unlike Bluesky, and the plan turns on them. The sign-in is a
**popup consent that needs the person's gesture** — no redirect, so no trip away and no
`keep.persist()` on the way — and the token is **short-lived with no refresh token**, which
is the whole of what a browser with no server can hold. And the **length is the only limit
that binds**: at the app's own bitrate ceiling a 15-minute clip is a couple of gigabytes,
far under YouTube's 256 GB.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict (existing) — the app and the
`mcp/` package it already ships.

**Primary Dependencies**: **none added**. Google's Identity Services client is a hosted
script (`https://accounts.google.com/gsi/client`) loaded at the moment a sign-in is asked
for, as `@atproto/oauth-client-browser` is; the MP4 is written by the Mediabunny + WebCodecs
encoder the export already has (`specFor('mp4')`, H.264/AAC). Vite ^8.3.8 and
Vitest ^5.1.0, unchanged.

**Storage**: unchanged — the clip stays in IndexedDB and the app writes no new file. The
one new piece of state is the **Google access token**, which lives in memory for the page
and is never written down (the token model keeps no refresh token). The app's own client
registration — a **client ID**, which is public and not a secret — is served from a small
JSON beside the app, so a fork sets its own and the deploy owns the fact.

**Testing**: a rule in `src/domain/youtube/` is proved by a **unit test in node** beside
it; the use case's sequencing (the ceiling refused *before* any encoding, each stage, giving
up) and the adapter's response mapping are proved in node with a fake service and an
injected `fetch`; the menu, the dialog's states, the progress lines and a refusal are proved
by a **committed check in `e2e/`** with the Google script and the upload stood in by
`page.route`; and a **real session by the user** covers the two no check can do — a real
Google consent, and a real upload to a real channel (Verification skill).

**Target Platform**: a modern desktop browser. Screen recording already bounds the app to
Chrome, Firefox and Safari on a desktop, and the token model is supported in all three. No
mobile.

**Project Type**: the browser application as it is, plus the existing `mcp/` package, whose
publish operation gains a destination.

**Performance Goals**: the encode is unchanged (offline, ~10× real time); the upload is
bounded by the network and reports its own byte progress; and nothing is read back, so the
app never waits on a call the scope does not allow. A clip over the ceiling is refused in
under a second, before any encoding (SC-003).

**Constraints**: pure browser — no server, and no secret held anywhere (the client ID is
public); the app must say plainly when it is not configured, or when Google refuses an
account, and upload nothing (FR-008); YouTube's limits enforced before encoding (FR-014);
the recording never re-encoded beyond the export; one step per pull request and CI owns the
version, for the app and for `mcp/`; the words go into `GLOSSARY.md` before they appear in
code.

**Scale/Scope**: one new domain folder (`domain/youtube/`, three small classes), one port
and one use case, one adapter, one dialog and its flow, one Export-menu entry, the DOM and
CSS for the dialog, a change to the automation surface and to one MCP tool, and the words,
the README and `FEATURES.md`. The app's four layers and the clip's own rules are untouched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; a new word goes into the glossary first | PASS | Step 1 adds **upload** (the destination's own word for the transfer, beside **publish**), **visibility**, **video status**, **YouTube account** and **client registration** to `GLOSSARY.md`, with a *Publishing to YouTube* section, and updates the Overview and Domain-model maps, before any code. The plan follows the Domain model skill (rules in `domain/`, the network behind a port) and the Verification skill (unit, e2e, and a real session for what no check can open). |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | `Visibility`, `VideoDetails` and `UploadableVideo` are pure classes holding their own rules. Every network call, and the Google script itself, sits behind `YouTubeService` — a port the use case owns — and its adapter in `infra/youtube.ts`. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | Each new domain class gets a unit test beside it; the use case's sequencing gets a node test with a fake service, and the adapter's mapping a node test with an injected `fetch`. No existing domain test changes — the clip's rules are untouched. |
| IV. What is drawn, played or encoded is proved in a browser | A committed check in `e2e/`, run in a real browser; the recorder's flow is a real session by the user | PASS | Step 5 adds `e2e/checks/youtube.spec.ts` for the menu entry, the dialog's states, the progress and a refusal, with the Google script and the upload stood in by `page.route`. A real Google consent and a real upload are named, in `quickstart.md`, as the user's real session — the same row the real publish already occupies. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is docs-only. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | Seven steps, each its own branch and pull request; no step edits a version by hand, and CI stamps `mcp/` with the app's version as it already does (step 6 changes that package's tool list only). |

No violations. The Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-youtube-export/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   ├── youtube-api.md   # What the app sends YouTube, and what it expects back
│   └── publish-destination.md # The changed publish operation, on the surface and in the tool list
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
web/
├── index.html                     # + the YouTube dialog's markup
├── styles.css                     # + its look
└── public/
    └── youtube-client.json        # NEW — the app's client registration (a public client ID)

src/
├── domain/
│   └── youtube/                   # NEW — pure rules, no browser
│       ├── Visibility.ts          #   private | unlisted | public, private by default
│       ├── VideoDetails.ts        #   title, description, visibility, the category, watchUrl()
│       ├── UploadableVideo.ts     #   the MP4 to send, with YouTube's own limits
│       └── *.test.ts              #   a test beside each
├── application/
│   ├── youtube-service.ts         # NEW — the port: what needs a token and the network
│   ├── publish-to-youtube.ts      # NEW — the use case: plan, refuse, encode, upload, wait
│   └── publish-to-youtube.test.ts # NEW — its sequencing, against a fake service
├── infra/
│   ├── youtube.ts                 # NEW — the token client, the resumable upload, the poll
│   └── youtube.test.ts            # NEW — its mapping, with an injected fetch
└── ui/
    ├── publishing/
    │   ├── youtube-dialog.ts      # NEW — the dialog's DOM and states
    │   └── youtube-flow.ts        # NEW — the composition: the parts, the progress, the report
    ├── exporting/export-menu.ts   # + the YouTube choice
    └── agent/{surface.ts,out.ts}  # + a destination on the publish operation

mcp/
└── src/tools.ts                   # + destination, title, visibility on publish_clip

e2e/checks/youtube.spec.ts         # NEW — the menu, the dialog, a refusal, with the service stood in
src/main.ts                        # wires the menu entry, the dialog and the surface
```

**Structure Decision**: the app keeps its four layers and its `web/` shell; `domain/youtube/`
is a second destination's rules beside the Bluesky ones, and the network is one adapter, as
`infra/bluesky.ts` is. The dialog gets **its own file and its own DOM** rather than growing
the Bluesky one: the two ask different things (a handle and a post, versus a Google consent
and a video's details), share no state, and the YouTube sign-in is a **popup**, not a
redirect — so the `keep.persist()` trip the Bluesky sign-in takes is not needed here at all.
The MCP change is one tool's schema and one surface operation, because the destination is
what the app already offers a person and the surface and the tools must not drift apart.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working, its unit tests
green and the end-to-end suite green.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add **upload**, **visibility**, **video status**, **YouTube account** and **client registration** to `GLOSSARY.md` with a *Publishing to YouTube* section; update the Overview and Domain-model skills' maps and `FEATURES.md`. No code. | Docs review. | `docs/youtube-words` |
| 2 | **The rules.** `src/domain/youtube/`: `Visibility` (private, unlisted or public, private by default), `VideoDetails` (a title defaulted when empty and capped at 100 characters, a description capped at 5000, the visibility, the category the app sends, and `watchUrl(id)`), and `UploadableVideo` (an `video/mp4` blob, non-empty, under 256 GB — YouTube's own limits — plus the 15-minute ceiling this app enforces). | `npx vitest run src/domain/youtube` | `feat/youtube-domain` |
| 3 | **The use case and its port.** `src/application/youtube-service.ts` (the port: `uploadVideo` with byte progress) and `publish-to-youtube.ts` (plan the clip, refuse over the ceiling *before* encoding, encode MP4, upload, answer the video's id and address). | `npx vitest run src/application/publish-to-youtube.test.ts` — the refusal before any encode, both stages, an encode that fails, a destination that refuses | `feat/youtube-publish` |
| 4 | **The client.** `src/infra/youtube.ts`: the token client behind `google.accounts.oauth2` (loaded on demand), the resumable upload (the session URI from `Location`, the bytes in chunks with progress), the channel read as best effort, `signOut`, and `configured()` read from `web/public/youtube-client.json`. | `npx vitest run src/infra/youtube.test.ts` with an injected `fetch` and a fake token: the session start, a chunk, a resume, that nothing is read back, and the errors (`quotaExceeded`, `accessNotConfigured`, `youtubeSignupRequired`, a refusal, an expired token) | `feat/youtube-client` |
| 5 | **The way in.** The Export-menu entry (`exp-youtube`), the dialog and its flow (`ui/publishing/youtube-{dialog,flow}.ts`), the markup and the CSS, the wiring in `main.ts`, and the app saying plainly when it is not configured. The README's one-time setup: a Google OAuth client, the authorized origins, the consent screen's test users, and the client-ID file. | `e2e/checks/youtube.spec.ts`: the menu shows YouTube; the dialog opens on the Google view with no sign-in; with the script and the service stood in, the compose view, the progress lines and the link; with no client ID served, a plain refusal with no request sent; a clip over the ceiling refused before any upload. | `feat/youtube-ui` |
| 6 | **The agent's publish.** `out.publish` gains a `destination` and the YouTube details; `publish_clip` gains `destination` (`bluesky` \| `youtube`), `title` and `visibility`. The sign-in is still the person's: with nobody signed in, a destination is refused with a reason and nothing leaves the page. | Node tests beside the surface and the tool list; one e2e check that a YouTube publish through the surface, with nobody signed in, is refused with a reason and sends nothing. | `feat/youtube-agent` |
| 7 | **The real session, and the honest gaps.** The two no check can do, run by the user: a real Google consent in that window, and a real upload to a real channel — which also settles the one thing only the real thing can (D3: whether the upload endpoint exposes `Location` to a browser). The full gate, and the gaps. | The three levels of the Verification skill; the suite green; the user's session reported in the pull request. | `docs/youtube-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The complexity this change does add is a **second destination** whose sign-in
is a popup rather than a redirect and whose token is short-lived, and an **external contract
of its own** (Google's) with deployment facts that are not ours to fix. Both are answered by
construction: the network and the token sit behind one port, the rules sit in `domain/` where
they are tested, and the one deployment fact — the client ID — is a public value in a single
served file, so a fork owns it and a refusal is a sentence.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | `research.md` D1–D2 follow the Domain model skill (the network behind `YouTubeService`, the rules in `domain/youtube/`) and `contracts/youtube-api.md` records Google's own contract as the destination's, not a rule of ours. Step 1 puts the words in the glossary first. |
| II. `src/domain/` is pure | PASS | `contracts/publish-destination.md` keeps the surface in `ui/` calling the app's own flow; the Google script, the token and the upload are in `infra/youtube.ts`; the domain classes import nothing but each other. |
| III. Every rule has a test beside it | PASS | `data-model.md` names a unit test per domain class, and `research.md` D9 fixes which level proves what; the clip's own tests are untouched. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names `e2e/checks/youtube.spec.ts` for the menu, the dialog and the refusal, and states plainly that a real consent and a real upload are the user's session. |
| V. The words come first | PASS | Step 1 is docs-only. |
| VI. One change per pull request, and CI owns the version | PASS | Seven steps, each its own branch and pull request; no hand bump, and `mcp/` is stamped by CI as it already is. |

No new violations. The design is ready for `/speckit.tasks`.
