# Tasks: Configuration Profiles

**Input**: Design documents from `specs/009-config-profiles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/profile.md, quickstart.md

**Tests**: Included. The constitution (III, IV) requires a unit test for every rule in
`src/domain/` and a browser check for anything drawn — the toolbar icon, the menu, the
seeding and the refusal are proved in `e2e/`.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on
its own. The domain, the port and the use case are shared, so they are foundational; each
story then names only the files it touches.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1, US2, US3)

## Path Conventions

Single project: application code under `src/`, the shell under `web/`, end-to-end checks
under `e2e/`.

---

## Phase 1: Setup

**Purpose**: the words come first (constitution V).

- [x] T001 Write the new words into `GLOSSARY.md` before any code: a **profile** row (a named set of the app's configuration a person works under, kept outside any clip), an **active profile** row (the one profile the app is working under; exactly one at a time), and a **built-in default profile** row (the profile the app always has and falls back to; it cannot be removed).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared rule (`Profile`, `Profiles`), the store port and its adapter, the use case with the capture lock, the session's latch, and the one clip-property flag every story leans on.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

- [x] T002 [P] Create `Profile` in `src/domain/profile/Profile.ts`: `create(id, name, values?)` refusing an empty id or a name that is empty after trimming, `restore(stored)`, the `id`/`name`/`values` fields, `valueFor(id)` answering `null` for a setting it does not carry, `with(id, value)` (`''` clears), `renamed(name)` refusing an empty name, and `stored()` (data-model.md `Profile.id`, `Profile.name`, `Profile.values`).
- [x] T003 [P] Write `src/domain/profile/Profile.test.ts`: `create` refuses a blank name and an empty id; `valueFor` is `null` for an unset setting; `with(id, '')` clears to unset; `restore` folds `''` to unset and drops a non-string value; `renamed('')` is `null` (data-model.md `Profile.name`, `Profile.values`).
- [x] T004 [P] Create `Profiles` in `src/domain/profile/Profiles.ts`: `DEFAULT_ID`, `starting()`, `of(stored)` (repair untrusted state — drop an invalid entry, ensure the built-in default, move a dangling `activeId` to the default, `starting()` for an unusable record), `all`/`activeId`/`active()`/`get`/`has`, and the pure transitions `choose`/`add`/`rename`/`remove` that answer a new book or `null`, plus `stored()` (data-model.md `Profiles.all`, `Profiles.activeId`).
- [x] T005 [P] Write `src/domain/profile/Profiles.test.ts`: the built-in default is always in `all` and is never renamed or removed; `choose` of an unknown id is `null`; `add` of a taken id is `null`; removing the active profile leaves the default active; `of` repairs a dangling `activeId` and an empty-name entry, and gives `starting()` for garbage; every transition leaves the receiver unchanged (data-model.md `Profiles.activeId`, `Profiles.all`).
- [x] T006 [P] Create `src/application/ports/ProfileStorePort.ts`: `StoredProfile`, `StoredProfiles` (`version`, `activeId`, `profiles`) and the port `load(): Promise<StoredProfiles | null>` / `save(state): Promise<void>` — named without storage (data-model.md `StoredProfiles.version`; contracts/profile.md §3).
- [x] T007 [P] Add the capture latch to `Session` in `src/domain/session/Session.ts`: `hasCaptured` (false at construction), `beginCapture()` (idempotent), and `end()` clearing it alongside the clip (data-model.md `Session.hasCaptured`).
- [x] T008 [P] Extend `src/domain/session/Session.test.ts`: `hasCaptured` is false at start, true after `beginCapture()`, still true after a second call, and false again after `end()` (data-model.md `Session.hasCaptured`).
- [x] T009 [P] Add `seedable?: boolean` to `ClipProperty` in `src/ui/clip/clip-properties.ts`, set it on the `addToExport` descriptor only, and add `seedableClipProperties(): readonly ClipProperty[]` (data-model.md §6; contracts/profile.md §5).
- [x] T010 [P] Extend `src/ui/clip/clip-properties.test.ts`: `seedableClipProperties()` is exactly `addToExport`, and `title`, `description` and the read-only `size` are not in it (data-model.md §6).
- [x] T011 [P] Create the `localStorage` adapter in `src/infra/profile-store.ts` under one key (`democlip_profiles`), JSON, `try`/`catch` on both sides, `load` answering `null` for nothing kept / unusable JSON / another `version`; it holds no rules (contracts/profile.md §3).
- [x] T012 [P] Write `src/infra/profile-store.test.ts`: a stored shape survives a write/read round trip, `load` is `null` when nothing was written and when the record is unusable, and a write is kept across a fresh adapter (contracts/profile.md §3).
- [x] T013 Create `ManageProfiles` in `src/application/profiles.ts`: `load()` (read the store, `Profiles.of` or `starting()`, keep it as `current`), `current`, and `choose`/`create`/`rename`/`remove` returning a `Result`-shaped outcome with the capture lock — while `capturing()`: `choose` is refused, `create` does not move the active profile, and the **active** profile's `rename`/`remove` are refused; every success is saved through the port and a failed save is reported through `warn` (contracts/profile.md §4; data-model.md §4).
- [x] T014 Write `src/application/profiles.test.ts` with a fake `ProfileStorePort`: the lock refuses `choose`/`active rename`/`active remove` and leaves the book unchanged, `create` while capturing adds but does not switch, the same calls succeed when unlocked, removing the active profile falls back to the default, and a failing `save` is reported and does not undo the in-memory change (contracts/profile.md §4).

**Checkpoint**: the rule, the store and the use case are in place and proved in node; every story can start.

---

## Phase 3: User Story 1 — A new clip already carries the profile's settings (Priority: P1) 🎯 MVP

**Goal**: the active profile's **Add to export** is preloaded onto a clip as it starts, so a clip made under **DemoClipTV** opens its export with a title card without the setting being switched on.

**Independent Test**: put a profile with `addToExport` on into `localStorage` and set it active (the store record, no menu needed), load the app, seed a take, and open the clip's settings — **Add to export** is on without the person touching it; a profile carrying nothing leaves it off.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create `seedActiveProfile(clip, profiles)` in `src/ui/profile/seed.ts`: return at once when `clip.takes.isEmpty()` is false; otherwise walk `seedableClipProperties()`, read the active profile's `valueFor(property.id)`, skip a `null`, and apply through the property's own `with` then `clip.setProperty` (contracts/profile.md §5; data-model.md §5).
- [x] T016 [P] [US1] Write `src/ui/profile/seed.test.ts`: seeding an empty clip sets `addToExport` from the active profile; a clip with a take is left alone; a profile carrying nothing leaves the clip's value; a stored setting for a non-seedable property is never applied (contracts/profile.md §5).
- [x] T017 [US1] Load the profiles at startup and seed: in `src/main.ts`, compose `ManageProfiles` (`capturing` = `() => session.hasCaptured || !session.clip.takes.isEmpty()`, `newId` = `() => crypto.randomUUID()`), `await` its `load()`, then `seedActiveProfile(session.clip, profiles.current)` **before** `void resumeClip()` so a restored clip is never rewritten (research.md R5).
- [x] T018 [US1] Seed after a session ends: in `src/ui/lifecycle/new-session-flow.ts`, call `seedActiveProfile(session.clip, profiles.current)` after `session.end()`, so the fresh clip starts with the active profile's value (research.md R5; spec FR-003).
- [x] T019 [US1] Write `e2e/checks/profiles.spec.ts` (User Story 1 half): write a profiles record with `DemoClipTV`/`addToExport: 'true'` active into `localStorage`, `goto`, seed a take with the suite fixture, open `#props-btn`, and assert the **Add to export** toggle is on and that an export writes the title card; then set the active profile's setting off and confirm the next clip starts off (spec SC-004).

**Checkpoint**: User Story 1 is functional on its own — the profile reaches the clip, with no menu.

---

## Phase 4: User Story 2 — Choose a profile, or make a new one, from the toolbar (Priority: P2)

**Goal**: a profile icon at the right-most end of the toolbar opens the list, marks the active profile, chooses another, and creates a new one; choosing is refused once the session has begun to capture.

**Independent Test**: press the icon, create **DemoClipTV**, choose it; the row is marked active and a new clip carries its setting. With a take in the session, the other rows are disabled and the reason is shown.

### Implementation for User Story 2

- [x] T020 [P] [US2] Add the control to `web/index.html`: a `#profile-btn` (`class="icon-btn"`, inline SVG, `aria-haspopup="true"`, `aria-expanded="false"`) appended **last** in `.hdr-actions`, and a body-level `#profile-menu` (`role="menu"`) beside the other menus (contracts/profile.md §6; spec FR-005, SC-009).
- [x] T021 [P] [US2] Style the menu in `web/styles.css`: `.profile-menu` and its rows in the header's chip/menu family, the active row marked, a disabled row dimmed, and the reason line — following `.cam-menu`/`exp-menu` (contracts/profile.md §6).
- [x] T022 [P] [US2] Register the nodes in `src/ui/dom.ts`: `profileBtn` and `profileMenu` (contracts/profile.md §6).
- [x] T023 [P] [US2] Create the popover in `src/ui/profile/profile-menu.ts`, modelled on `camera-menu.ts`: `init(handlers)`, `toggle()`/`open()`/`close()`, placement under the button with a flip near the viewport's foot, close on outside click / Escape / resize, and a `render()` that rebuilds the rows from the book — one `role="menuitemradio"` row per profile with `aria-checked` on the active one, a **New profile…** row with a name input, and a reason line when a row is refused (contracts/profile.md §6).
- [x] T024 [P] [US2] Write `src/ui/profile/profile-menu.test.ts` over the DOM-free render helper: rows are built from the book in order, the active row is the only checked one, and while locked the non-active rows are disabled with the reason (contracts/profile.md §6).
- [x] T025 [US2] Create `src/ui/profile/profile-flow.ts`: hold the `ManageProfiles`, wire `el.profileBtn` to the menu, hand the menu `list`/`choose`/`create` callbacks that call the use case and re-render, seed the clip after a successful `choose`, and refresh the menu on the lock changing (a take starts, or the session ends) (research.md R5, R7, R8).
- [x] T026 [US2] Wire the flow in `src/main.ts`: initialise the menu, add the button's click listener, and refresh the menu when the session's lock changes, alongside the existing header controls (contracts/profile.md §6).
- [x] T027 [US2] Set the latch when a take really starts: call `session.beginCapture()` in `src/ui/recording/record-flow.ts`'s `startRecording` when the outcome is not `refused`, so a take begun and then discarded still locks the profile (research.md R4; spec FR-013).
- [x] T028 [US2] Add the User Story 2 half to `e2e/checks/profiles.spec.ts`: `#profile-btn` is visible and is the last control in `.hdr-actions`; the menu lists **Default** active; creating **DemoClipTV** and choosing it marks it; with a take in the session the other rows are disabled, the reason is shown, and the active profile is unchanged; a new clip started under it carries the setting (spec SC-002, SC-009, SC-010).

**Checkpoint**: User Stories 1 and 2 both work independently — the clip is seeded, and the person can choose and create profiles.

---

## Phase 5: User Story 3 — Profiles outlive the app and are the person's to keep (Priority: P3)

**Goal**: the person's profiles, and the active one, come back after a reload and a restart; they can be renamed and removed, the built-in default cannot, and removing the active one falls back.

**Independent Test**: create a profile with a setting, reload, and confirm it is there, active and whole; rename it, remove it while it is active, and confirm the app falls back to **Default** and stays usable; remove **Default** and confirm it is refused.

### Implementation for User Story 3

- [x] T029 [US3] Add rename and remove to the menu's own rows in `src/ui/profile/profile-menu.ts`: an **Rename…** action taking a new name and a **Remove** action per the person's own rows, neither on the built-in default row, and both refused on the active row while locked (research.md R8; spec FR-016, FR-017).
- [x] T030 [US3] Persist through the flow in `src/ui/profile/profile-flow.ts`: hand the menu the rename/remove callbacks, save every change through `ManageProfiles` (which already writes the port), re-seed only when a change happens while unlocked, and refresh the shown active profile after a remove (spec FR-011, FR-017).
- [x] T031 [US3] Add the User Story 3 half to `e2e/checks/profiles.spec.ts`: after a reload the profile and its setting are back and the same one is active; a rename is shown; removing the active profile leaves **Default** active and the app usable; the **Default** row offers no remove and removing it is refused; a fresh load with nothing kept shows **Default** active (spec SC-003, SC-006, SC-007).

**Checkpoint**: all three stories are functional and independent.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the documents and the whole-suite pass the change must leave behind.

- [x] T032 [P] Add one line to `FEATURES.md`: profiles, with the seeding, the toolbar icon and the session lock stated in the app's words.
- [x] T033 [P] Update the help panel's words in `web/index.html` (the record / export steps): the profile icon and what a profile carries.
- [x] T034 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e` and fix what they surface; walk `specs/009-config-profiles/quickstart.md` and confirm each expected outcome, reporting anything not verified.
- [x] T035 [P] Confirm no file outside the plan's list changed for this feature, and that the profiles are absent from the clip snapshot, the sidecar, an export and the automation surface (spec FR-019, FR-020).

---

## Phase 7: Rework — a profile fixes, it does not default (after the clarification)

**Purpose**: the user corrected the model after looking at the first cut (research.md R11): a
DemoClip profile is the app's configuration, not a user profile, so what it declares is applied
**and not the person's to change**; a profile that declares nothing is free; and its definition
is its own surface, never the selector. Every task below was done in the rework.

- [x] T036 Turn `Profile` from defaults into **declarations**: `controls` (a key present is a declaration), `declares`, `valueFor` returning `''` for a fixed-off item, and `declare`/`free` as two methods (data-model.md `Profile.controls`).
- [x] T037 Bump the stored shape to `version: 2` and read any other version as unusable, so the earlier `values` shape cannot be taken for this one (data-model.md `StoredProfiles.version`).
- [x] T038 Add `Profiles.controlling(id)` — the active profile when it declares an item — and `Profiles.declare(id, property, value | null)` (data-model.md §2).
- [x] T039 Add `Clip.applyProperty(id, value)`: announced, so every view follows, and deliberately **not** what the one undo takes back (data-model.md §6).
- [x] T040 Rename the seeding to `applyActiveProfile` in `src/ui/profile/apply.ts` and have a controlled value **win** over what the clip held, on an empty clip only (data-model.md §5).
- [x] T041 Add the `Controlling` seam in `src/ui/profile/control.ts`, and draw a controlled row in `src/ui/clip/properties-panel.ts` as a value plus the profile's name, with no control (contracts/profile.md §6).
- [x] T042 Refuse a controlled item in `src/ui/agent/edit.ts` naming the profile, and report it `readOnly` in `src/ui/agent/describe.ts` (contracts/profile.md §6).
- [x] T043 Take the configuration out of the selector and add the sliders mark that opens a profile's own sheet: `src/ui/profile/profile-menu.ts`, `src/ui/profile/profile-def.ts`, `web/index.html`, `web/styles.css` (contracts/profile.md §7).
- [x] T044 Replace `ManageProfiles.setSetting` with `declare(id, property, value | null)`, refusing the **active** profile while capturing and reporting a failed save (data-model.md §4).
- [x] T045 Rewrite the tests: `Profile.test.ts`, `Profiles.test.ts`, `profiles.test.ts`, `profile-store.test.ts`, `apply.test.ts`, `profile-menu.test.ts`, and a `Clip.applyProperty` block in `Clip.test.ts`.
- [x] T046 Rewrite `e2e/checks/profiles.spec.ts`: a controlled item applied and shown as fixed, an agent refused with the reason, a free item the person's, the sheet defining a profile, a switch fixed off, the refusal once capturing, and the reload and fallback.
- [x] T047 Correct the documents that describe the old direction: `spec.md`, `data-model.md`, `contracts/profile.md`, `research.md` R11, `GLOSSARY.md`, `FEATURES.md` and the help panel.

---

## Phase 8: A profile that needs a logo (the use case the feature is for)

**Purpose**: the second item a profile may control, and the one that proves the machinery over a
**value** rather than a switch: a name that may be empty, refused when the app does not serve it,
fixed by a profile, locked, and **drawn** into the encoded file.

- [x] T048 Ship the app's own marks: `web/public/logos/democlip.png`, and the list that names them (`src/ui/logos.ts`, `logoFile`), with a node test.
- [x] T049 Register the **logo** clip property in `src/ui/clip/clip-properties.ts`: a value, `seedable`, refusing a name the app does not serve, `''` for none (data-model.md §2b, §7).
- [x] T050 Carry the logo on the card: `IntroCard.logo`, and `introFor` asking for a card for **add to export** *or* a logo (data-model.md §2b).
- [x] T051 Put it through to the encoder: `IntroFrame.logo` in `src/application/ports/EncoderPort.ts` and `src/infra/offline-encoder.ts`.
- [x] T052 Draw it: the box above the card's words (`LOGO_BOX`, `LOGO_SPACE` in `intro-text.ts`, and `introText`'s `top`), the fitted mark with a dark shadow, and `FrameRenderer.prepare` decoding it before the first frame (`src/ui/exporting/{frame-renderer,logo-image}.ts`).
- [x] T053 Load it before encoding in all three paths that write a file: `export-flow.ts`, `publish-flow.ts`, `youtube-flow.ts`.
- [x] T054 Give the panel's rows their `data-id`, so a check can point at one property's row now that there is more than one field.
- [x] T055 Tests: `logos.test.ts`, the logo rules in `clip-properties.test.ts`, the card in `IntroCard.test.ts` and `intro.test.ts`, and the surface's property list.
- [x] T056 The browser check, `e2e/checks/profile-logo.spec.ts`: the mark in the file (pixels counted, with the picture there in both runs), the value naming the profile with no field, the sheet defining it, and a name the app does not serve refused.
- [x] T058 Make the logo a **list** rather than a field: `ClipPropertyControl` gains `choice` and a property declares its own `choices` (`src/ui/clip/clip-properties.ts`), the panel draws a `select` from them and shows a choice by its label, a profile's sheet draws the same list with **Not fixed** above it, and the automation surface is told the choices too.
- [x] T057 Correct the documents for the new item: `spec.md` (US4, FR-024–FR-027, SC-014), `GLOSSARY.md`, `FEATURES.md`, the help panel, `data-model.md`, `contracts/profile.md` and `research.md` R12.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. **Blocks every story.**
- **User Stories (Phase 3+)**: after Foundational. Each can then proceed on its own.
- **Polish (Phase 6)**: after the stories wanted are done.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependence on US2 or US3 — its check writes the store record itself.
- **US2 (P2)**: after Foundational. Needs the use case (T013) and the seed (T015) for its "a new clip carries the setting" scenario, so it is cleanest after US1, but its own toolbar half stands alone.
- **US3 (P3)**: after Foundational, and it adds rows to the menu from US2 (`profile-menu.ts`, `profile-flow.ts`), so it follows US2.

### Within Each Story

- T002–T012 (foundational models, port, latch, flag, adapter) run in parallel; T013 (`ManageProfiles`) needs T002/T004/T006; T014 needs T013.
- A rule and its test ship together (constitution III).
- The view (`seed.ts`, the menu, the flow) after the rule and the use case it calls.
- The `e2e` check last in each story, once the pieces it drives exist.

### Parallel Opportunities

- Foundational: T002–T012 are seven independent files — all `[P]`.
- US1: T015 and T016 (the seed and its test) are `[P]`; T017 and T018 touch different files and can pair.
- US2: T020–T024 are five different files — all `[P]`; T025–T027 are sequential.
- US3: T032 and T033 are `[P]` (different documents).

## Parallel Example: Foundational (Phase 2)

```text
Task: "Create Profile in src/domain/profile/Profile.ts"                 (T002)
Task: "Create Profiles in src/domain/profile/Profiles.ts"               (T004)
Task: "Create ProfileStorePort in src/application/ports/ProfileStorePort.ts" (T006)
Task: "Add the capture latch to Session in src/domain/session/Session.ts"    (T007)
Task: "Add the seedable flag in src/ui/clip/clip-properties.ts"         (T009)
Task: "Create the localStorage adapter in src/infra/profile-store.ts"   (T011)
```

## Parallel Example: User Story 2 (Phase 4)

```text
Task: "Add #profile-btn and #profile-menu to web/index.html"            (T020)
Task: "Style the menu in web/styles.css"                                (T021)
Task: "Register profileBtn/profileMenu in src/ui/dom.ts"                 (T022)
Task: "Create the popover in src/ui/profile/profile-menu.ts"             (T023)
Task: "Write src/ui/profile/profile-menu.test.ts"                        (T024)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (the words) and Phase 2 (the rule, the store, the use case).
2. Phase 3 — the seed and its wiring.
3. **STOP and VALIDATE**: a stored profile's **Add to export** reaches a new clip and its
   export, with no menu at all. This is the whole point of the feature.

### Incremental Delivery

1. Setup + Foundational → the rule and the store are proved in node.
2. US1 → the profile reaches the clip (MVP).
3. US2 → the toolbar icon, the menu and the session lock.
4. US3 → the profiles outlive the reload, and the person can tidy them.
5. Polish → the documents and the whole suite.

### Notes

- `[P]` marks a different file with no incomplete dependency.
- Every rule task ships its test in the same change (constitution III); the browser check
  covers what is drawn (constitution IV).
- Commit after each task or logical group; one change per pull request (constitution VI).
- Stop at any checkpoint to validate a story on its own.
