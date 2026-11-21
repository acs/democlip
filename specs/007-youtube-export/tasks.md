# Tasks: Export to YouTube

**Input**: Design documents from `/specs/007-youtube-export/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: **Required, not optional.** This project's constitution (III and IV) and its
Verification skill make a test part of the change: a rule in `src/domain/` is proved by a
unit test beside it, and anything drawn is proved by a committed check in `e2e/`. Every test
task below is therefore part of the work, not an add-on.

**Organization**: Tasks are grouped by the user stories of `spec.md` (US1, US2, US3) so each
is independently testable. The plan's **steps are the pull requests** and cut across these
phases; each task names the branch it lands in, and *Implementation Strategy* at the end
gives the mapping.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1, US2, US3)
- Every task names the exact file(s) it touches

## Path Conventions

This project is the browser app of `plan.md` — `src/domain/`, `src/application/`, `src/infra/`,
`src/ui/`, the `web/` shell, the `mcp/` package beside it, and the committed suite in
`e2e/checks/`. Paths below are repository-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words and the map — the project's rule is that a new concept is written
into `GLOSSARY.md` before it appears in code.

- [X] T001 [P] Add **upload**, **visibility**, **video status**, **YouTube account** and **client registration** to `GLOSSARY.md`, with a new *Publishing to YouTube* section beside *Publishing to Bluesky* and the words we do not use where they apply (branch `docs/youtube-words`)
- [X] T002 [P] Update the maps for the new destination: `.agents/skills/overview/SKILL.md`, `.agents/skills/domain-model/SKILL.md`, `FEATURES.md` and the module map in `README.md` (branch `docs/youtube-words`)

**Checkpoint**: the words exist; no code has moved.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure rules, the port, the use case and the client — everything all three
user stories stand on. This is steps 2, 3 and 4 of `plan.md`.

**⚠️ CRITICAL**: no user story work begins until this phase is done.

> **Amended while testing (2026-11-22).** T006–T008 were built with a second port call,
> `videoStatus`, and a poll after the upload. A real upload showed that `videos.list` is not
> authorized by the `youtube.upload` scope, so the poll made a *successful* upload fail. The
> port has one call; the plan, the research (D4), the contract and the data model carry the
> change, and the tasks below keep the words they had when they were done.

- [X] T003 [P] Create `Visibility` — private, unlisted or public, refused otherwise, **private** when not said — in `src/domain/youtube/Visibility.ts` with its test in `src/domain/youtube/Visibility.test.ts` (`data-model.md` `Visibility`, `VideoDetails.visibility`) (branch `feat/youtube-domain`)
- [X] T004 [P] Create `VideoDetails` in `src/domain/youtube/VideoDetails.ts` with its test `src/domain/youtube/VideoDetails.test.ts`: a blank title filled from the moment and a title past 100 characters refused (`data-model.md` `VideoDetails.title`), a description past 5000 refused (`data-model.md` `VideoDetails.description`), the app's own category (`data-model.md` `VideoDetails.categoryId`), `record()` always carrying an explicit `privacyStatus` (`data-model.md` `VideoDetails.record()`, `contracts/youtube-api.md` §5 D6), and `watchUrl(id)` (branch `feat/youtube-domain`)
- [X] T005 [P] Create `UploadableVideo` in `src/domain/youtube/UploadableVideo.ts` with its test `src/domain/youtube/UploadableVideo.test.ts`: a `video/mp4` blob only, never empty, at most `VIDEO_MAX_BYTES`, and `VIDEO_MAX_SECONDS` carried with it (`data-model.md` `UploadableVideo.blob`, `UploadableVideo` `VIDEO_MAX_BYTES`/`VIDEO_MAX_SECONDS`) (branch `feat/youtube-domain`)
- [X] T006 Create the port `YouTubeService` (and `UploadedVideo`, `VideoStatus`, `UploadProgress`) in `src/application/youtube-service.ts` — named without the browser, holding only what the use case sequences (`data-model.md` `YouTubeService`) (branch `feat/youtube-publish`)
- [X] T007 [P] Implement the use case in `src/application/publish-to-youtube.ts` with its test `src/application/publish-to-youtube.test.ts`: plan the clip, refuse past `VIDEO_MAX_SECONDS` **before** the encode is called (`data-model.md` `YouTubePublication`; spec FR-014, SC-003), report the three stages in order (`data-model.md` `YouTubePublicationProgress`), answer the id and `watchUrl` (`data-model.md` `YouTubePublication`), and give up on a poll that never comes ready with a sentence (`data-model.md` `VideoStatus`) — depends on T003–T006 (branch `feat/youtube-publish`)
- [X] T008 [P] Implement the adapter in `src/infra/youtube.ts` with its test `src/infra/youtube.test.ts`: the token client behind `google.accounts.oauth2` loaded on demand, the resumable session read from `Location` and the bytes sent in 256 KB-multiple chunks that resume from `Range`, the status poll, the channel read, `signOut`, and `configured()` — the calls, headers and errors exactly as `contracts/youtube-api.md` §1–§5 state them, with an injected `fetch` and a fake token in the test — depends on T006 (branch `feat/youtube-client`)
- [X] T009 [P] Add the app's client registration `web/public/youtube-client.json` — the public OAuth client ID, with the note that a fork replaces it — beside `web/public/oauth-client-metadata.json` (`contracts/youtube-api.md` §6) (branch `feat/youtube-client`)

**Checkpoint**: the rules, the sequencing, the client and the registration exist and are
green in node. Every user story can now be built on them.

---

## Phase 3: User Story 1 - Send a finished clip to my own channel (Priority: P1) 🎯 MVP

**Goal**: from the review, pick YouTube, sign in with Google, press Upload, and a video
appears on the person's own channel holding the clip's cuts and annotations — with the
stages shown and a link at the end (spec US1).

**Independent Test**: with a clip in the review, pick **YouTube** in the Export menu, sign in
with the stood-in script, upload a short clip, and confirm the request carries the clip's own
MP4, the progress stages run, the link appears, and the kept copy is let go. Independently
valuable: it is the whole of "the clip reaches my channel".

### Implementation for User Story 1

- [X] T010 [US1] Write the flow in `src/ui/publishing/youtube-flow.ts`: `youtubeConfigured()`, `youTubeAccount()`, `signInToYouTube()`, `signOutOfYouTube()` and `uploadClip(options, handlers)` composing `publishToYouTube` with `encoder.encode(plan, frameRenderer, { target: 'mp4', width, height, onProgress })` and **no `maxBytes`** (`data-model.md` `UploadableVideo` — the byte ceiling is a sanity bound, not a budget; `research.md` D5) (branch `feat/youtube-ui`)
- [X] T011 [US1] Write the dialog `src/ui/publishing/youtube-dialog.ts` with its markup in `web/index.html` (`#yt-bd`, `#yt-signin-view`, `#yt-signin`, `#yt-compose-view`, `#yt-as`, `#yt-title`, `#yt-cancel`, `#yt-go`, `#yt-status`, `#yt-error`), its look in `web/styles.css` and its ids in `src/ui/dom.ts` — the sign-in view, the compose view, the running stages and the link, per `data-model.md` *the dialog and its states* (branch `feat/youtube-ui`, and it edits `web/index.html` and `src/ui/dom.ts` with T012, so the two are done in order)
- [X] T012 [US1] Add the **YouTube** entry to the Export menu: the choice in `src/ui/exporting/export-menu.ts`, the item in `web/index.html` (`#exp-youtube`, beside `#exp-bluesky`) and its id in `src/ui/dom.ts` (spec FR-001; and FR-002 — no other choice changes) (branch `feat/youtube-ui`, after T011)
- [X] T013 [US1] Wire it in `src/main.ts`: the choice opens `youtubeDialog`, and `youtubeDialog.init()` is called as `publishDialog.init()` is (branch `feat/youtube-ui`, depends on T011, T012)
- [X] T014 [US1] Add `e2e/checks/youtube.spec.ts`: the Export menu shows **YouTube**, the dialog opens on the sign-in view, and — with the Google script, the upload and the status stood in by `page.route` (nothing touches the network, as `e2e/checks/publishing.spec.ts` already does) — the compose view, the *encoding* → *uploading* → *processing* stages, the link to the video, and the kept copy let go (spec FR-001, FR-004, FR-013, FR-017; SC-001, SC-006) (branch `feat/youtube-ui`, depends on T013)
- [X] T015 [US1] Document the one-time setup in `README.md`: the Google Cloud project with the YouTube Data API, the OAuth Web-application client, the authorized origins (the deployed host and `http://127.0.0.1:5173`/`:5174`), the consent screen's test users, and `web/public/youtube-client.json` (`contracts/youtube-api.md` §6) (branch `feat/youtube-ui`)

**Checkpoint**: User Story 1 is functional and proved on its own — the MVP.

---

## Phase 4: User Story 2 - Say what the video is, and who may see it (Priority: P2)

**Goal**: the person sets the video's title, description and visibility before uploading,
with **private** where it starts and a sensible title when they type none (spec US2).

**Independent Test**: set a title, a description and each visibility in turn and upload;
confirm the request the check reads back carries exactly those, that a blank title becomes
the app's default, and that the visibility control starts on private. Independently valuable:
an upload with no say over its name or audience is not one a person would use.

### Implementation for User Story 2

- [X] T016 [US2] Add the **description** field and the **visibility** control (private, unlisted, public, starting private) to the dialog's compose view in `web/index.html`, `web/styles.css` and `src/ui/dom.ts` (`data-model.md` `VideoDetails.description`, `VideoDetails.visibility`) (branch `feat/youtube-ui`, depends on T011)
- [X] T017 [US2] Wire the details through in `src/ui/publishing/youtube-flow.ts` and `src/ui/publishing/youtube-dialog.ts`: build `VideoDetails.of({ title, description, visibility }, when)` so a blank title is defaulted and an over-long title or description is a plain reason rather than an upload (`data-model.md` `VideoDetails.title`, `VideoDetails.description`, `VideoDetails.record()`) (branch `feat/youtube-ui`, depends on T016)
- [X] T018 [US2] Extend `e2e/checks/youtube.spec.ts`: the description and the visibility controls are there and start on **private**; an empty title uploads the app's default title; the request the check reads back carries exactly the chosen title, description and visibility (spec FR-011, FR-012; SC-002) (branch `feat/youtube-ui`, depends on T017)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Refuse what YouTube will not take (Priority: P3)

**Goal**: a clip too long for the account is refused before it is written, and every
refusal or failure is a sentence a person can act on, leaving the clip untouched (spec US3).

**Independent Test**: hand the app a clip over the account's ceiling and ask for YouTube —
refused before anything is encoded, with a reason; refuse or interrupt an upload — the reason
is shown, the clip is unchanged, and no video is announced as up. Independently valuable: it
protects the person from a failure that arrives after minutes of encoding.

### Implementation for User Story 3

- [X] T019 [US3] Surface every refusal and failure plainly in `src/ui/publishing/youtube-flow.ts` and `src/ui/publishing/youtube-dialog.ts`: not configured, a consent refused, an expired sign-in, the allowance used up, over the ceiling, and an upload refused or interrupted — each with the sentence `contracts/youtube-api.md` §5 names, leaving the controls usable (spec FR-008, FR-014, FR-015, FR-016) (branch `feat/youtube-ui`, depends on T010, T011)
- [X] T020 [US3] Extend `e2e/checks/youtube.spec.ts`: with **no client ID** served the dialog says the app is not set up and makes **no request**; a clip over the ceiling is refused **before any upload** and the stood-in service received nothing; a refused upload shows the reason, leaves the clip untouched and leaves the dialog usable (spec FR-008, FR-014, FR-015; SC-003, SC-005) (branch `feat/youtube-ui`, depends on T019)
- [X] T021 [US3] Extend `e2e/checks/youtube.spec.ts`: an **interrupted** upload is reported as failed and never announced as done — no link is shown and the session is not ended (spec FR-016; SC-005) (branch `feat/youtube-ui`, depends on T019)

**Checkpoint**: all three stories work independently; the MVP now carries the destination's
own limits and honest failures.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the agent's side (spec *Assumptions* — the surface's publish operation gains the
destination) and the final verification. This is steps 6 and 7 of `plan.md`.

- [X] T022 [P] Give the automation surface's publish a destination: `src/ui/agent/surface.ts` and `src/ui/agent/out.ts` (`destination?: 'bluesky' | 'youtube'`, `title?`, `visibility?`), with `src/ui/agent/out.test.ts` proving an omitted destination behaves as before and an unknown one is a result rather than a throw (`contracts/publish-destination.md` §1) (branch `feat/youtube-agent`)
- [X] T023 [P] Give the MCP tool a destination: `mcp/src/tools.ts` (`publish_clip` takes `destination`, `title`, `visibility`) with `mcp/src/tools.test.ts` proving the list still has one publish tool and the schema still refuses what it should (`contracts/publish-destination.md` §3) (branch `feat/youtube-agent`, depends on T022)
- [X] T024 Wire the surface's YouTube publish in `src/main.ts` (the destination reaches `uploadClip`, the account is read as `blueskyAccount()` is) — depends on T013, T022 (branch `feat/youtube-agent`)
- [X] T025 Add to `e2e/checks/youtube.spec.ts`: a **YouTube** publish through the surface with nobody signed in is refused with a reason and **nothing is sent** (spec FR-005, FR-008; `contracts/publish-destination.md` §2) (branch `feat/youtube-agent`, depends on T024)
- [X] T026 [P] Run `quickstart.md` §1–§3 — `npx vitest run src/domain/youtube src/application/publish-to-youtube.test.ts src/infra/youtube.test.ts`, `npm run test:e2e`, `npm --prefix mcp test` — and record the output (branch `feat/youtube-agent`)
- [X] T027 Run the real session, by the user, and record what it settled in `specs/007-youtube-export/quickstart.md` §4: a real Google consent and a real upload to a real channel. It settled both open questions — the browser **can** read the resumable session's `Location`, and no **"made for kids"** declaration is required — and, the hard way, that the app must not read anything back after the upload (`research.md` D3, D4, D7) (branch `docs/youtube-final`)
- [X] T028 [P] Record the honest gaps and the level each part got in `specs/007-youtube-export/quickstart.md` §5 and the pull request body, and run the full gate (`npm run lint && npm run typecheck && npx vitest run && npm run build`) (branch `docs/youtube-final`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — can start immediately, and is docs-only.
- **Foundational (Phase 2)**: depends on Setup; **blocks every user story**.
- **User Story 1 (Phase 3)**: depends on Phase 2.
- **User Story 2 (Phase 4)**: depends on Phase 2 and on US1, whose dialog and flow it extends
  (same files: `src/ui/publishing/youtube-{dialog,flow}.ts`).
- **User Story 3 (Phase 5)**: depends on Phase 2 and on US1, whose dialog and flow it extends.
- **Polish (Phase 6)**: the agent work depends on US1's flow; the final verification depends
  on US1–US3.

### Task dependencies worth stating

- T007 and T008 both need the port, T006.
- T011, T012, T016 and T017 all edit `web/index.html`, `web/styles.css` or
  `src/ui/dom.ts` — they are done **in order**, never together.
- T014, T018, T020, T021 and T025 all extend `e2e/checks/youtube.spec.ts` — in order.
- T019 needs the flow (T010) and the dialog (T011) it speaks through.

### Parallel Opportunities

- Phase 1: T001 and T002 touch different files.
- Phase 2: T003, T004 and T005 are three separate domain files, entirely parallel; once T006
  (the port) exists, T007, T008 and T009 are parallel too.
- Phase 6: T022, T023 and T026 are independent files; T028 is independent of the agent work.
- The **user story phases cannot run in parallel in this feature** — US2 and US3 both extend
  the dialog US1 creates. They are independent in *what they prove*, not in *what they touch*,
  and this document says so rather than pretending otherwise.

### Parallel Example: Phase 2

```bash
# Three rules, three files — together:
Task: "Create Visibility in src/domain/youtube/Visibility.ts with its test"
Task: "Create VideoDetails in src/domain/youtube/VideoDetails.ts with its test"
Task: "Create UploadableVideo in src/domain/youtube/UploadableVideo.ts with its test"

# Then, once src/application/youtube-service.ts exists:
Task: "Implement the use case in src/application/publish-to-youtube.ts with its test"
Task: "Implement the adapter in src/infra/youtube.ts with its test"
Task: "Add web/public/youtube-client.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 — the words.
2. Phase 2 — the rules, the use case, the client (the checkpoint everything stands on).
3. Phase 3 — the way in: the menu, the dialog, the upload.
4. **STOP and validate**: `e2e/checks/youtube.spec.ts` green for US1, and the real session run
   by the user. That is a shippable feature: a clip reaches the person's channel.

### Incremental Delivery

1. Phases 1–3 → the MVP, deployed and demoed.
2. Phase 4 → the details, so the video says what the person meant it to.
3. Phase 5 → the destination's limits and honest failures.
4. Phase 6 → the agent's destination, and the final verification.

### Pull requests — the plan's steps, one change each

These task phases are the implementation *order*; the plan's steps are the *pull requests*, and
the project's rule is one change per pull request.

| Branch | Tasks | Step |
|---|---|---|
| `docs/youtube-words` | T001–T002 | 1 |
| `feat/youtube-domain` | T003–T005 | 2 |
| `feat/youtube-publish` | T006–T007 | 3 |
| `feat/youtube-client` | T008–T009 | 4 |
| `feat/youtube-ui` | T010–T021 (US1 + US2 + US3) | 5 |
| `feat/youtube-agent` | T022–T026 | 6 |
| `docs/youtube-final` | T027–T028 | 7 |

CI owns the version: no task bumps `package.json`, and step 6's `mcp/` change is stamped by
CI as it already is.

---

## Notes

- `[P]` marks different files with no dependency on an incomplete task.
- A rule in `src/domain/` is not done until its unit test beside it passes; anything drawn is
  not done until the `e2e/` check passes in a real browser (constitution III, IV).
- The two things only a real session can settle (`research.md` D3, D7) are T027's, and they
  are named there so a failure is a finding rather than a bug hunt.
- The clip is never re-encoded beyond the export (spec FR-010): the upload sends the MP4 the
  export writes, and nothing else.
