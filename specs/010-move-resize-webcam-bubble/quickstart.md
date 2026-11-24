# Quickstart — Move and Resize the Webcam Bubble

How to see the feature work, and how to prove it, from a checkout of this branch.

## Prerequisites

- Node with the repo's dependencies installed: `npm install`
- A **Webcam** on the machine (or Chromium's fake device, which the suite uses).
- The share picker can be driven only by hand, so the manual run needs a real share.

## Run the app

```bash
npm run dev
# open the printed URL (127.0.0.1)
```

### The manual walk (a real session — the share picker is the person's)

1. Turn **Webcam** on, then **Screen** and share a screen, window or tab.
   *Expect*: the camera appears as a circle in the **bottom-right** of the recorded
   region, at the default size, and a small handle sits on its rim.
2. **Drag the circle** to another corner.
   *Expect*: it follows the pointer and stays where you release it; the picture under it is
   **not** cropped.
3. **Drag the rim** outward, then inward.
   *Expect*: the circle grows and shrinks, staying round; it stops at the smallest and the
   largest allowed size.
4. Press **Record** for a couple of seconds, stop, and watch the take.
   *Expect*: the recorded picture holds the bubble in the place and at the size you set.
5. Drag on the picture, **not** on the bubble.
   *Expect*: the crop box, exactly as before — the bubble does not move.
6. Press **New** (and separately, reload the page).
   *Expect*: the bubble is back in the **bottom-right** corner at the default diameter.

## Prove it

### The circle's rules — node, beside the file

```bash
npx vitest run src/domain/capture/WebcamBubble.test.ts
```

*Expect*: the size bounds, the containment clamp, the default corner for wide/tall/square
regions, and the hit test all pass. This is the rule `src/domain/` is proved by.

### The drawing and the gesture — a committed check in a real browser

```bash
npx playwright test --config e2e/playwright.config.ts e2e/checks/capture.spec.ts
```

The bubble's check (folded into `capture.spec.ts`, beside the existing circle check):

- boots with a **stand-in share** and Chromium's **fake camera**;
- moves the bubble with `page.mouse` and asserts the preview's circle **moved** (the
  `arc` it draws for the bubble changed place) and **stayed round**;
- resizes it and asserts the radius changed;
- records a take and reads the recorded picture back with the frame reader
  (`frameCounts` in `e2e/helpers/exports.ts`) — the bubble is painted in the **new**
  corner of the take, not the old one;
- drags off the bubble and asserts the **crop** still crops (the bubble's move did not
  swallow the crop gesture).

*Expect*: the check passes. A failure leaves a trace, a screenshot and a video under
`test-results/`.

### The build, as a floor and not a proof

```bash
npm run lint && npm run typecheck && npm run test
```

*Expect*: clean. Passing this proves the types line up and nothing more.

## What this cannot check, and must be said in the pull request

- **The share picker.** No check can open it; a real share is the person's session
  (step 1's manual walk).
- **A real camera.** The suite's camera is Chromium's fake device.
- The unit and browser levels above are what the change gets; the recorder's flow is the
  real session.
