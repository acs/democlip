# Implementation Plan: Magnifier Annotation

**Branch**: `focus-annotation` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-magnifier-annotation/spec.md`

## Summary

The annotation family gains a fifth kind: a **magnifier** — a resizable circular **lens** over a
region of the picture that shows its own centre **enlarged**, while a **spotlight dim** darkens
the rest of the picture for the stretch of the annotation. It is added in the one place every
kind is added, found on the **annotation lane**, edited by the shared canvas and the one
**properties inspector**, kept with the clip, cut and exported with everything else, and never
changes the recording. The choices from the clarification shape it: the lens is **in the circle
itself**, the rest of the picture is **dimmed**, and the zoom is **adjustable, default 2×**.

The kind is a class in `src/domain/annotation/` (its centre, radius, zoom and rim colour are
numbers in fractions of the picture, proved in node) and a plugin in `src/ui/annotating/` (its
action, its creation by a drag from the detail outward, and its look). The drawing is the one
piece that needs a seam the family does not have yet: a renderer that **reads the picture
beneath it**. The layer offers **one picture copy for the frame** and a **draw order** that puts
picture-reading renderers first; the review, the editing canvas and the export take the copy
**before drawing any annotation**, so the lens magnifies the picture alone and the app's other
annotations are neither magnified nor dimmed and stay readable. The same layer paints the review
and the offline export, so the file matches what was seen by construction.

The rest is existing machinery: registration in the two registers; the shared canvas for pick,
move, resize, copy, paste, delete and undo; the lane; the duration property; the snapshot and the
sidecar; and the automation surface, which gains the annotation's geometry as data and a maker
from numbers. The work ships as a sequence of pull requests, each leaving the app working: the
words first, then the kind, then the picture pass, then the kind on the picture, then the agent's
path, and the docs last.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: no new dependency. Vite ^8.3.8, Vitest ^5.1.0 (node tests), Playwright
(the end-to-end suite) and the browser's own **Canvas 2D** — `drawImage`, `clip`, the even-odd
fill and the transform the layer already uses. A lens is drawn from a canvas copy of the picture;
there is no image library, no WebGL and no second renderer.

**Storage**: IndexedDB (the clip store, `src/infra/clip-store.ts`). **No schema change and no
migration**: a magnifier is an ordinary `StoredAnnotation` — an id, a kind (`"magnifier"`), a span
and a geometry of numbers (`{ x, y, radius, zoom, colour }`). The store, the snapshot and the
sidecar write every annotation generically. There are no bytes to keep: the lens reads the
picture already on the canvas, so the image store is untouched and `PROFILES_FORMAT` is untouched
(a magnifier is not a clip property and no profile controls it).

**Testing**: Vitest in node for the kind (`Magnifier`, `kinds`), the picture pass
(`annotation-layer`: `needsPicture`, the draw order, and the picture handed to the reader), the
number property and the plugin's descriptors (`annotation-plugin`), and the automation surface
(`describe`, `edit`, MCP `tools`); one committed check in `e2e/checks/annotations.spec.ts` that
places a magnifier the way a person does, reads the preview's pixels, exports the clip and reads
the file back to prove the lens and the dim are in it; and one in `e2e/checks/agent.spec.ts` that
places one through the automation surface, reads its region and zoom, changes the zoom and takes
it away. What the effect *looks* like is the browser check's business; no checks need the share
picker, which is untouched.

**Target Platform**: unchanged — the browser, Chrome 94+/Firefox 130+. The APIs the lens needs
(`drawImage` from a canvas, `clip`, even-odd fill) are already on the app's drawing path; no new
browser target is added.

**Project Type**: single-project browser app — `src/` in four layers, `web/` the shell and the
app's served files, `mcp/` the agent server.

**Performance Goals**: the export stays faster than real time (about 10× the clip). A magnifier
costs **one canvas copy per rendered frame** while one is on screen, plus one clipped `drawImage`
per magnifier; nothing is decoded, seeked or re-encoded. With a handful of annotations the copy
is the only new cost, and SC-005 holds playback within one frame per second of the same clip
without one. A clip with no magnifier pays nothing: the copy happens only when a shown renderer
says it reads the picture.

**Constraints**:
- `src/domain/` stays pure: `Magnifier` is a span, a centre, a radius, a zoom and a colour — no
  canvas, no `drawImage`, no import from `ui/` or `infra/`. The look and the picture copy are the
  view's.
- The magnifier is a kind under the plugin seam: a class, a line in `kinds.ts`, and a plugin with
  a line in `plugins.ts`. It gets picking, moving, resizing, copying, deleting, undoing, saving,
  the lane and the sidecar from the family.
- The picture-reading capability is **generic**, not a magnifier special case: a renderer may say
  it reads the picture, and a small helper says whether the shown set needs a copy; the layer
  orders the readers first and names no kind. The copy itself is a DOM helper, kept beside the
  layer so the drawing function stays testable in node.
- The app's annotations are neither magnified nor dimmed: picture-reading kinds are drawn first,
  from a copy of the picture taken before any annotation; the rest draw over them at full
  strength. The canvas picks and grabs in that same effective order, so what is picked is what is
  on top.
- A lens is **round at any picture shape** and wholly inside the picture. Geometry is the centre
  and a radius as a fraction of the picture's **shorter side**, so no stored aspect can go stale;
  a handle asks for the picture to sit on the rim, and a drag past the edge is capped.
- The recording is never touched: the takes are not re-encoded, and with every annotation removed
  the clip is exactly the recording.
- The words come first: `docs/GLOSSARY.md` gains **magnifier**, **lens**, **magnified region**,
  **zoom level**, **rim** and **spotlight dim** before the code, in this change.
- Everything stays local and offline; no network, no server, no upload.
- One change per pull request; CI owns the version; `package.json` is untouched.

**Scale/Scope**: a clip of a handful of takes, minutes long, in one browser tab, with a handful
of annotations. The layer's per-frame work is linear in the shown annotations plus one copy;
the magnifier's own draw is a clip and one `drawImage`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model` (a rule
  is a class in `src/domain/`; a kind is a class plus a plugin; the view listens), `.agents/skills/verification`
  (a unit test per rule; a committed browser check for what is drawn and encoded; the real
  session's gap stated) and `.agents/skills/project-workflow` (one change per pull request from
  the remote `main`). **Pass.**
- **II. `src/domain/` is pure** — `Magnifier` holds numbers only: the centre and radius as
  fractions, the zoom, the rim colour. The picture copy, the dim, the rim, the sampling and the
  drawing are in `src/ui/`. **Pass.**
- **III. Every rule has a test beside it** — `Magnifier.test.ts` (clamping, the round rim on a
  non-square picture, the smallest lens, the zoom range, move, resize, duplicate, hit, the stored
  round-trip), `kinds.test.ts` (the kind restores), `annotation-layer.test.ts` (`needsPicture`,
  the picture-reading order, the picture handed to the reader), the plugin/property tests (the
  action, the colour and zoom descriptors, the number control), `surface.test.ts` (the geometry
  is reported) and `tools.test.ts` (the kind is offered to an agent). **Pass.**
- **IV. What is drawn, played or encoded is proved in a browser** — the committed
  `annotations.spec.ts` check places a magnifier through the real canvas, reads the preview's
  pixels for the enlarged centre and the darker surround, exports with and without it and reads
  the file's frames back; the `agent.spec.ts` check places, reads and edits one through the
  automation surface. The real session's share picker is untouched, and the effect is visible in
  the check, so there is no new session gap. **Pass.**
- **V. The words come first** — `docs/GLOSSARY.md` gains **magnifier**, **lens**, **magnified
  region**, **zoom level**, **rim** and **spotlight dim**, and the "Annotating" section's prose,
  before the code uses the words. **Pass.**
- **VI. One change per pull request, and CI owns the version** — the plan is a sequence of six
  steps, each its own branch and pull request, each leaving the app working. `package.json` is
  not touched. **Pass.**

No violations, so Complexity Tracking is empty.

**Post-design re-check (Phase 1)**: every rule is in `src/domain/annotation/Magnifier.ts`; the
picture pass, the lens, the dim and the rim are in `src/ui/annotating/`; every rule has a test
named in `data-model.md`; the browser checks and the untouched share picker are stated; the new
words enter `GLOSSARY.md` first. The design adds **no new dependency, layer, port or project**:
the kind reuses the shared canvas, the lane, the inspector, the duration property, the snapshot,
the sidecar, the store and the automation surface, and the only seam it adds is the generic
"renderer reads the picture" capability on the layer that already exists. The check still passes
with no violations.

## Project Structure

### Documentation (this feature)

```text
specs/015-magnifier-annotation/
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
├── contracts/
│   └── magnifier-annotation.md # Phase 1 output — the kind, the picture, the file, the agent
├── checklists/
│   └── requirements.md         # Specification quality checklist
└── spec.md                     # Feature specification
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── annotation/
│       ├── Magnifier.ts              # NEW: the fifth kind — centre, radius, zoom, rim colour
│       ├── Magnifier.test.ts         # NEW: clamping, round rim, zoom range, move/resize, restore
│       ├── Annotation.ts             # PictureSize; handles(picture?) and HandleOptions.picture
│       └── kinds.ts                  # registers Magnifier (a line)
├── ui/
│   ├── annotating/
│   │   ├── annotation-layer.ts       # readsPicture, needsPicture, pictureFor/copyPicture, drawOrder, the picture arg
│   │   ├── annotation-layer.test.ts  # needsPicture, the order, the picture handed to the reader
│   │   ├── magnifier-plugin.ts       # NEW: the kind in the view — action, creation, lens, rim, dim
│   │   ├── annotation-plugin.ts      # PropertyControl 'number'; min/max/step/suffix on a property
│   │   ├── properties-inspector.ts   # the number row; the picture for handle placement
│   │   ├── annotation-canvas.ts      # drawOrder for hit/grip; the picture to withHandle and the draft
│   │   ├── plugins.ts                # a line for the magnifier
│   │   └── annotation-lane.ts        # no change — the kind's mark and band are generic
│   ├── agent/
│   │   ├── make.ts                   # makeMagnifier — a region and a zoom from numbers
│   │   ├── describe.ts               # the annotation's geometry, as data, with the rest
│   │   └── surface.ts                # AnnotationSummary gains geometry
│   └── shell/
│       └── help-steps.html           # the quick reference gains the kind
├── main.ts                           # no change — `plugins.ts` is already imported
docs/
├── GLOSSARY.md                       # magnifier, lens, magnified region, zoom level, rim, spotlight dim
├── FEATURES.md                       # the magnifier row
└── FILES.md                          # the new modules in the map
web/
└── help.html                         # the complete guide gains the kind
mcp/src/
├── tools.ts                          # annotate gains kind "magnifier" and its numbers
└── tools.test.ts                     # the enum and the schema
e2e/
├── checks/
│   ├── annotations.spec.ts           # the magnifier check; the kind-row count 4 → 5
│   └── agent.spec.ts                 # the agent's magnifier check
└── helpers/
    └── exports.ts                    # a band's mean luma, for the spotlight
```

**Structure Decision**: single project, the existing four layers. The **rules** — a lens's shape,
where it may sit, the smallest one, the zoom range, how it moves, resizes, is duplicated, hit and
read back — live in `src/domain/annotation/Magnifier.ts`, pure and node-tested. The **look** —
the picture copy, the magnified sampling, the rim, the dim and the dissolve — lives in the view
beside the kind's plugin, because `src/domain/` may not touch a canvas. The **picture the lens
reads** is the canvas the frame was just drawn on in both the review and the export, which is why
one generic "the renderer reads the picture" property on the layer covers both without a new
port: the review's loop, the editing canvas and the offline encoder already draw through the same
`drawAnnotations`. The **number control** is a generic property control, so the inspector still
names no kind; the **geometry** reported to an agent is the annotation's own data, not a new
surface. The kind is one class, one register line, one plugin and one line in `plugins.ts`; the
family's other behaviour arrives by existing.

## Implementation Sequence

Each step is its own branch from the remote `main` and its own pull request, and leaves the app
working and its tests green. The order puts the words and the kind first (so the rules are proved
before anything is drawn), then the view seam, then the kind on the picture, then the agent's
path, and the docs last.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add **magnifier**, **lens**, **magnified region**, **zoom level**, **rim** and **spotlight dim** to `docs/GLOSSARY.md`, the "Annotating" prose; add the row to `FEATURES.md`, the quick reference and the complete guide; name the new modules in `FILES.md`. No code. | Docs review; the glossary is the only source of the words. | `docs/magnifier-words` |
| 2 | **The kind, and the handle seam.** `src/domain/annotation/Magnifier.ts` (its constants, `create`/`restore`, `isUsable`, `handles(picture)`, `withHandle`, `movedBy`, `withZoom`, `withColour`, `withSpan`, `duplicated`, `hitTest`, `stored`), registered in `kinds.ts`; `Annotation` gains the optional `PictureSize` and `HandleOptions.picture`. Nothing draws or creates one yet. | Unit tests beside the file — clamping inside the picture, a round rim on a non-square picture, the smallest lens refused, the zoom range, move/resize/duplicate/hit, the stored round-trip; `kinds.test.ts` restores one; every existing kind and cut test **unmodified**. | `feat/magnifier-kind` |
| 3 | **The picture pass.** `annotation-layer.ts` gains `readsPicture` on a renderer, `needsPicture` (does the shown set, or the draft, need a picture?), the one **copy** of the canvas as a small DOM helper (`pictureFor`/`copyPicture`), `drawOrder` (picture-reading first, the rest in the family's stable order), and the picture handed to a renderer. The playback loop, the canvas and the frame renderer take the copy **before** drawing any annotation; the canvas draws the draft with the same picture and picks and grabs in `drawOrder`; `withHandle` gets the picture. | `annotation-layer.test.ts` — `needsPicture` is true only for a reader, the order puts readers first, the picture handed to the reader is the one passed, and no drawing function touches the DOM; the existing layer and canvas tests **unmodified**. The copy itself is the browser check's. | `feat/magnifier-picture-pass` |
| 4 | **The magnifier on the picture.** `magnifier-plugin.ts` — the **Magnifier** row, the drag from the detail outward, the lens (central 1/zoom, round, wholly inside), the rim in the clip's annotation colour with a dark edge, and the one-level spotlight dim; its properties (colour, zoom) and the shared duration. The inspector gains the **number** control with min/max/step/suffix and places the panel beside the circle; `plugins.ts` wires it. The end-to-end row count becomes five, and the committed check places, reads, exports and reads back. | The plugin/property and inspector tests; the committed `annotations.spec.ts` check — five rows, a drag, a lane mark, the preview's enlarged white frame number and darker surround, the same in an exported file, nothing outside the stretch; the existing annotations checks change only for the row count. | `feat/magnifier-plugin` |
| 5 | **The agent's path.** `make.ts` grows `makeMagnifier` (centre, radius, zoom — data alone); `describe.ts` reports each annotation's **geometry**; `surface.ts`'s summary carries it; MCP `annotate` gains `kind: "magnifier"` with `x`, `y`, `radius`, `zoom`, and its descriptions name them. | `surface.test.ts` reports the geometry; the maker and `setProperty` tests; `tools.test.ts`'s enum; the committed `agent.spec.ts` check places, reads, zooms, removes and undoes one. | `feat/magnifier-agent` |
| 6 | **Docs and final verification.** Correct the guide where the built kind differs; the full unit suite, the build, the end-to-end run; the pull requests carry the three levels and the stated gaps. | `npm run lint && npm run typecheck && npx vitest run && npm run build`, then `npm run test:e2e`; the checks and evidence in the pull request. | `docs/magnifier-final` |

## Risks and what is deliberately not checked

- **A full-frame copy while a lens shows** is the one new per-frame cost. It happens only when a
  picture-reading renderer is shown, and the copy is a canvas of the same size; no decode, no
  seek and no re-encode is added. SC-005 is a design goal, not a headless number: a headless
  browser's frame rate is not the person's machine, so smoothness is stated as felt in a real
  session rather than claimed by the suite.
- **The lens is a taste call.** The browser check proves the detail is enlarged and the surround
  darker, and that the file matches; whether 55% dim and a 2× lens read well on a particular
  recording is a person's judgement, stated in the quickstart rather than hidden.
- **A clip whose picture changes shape** after a magnifier is placed is handled by construction:
  the radius is a fraction of the shorter side and the handles ask for the current picture, so
  the lens stays round and inside, and grows with the picture's scale (the shorter side the takes
  are fitted at), as the spec means.
- **The recorder's flow is untouched** — no share picker is opened by the feature, so the
  existing "a real session is the person's" gap is unchanged and no new one is added.
- **The title card, the watermark, the sound and the profiles** are untouched: a magnifier is an
  ordinary annotation, not a clip property, and the card draws only its own words and logo.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.