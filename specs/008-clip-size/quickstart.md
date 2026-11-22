# Quickstart: Clip Size

How to see the feature work, once it is built. The rules are unit-tested in node; what
is drawn is driven in a real browser by the end-to-end suite.

## Prerequisites

```bash
npm install
```

## The rules, in node

```bash
npx vitest run src/domain/clip/ClipSize.test.ts
npx vitest run src/domain/clip/Clip.test.ts src/domain/clip/Take.test.ts
npx vitest run src/ui/clip/clip-properties.test.ts
```

Expected:

- `ClipSize.of(985, 611)` is `986×612`; `of(0, 100)` and `of(9000, 100)` are `null`.
- `ClipSize.largest([{1920,1080}, {1280,720}])` is `1920×1080`; a portrait and a
  landscape pair gives the smallest rectangle that holds both.
- `frameFor({1280,720})` on a `1920×1080` size is centred with bars top and bottom.
- `Clip.size()` grows from `1280×720` to `1920×1080` when the larger take arrives, and
  stops changing once `setProperty('size', …)` has been called.
- The `size` property refuses `0`, `-1`, `""` and beyond `MAX_EDGE`, and rounds `985`.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/clip-size.spec.ts
```

The check builds a clip with `makeTake` of two different sizes and asserts what a
person would see:

1. **One frame** — the review's canvas has the clip size, and switching between the
   takes does not change it.
2. **Fit, whole** — both takes are visible, none cut off (the fixture's coloured
   edges reach the frame's inner edges on the shorter axis).
3. **The size is shown** — open the settings control in the preview; the panel's
   `Clip size` row shows `W×H`.
4. **Change it** — type a new `W×H`, close the panel, and the review's canvas is the
   new size.
5. **It is kept** — reload; the panel shows the changed size and the review opens at
   it.
6. **The one undo takes it back** — press undo; the previous size is back.
7. **A file is written at it** — export the WebM and check the blob's video track is
   the clip size.

## What no check can do

The recorder's own flow — a real screen share, a take arriving through the picker — is
the user's to run: `getDisplayMedia` needs a gesture and a picker no check can open.
Run a session by hand and confirm a recorded take's picture size reaches the clip.

## In the app, by hand

```bash
npm run dev
```

1. Share a screen, record a take, stop.
2. Crop a region and record a second take.
3. In the review, open the **settings** control (the three sliders in the corner of
   the preview): the **Clip size** row shows the larger of the two pictures, rounded up
   to even.
4. Type a different size and confirm the picture re-fits, whole and centred.
5. Export; the file is the size you typed.
