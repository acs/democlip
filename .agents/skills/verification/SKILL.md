---
name: Verification
description: How to prove a change works in DemoClip — unit tests in node, a committed check in the end-to-end suite that drives the real app in a browser, and what must be said about what was not verified. Use before claiming any change works, and when reviewing one.
---

# Verification

A passing build proves the types line up and nothing more. Do not describe a change
as working because `npm run lint`, `npm run typecheck` and `npm run build` passed.

## Three levels, and which one a change needs

| the change touches | it is proved by |
|---|---|
| a rule in `src/domain/` | a **unit test**, in node, next to the file |
| anything drawn, played, encoded or wired to the DOM | a **committed check** in the end-to-end suite (`e2e/`), run in a real browser |
| the recorder's flow (screen share, a take arriving) | a **real session**, by the user — no check can open the share picker |

Say which level a change got, in the pull request, in those words.

The recorder's row is not a gap to be closed later: `getDisplayMedia` needs a user
gesture and a browser picker, so **no check can open a share**. The suite covers
everything *after* a share is handed back, and the webcam and mic on stand-in
devices; keep changes to the picker itself small, and ask the user to run a real
session.

## A regression fix is proved by the check that fails before it

When the change fixes something that used to work, run the check against the old code
and the new: the same check must **fail before and pass after**, and both results go
in the pull request. A suite that is green after the fix says nothing about the bug it
fixed.

The pull request also carries a **post-mortem** — what introduced the regression, and
why it was not caught — which the project workflow skill lays out.

## Unit tests

- Every rule in `domain/` has one. A rule without a test is a rule that will drift.
- **A refactor's proof is the old tests passing unmodified.** If they had to change,
  the behaviour changed — decide that deliberately and say so.
- Collaborators sit behind ports so they can be faked: `Clip.test.ts` runs against
  `FakeTakes` with no browser at all.
- `npx vitest run`, or one file while iterating: `npx vitest run src/domain/clip/Clip.test.ts`

## The end-to-end suite

The suite lives in `e2e/` and drives the real page (`web/index.html`) in a headless
Chromium. It is the committed replacement for the old throwaway `verify-*.html`
harness, which is retired: a check written once and kept guards the behaviour from
then on, where a harness deleted before the commit left nothing behind.

1. Add a check under `e2e/checks/<area>.spec.ts`. It runs the real app, so it needs
   no copy of `index.html` and no injected script.
2. Build the state with the shared helpers rather than by recording: `boot(page)`
   loads the app and seeds a clip, and `makeTake(...)` builds a **fixture take** — a
   real, decodable WebM with an exact duration, produced in milliseconds. Editing
   checks never record.
3. Assert **what a person would see** — a chip's text, a button's visibility, the
   status line — and reach for the model only where the view shows nothing.
4. Run it: `npm run test:e2e` (or, for one check,
   `npx playwright test --config e2e/playwright.config.ts e2e/checks/cutting.spec.ts`).
   The dev server is started for you.
5. Commit the check with the change. A failing run leaves a trace, a screenshot and
   a video under `test-results/`, and the CI job keeps the report and the evidence as
   artifacts on every run (GitHub's answer to GitLab's artifacts).

A check that cannot run in its environment calls `test.skip(true, '<reason>')` — it
is reported **skipped**, with the reason, and never counted as a pass.

### Stubbing what the browser will not give you

- The **share picker** is never opened. `installStandInShare(page)` takes the place of
  `getDisplayMedia` with a `canvas.captureStream()`, so the app's handling of a share
  that is *handed back* is covered; `askedFor(page)` reads the constraints the app
  passed.
- The **webcam and mic** come from Chromium's fake devices, set as launch args in
  `e2e/playwright.config.ts`.
- The **publishing service** is stood in for with `page.route`; no check touches the
  network.
- A WebM's `duration = 0` quirk is the app's own `take-probe`'s problem, not the
  check's: a fixture take carries a real duration, so no seek-past-the-end guess is
  needed.
- Effects still leave traces worth asserting on: `CanvasRenderingContext2D.prototype.drawImage`
  and `globalAlpha` for compositing, `AudioParam.prototype.linearRampToValueAtTime`
  for the fades, `URL.revokeObjectURL` for what the repository releases,
  `HTMLAnchorElement.prototype.click` for the download.

## One feature, one or two checks — never a check per behaviour

The suite is a thing to keep, and every check costs a browser boot, a few seconds of
wall clock and a file the next reader has to skim. It must not grow with the feature's
every corner: **a feature is proved by one or two checks, and a fold into a check that
already exists beats a new one.**

- While the feature is being built, write as many checks as it takes — one per
  behaviour, run while iterating. That is scaffolding, like the retired
  `verify-*.html` harness, and **most do not survive to the commit.**
- Before the pull request, **fold them**: one check that walks the feature the way a
  person does, asserting the few things that story needs; a second only where a
  second, independent story exists — the refusal beside the success, the reload, the
  agent's path beside the person's, the one regression the change itself fixes.
- **Fold, never delete.** Every assertion that pins a regression must live on inside
  the folded check. Losing coverage to bring the count down is the failure mode this
  rule invites, and the regression that matters is the one the deleted check would
  have caught.
- A **new file** is a new area, not a behaviour: most changes add a check to a file
  that already exists (`export.spec.ts`, `profiles.spec.ts`, `capture.spec.ts`).
- A helper two checks would otherwise each copy — reading the exported bytes,
  decoding a frame at a moment, a written profile book — goes in `e2e/helpers/`,
  not into both files.

The count is a symptom, not the target: a feature that genuinely needs its two
checks has its two, and says in the pull request why the second was not a fold.

## Assert what a person would see, not only the model

The chip's text, whether the undo button is visible, what the status line says. A
bug in the *view* is invisible to a model assertion, and one was found exactly this
way: the marks rendered while the model was still announcing, so the chip showed a
section of zero length and the undo button never appeared.

## When a check fails, check the expectation first

It has been the test's own arithmetic far more often than the code. Work the number
out before changing anything: a 6 s clip with 3.6 s removed has **2.4 s** left, and
20 s of clip with 1 s removed keeps **19 s**.

## Say what was not verified

Every pull request says what it could not check and why — the share picker, a
real recording, an ear on the exported audio, headless numbers being headless
numbers. An honest gap is worth more than a clean story.
