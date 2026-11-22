# Implementation Plan: Configuration Profiles

**Branch**: `feat/config-profiles` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-config-profiles/spec.md`

## Summary

A **profile** is a named set of DemoClip configuration the person works under —
**DemoClipTV**, **GraditoneTV** — kept outside any clip so it outlives the page and the
session. Exactly one is **active**; the app ships a **built-in default** that is always
present, and the person may create, rename, remove and choose among their own.

In this iteration a profile carries one setting: the clip property **Add to export**. The
active profile **preloads** that value onto a clip as it starts, so a clip under
DemoClipTV opens its export with a title card without the setting being switched on. The
clip keeps its own value; changing it never changes the profile.

A pill sits at the right-most end of the toolbar, wearing the active profile's first
letters. It opens the list of profiles, with
the active one marked, and from the same place a new one is created. The choice belongs
to the session: the profile may be switched freely until the session **begins to
capture**, and from that moment it is fixed until the session ends — a refusal that is
said plainly rather than ignored.

The rule lives in the domain (`Profile`, `Profiles`); persistence is a port with a
`localStorage` adapter; the seeding, the menu and the lock live in the view, driven by
the session's own capture state.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules)

**Primary Dependencies**: none new. Vite for the build; Vitest (unit) and Playwright
(end-to-end) as today

**Storage**: `localStorage` (a small JSON record) for the profiles. The clip's own store
(IndexedDB) is untouched: a profile is app configuration, not clip state

**Testing**: Vitest in node for every rule in `src/domain/` and the use case; Playwright
in `e2e/` for what is drawn — the toolbar pill, the panel, the seeding, the refusal and
the reload

**Target Platform**: the browser (Chrome 94+, Firefox 130+), as the app is today

**Project Type**: single-project browser app (`src/` four layers + `web/` shell)

**Performance Goals**: opening the menu and switching a profile are immediate; loading
the profiles is one small `localStorage` read at startup and must not delay first paint

**Constraints**: `src/domain/` stays pure (no DOM, no `ui/`/`infra/` import); the view
listens to the clip and the session rather than the model calling into the view; the word
**profile** is written into `GLOSSARY.md` before the code

**Scale/Scope**: a handful of profiles per person; one setting carried now, the seam built
to carry more later without losing existing profiles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model`
  (a rule is a class; the view listens), `overview` (which document owns which fact) and
  `verification` (unit test for a rule, browser check for what is drawn). Pass.
- **II. `src/domain/` is pure** — `Profile` and `Profiles` are classes in
  `src/domain/profile/` with no DOM and no `ui/`/`infra/` import; persistence is a port
  (`ProfileStorePort`) an adapter implements. The session's capture latch is state on
  `Session`, which already owns the clip. Pass.
- **III. Every rule has a test beside it** — `Profile.test.ts`, `Profiles.test.ts`,
  `Session.test.ts` (the latch) and `application/profiles.test.ts` (the lock, the
  fallback, the store failure), each with a fake behind the port. Pass.
- **IV. What is drawn, played or encoded is proved in a browser** — an `e2e/checks/`
  spec drives the real app: the pill at the right-most position of the toolbar, the panel,
  a profile created and chosen, a clip seeded, the refusal once capture has begun, and the
  profiles coming back after a reload. Pass.
- **V. The words come first** — `GLOSSARY.md` gains **profile**, **active profile** and
  **built-in default profile** before the code, and the code, tests, commits and the pull
  request use them. Pass.
- **VI. One change per pull request, and CI owns the version** — one change on its own
  branch; `package.json` is not touched. Pass.

No violations, so Complexity Tracking is empty.

**Post-design re-check (after Phase 1)**: the design kept every gate. The rules stayed in
`src/domain/` and `src/application/`; the only browser boundary added is the rule-free
`localStorage` adapter behind `ProfileStorePort`; the seeding and the menu are the view's,
and they ask the domain rather than the reverse. The one spec edit the design forced
(FR-020, the agent surface) was made in the spec, so the plan and the spec agree. Still
Pass.

## Project Structure

### Documentation (this feature)

```text
specs/009-config-profiles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── profile.md       # Phase 1 output — Profile/Profiles, the store port, the seeding seam, the menu
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── profile/
│   │   ├── Profile.ts            # new: a named set of settings; name rule; valueFor/with
│   │   ├── Profile.test.ts       # new
│   │   ├── Profiles.ts           # new: the book — one active, the built-in default, choose/add/rename/remove
│   │   └── Profiles.test.ts      # new
│   └── session/
│       ├── Session.ts            # the capture latch: hasCaptured, beginCapture(), end() clears it
│       └── Session.test.ts       # the latch, and that end() clears it
├── application/
│   ├── profiles.ts               # new: ManageProfiles — load, choose, create, rename, remove; the capture lock
│   ├── profiles.test.ts          # new
│   └── ports/
│       └── ProfileStorePort.ts   # new: load()/save() named without localStorage
├── infra/
│   ├── profile-store.ts          # new: the localStorage adapter (rule-free)
│   └── profile-store.test.ts     # new (the stored shape survives a round trip)
├── ui/
│   ├── dom.ts                    # profileBtn, profileMenu
│   ├── profile/
│   │   ├── profile-menu.ts       # new: the toolbar popover — list, choose, create, define, rename, remove
│   │   ├── profile-menu.test.ts  # new (the selector's and the config sheet's row models)
│   │   ├── profile-def.ts        # new: a profile's own sheet — what it controls
│   │   ├── profile-rows.ts       # new: the DOM-free row models both surfaces draw from
│   │   ├── control.ts            # new: the Controlling seam the panel and the surface share
│   │   ├── apply.ts              # new: fix what the active profile declares onto an empty clip
│   │   ├── apply.test.ts         # new
│   │   └── profile-flow.ts       # new: composition — service + surfaces + applying, wired by main
│   ├── clip/clip-properties.ts   # one flag: which items a profile may control (`addToExport`)
│   ├── clip/properties-panel.ts  # a controlled item: its value, the profile's name, no control
│   ├── recording/record-flow.ts  # session.beginCapture() when a take actually starts
│   └── lifecycle/new-session-flow.ts  # seed the fresh clip after session.end()
├── main.ts                       # load the profiles, seed at startup, wire the button and the menu
web/
├── index.html                    # the #profile-btn pill at the right-most end of the header, #profile-menu
├── styles.css                    # the menu, in the header chip/menu family
GLOSSARY.md                       # profile, active profile, built-in default profile — written first
FEATURES.md                       # one line: profiles
```

**Structure Decision**: single project, the four layers as they are. The **rules** — what
a profile is, that the built-in default cannot go, that removing the active one falls
back, that the active profile cannot change once a session has begun to capture — live in
`src/domain/` and `src/application/`. Persistence is `src/infra/profile-store.ts` behind
`ProfileStorePort`. Everything drawn — the pill, the panel, the seeding — is in
`src/ui/profile/`. Nothing in `domain/` or `application/` imports the view or a browser.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.
