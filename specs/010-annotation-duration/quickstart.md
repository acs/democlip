# Quickstart — proving the annotate options, the duration and the stretch

How to check the change end-to-end, and what each check is worth. The rules are in
`data-model.md`; the seams are in `contracts/annotation-duration.md`; the sequence is in
`plan.md`.

## Prerequisites

```bash
npm install
```

## 1. The rules — unit tests, in node

```bash
npx vitest run src/domain/annotation     # withDuration and the constants
npx vitest run src/ui/annotating         # the duration descriptor, propertiesFor, propertiesOf
npx vitest run src/domain/clip           # the aggregate: annotations, one undo, cuts
```

**What must pass**

- `Annotation.withDuration(seconds, total)`:
  - keeps the start fraction and the kind's colour, geometry, words and id;
  - clamps the end inside the clip: a value that would run past `1` ends at `1`;
  - answers `null` below `MIN_ANNOTATION_S` and when `total <= 0`;
  - answers an annotation the kind can still draw and hit (it delegated to `withSpan`);
  - holds for each kind — `Arrow`, `ImageAnnotation`, `TextAnnotation`;
- `DEFAULT_ANNOTATION_S` is 2 and `MIN_ANNOTATION_S` is 0.1;
- `durationProperty(clip).value(annotation)` reads the seconds, and `.with` applies
  `withDuration` — `null` for an unparsable value or one the rule refuses;
- `propertiesFor(annotation, clip)` is the kind's own properties plus the duration, and
  **omits the duration for the clip's watermark** (`clip.watermarks()`);
- `propertiesOf(annotation)` is **unchanged** — the kind's properties alone — so its tests
  and the existing `annotation-plugin` tests pass **unmodified**. If one had to change, the
  behaviour changed and that is decided deliberately and said out loud.

**What this does not prove**: the column, the seconds control, the timeline band and what a
person sees — those are the suite's, below.

## 2. What a person sees — the committed `e2e/` suite

The throwaway `verify-*.html` harness is retired: the browser proof is a committed check in
`e2e/checks/`, run in real Chromium. Build the state with the shared helpers
(`boot(page)`, `app.seed(await makeTakes(page, …))`, `app.review()`), never by recording.

The kind is now placed from the column, so the existing check's selectors change; update
`e2e/checks/annotations.spec.ts` deliberately and say so, and fold the new story into the
files that already own the area:

| File | What it proves |
|---|---|
| `e2e/checks/annotations.spec.ts` | The column (`#annotate-bar`) shows one row per kind in review and is absent outside it; a kind pressed **with a stretch selected** places over that stretch, and **with none** places at the playhead with `DEFAULT_ANNOTATION_S`; the timeline section no longer carries kind buttons; the picked annotation's stretch is drawn on the lane as the active band, beside a selected cut section, and a cut closes it up (FR-001 to FR-003, FR-007, FR-015 to FR-020). |
| `e2e/checks/properties.spec.ts` | The image — which declared no properties — now draws a settings control; the duration row shows a seconds value; stepping it changes the annotation in playback and in the export; the one undo reverts it; a value below the minimum is refused with a message (FR-011 to FR-014, SC-003 to SC-005). |

Fold to **one or two checks**; a second only where the story is genuinely independent (the
refusal beside the success, the timeline band beside the placement).

Assert **what a person would see** — the row's visibility, the row count, the seconds text,
the class on the active band — and reach for the model only where the view shows nothing
(the annotation's own span, read through `e2e/support/app-hooks.ts`).

```bash
npm run test:e2e
# or one check:
npx playwright test --config e2e/playwright.config.ts e2e/checks/annotations.spec.ts
```

**What this does not prove**: the exact encoded pixels — the check asserts the length the
renderer was given and what a person sees, not the file's bytes.

## 3. The reload, in the running app

In the running app: place an annotation, change its duration, then reload the page and
confirm it comes back the same length. This is the one check that needs the real IndexedDB
path (the clip store's small half carries the span).

## 4. What cannot be checked here

- **The recorder's flow** (a real screen share) — untouched by this change; the user runs it.
- **The exported file's exact frames** — the check asserts the renderer ran over the new
  length on the export canvas, not the encoded result.
- **A real reload with a real recording** — the suite builds its clip by hand; the reload is
  the user's to run (section 3).

## Reporting

In the pull request: the unit-test output, the `e2e/` check result (and, where a check was
updated for the moved control, say so and why), and the words of the Verification skill —
which level each part got, and what was not verified and why. Where an existing test
changed, name it and say why.
