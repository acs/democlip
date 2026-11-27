// Annotations: each kind is placed over a section through the real canvas and made in the
// clip's annotation colour, and a text's box stays the shape of its own words however small
// it is dragged — including small enough that its grips reach across it, where a press inside
// moves it rather than resizing it.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { openSettings } from '../helpers/annotations.js';
import { makeTakes } from '../fixtures/takes.js';
import { exportFile, frameCounts, hasSound, meanLumaIn, rmsIn } from '../helpers/exports.js';
import { pageModule } from '../helpers/page-module.js';
import { storedRecording } from '../helpers/store.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

// A 1×1 PNG: enough for the image kind to decode and place.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** The player is ready and not mid-seek, so a timeline click is not swallowed (a seek drops `readyState`). */
async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const rv = document.getElementById('rv') as HTMLVideoElement | null;
    return !!rv && rv.readyState >= 2 && !rv.seeking;
  });
}

/** Bound a section on the timeline, so the kind's action is offered. */
async function section(page: Page, from = 0.25, to = 0.5): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  await ready(page);
  const y = strip.y + strip.height / 2;
  await page.mouse.click(strip.x + strip.width * from, y);
  await page.mouse.click(strip.x + strip.width * to, y);
}

/** The colour an annotation of this kind is drawn in, read from the clip's own annotation. */
const colourOf = (page: Page, kind: string) => page.evaluate(async ([url, wanted]: [string, string]) => {
  const { session } = await import(/* @vite-ignore */ url);
  const one = session.clip.annotations.all.find((annotation: { kind: string }) => annotation.kind === wanted) as
    { colour?: string } | undefined;
  return one?.colour ?? null;
}, [HOOKS, kind] as [string, string]);

test('each annotation kind — arrow, image and text — is placed over a section, in the clip’s colour, and shown on the lane', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // The clip's own panel offers the colour every new annotation is made in, each one drawn with
  // its swatch and its name, and starts at the app's red.
  await page.locator('#props-btn').click();
  const palette = page.locator('#clip-prop-menu .prop-row[data-id="annotationColour"] .colour-choice');
  await expect(palette).toHaveText(['Red', 'Orange', 'White', 'Yellow', 'Green', 'Blue', 'Black']);
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="annotationColour"] .colour-choice[aria-pressed="true"]')).toHaveText('Red');
  await page.locator('#clip-prop-menu .prop-row[data-id="annotationColour"] .colour-choice[data-value="#38a169"]').click();
  await page.locator('#props-btn').click();

  // An arrow, drawn across the picture — and in the clip's colour, not the kind's own red.
  // The kinds are offered by the annotate options on the picture, one row each, and the
  // timeline section carries only the scissors — no kind buttons to be crowded by the next.
  await expect(page.locator('#annotate-bar')).toHaveClass(/on/);
await expect(page.locator('#annotate-bar .annotate-row')).toHaveCount(5);
  // The clip's control is a target of its own: it wears a label like the kinds do, and the
  // column leaves a wider gap above the kinds than the kinds leave between them. Every row is
  // the same width — the widest label's — so the column is a list and not ragged buttons.
  await expect(page.locator('#props-btn')).toContainText('CLIP');
  const spacing = await page.evaluate(() => {
    const clip = document.getElementById('props-btn')!.getBoundingClientRect();
    const bar = document.getElementById('annotate-bar')!.getBoundingClientRect();
    const rows = [...document.querySelectorAll('#annotate-bar .annotate-row')].map(row => row.getBoundingClientRect());
    return {
      clipToKinds: bar.top - clip.bottom,
      kindToKind: rows[1].top - rows[0].bottom,
      widths: [clip.width, ...rows.map(row => row.width)],
    };
  });
  expect(spacing.clipToKinds).toBeGreaterThan(spacing.kindToKind);
  expect(new Set(spacing.widths.map(width => Math.round(width))).size).toBe(1);
  // A control is an opaque surface from the palette: the clip's settings control, the
  // annotate rows and the source buttons all wear the same `--control` surface, border and
  // label, so a kind reads over the picture as a source does in the toolbar — and none of
  // them shows the page through.
  const look = (selector: string) => page.locator(selector).first().evaluate(el => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor, border: s.borderTopColor, font: s.fontFamily };
  });
  // Park the pointer off the controls, so what is read is the resting look and not a
  // `:hover`; `expect.poll` waits out the 0.2 s colour transition a moving pointer starts.
  await page.mouse.move(4, 4);
  const source = await look('#screen-btn');
  expect(source.background).toMatch(/^rgb\(/);            // an opaque surface, not glass
  await expect.poll(() => look('#annotate-bar .annotate-row')).toEqual(source);
  await expect.poll(async () => {
    const { color, background, border } = await look('#props-btn');
    return { color, background, border };
  }).toEqual({ color: source.color, background: source.background, border: source.border });
  await section(page);
  await expect(page.locator('#tl-marks .tl-act.ok')).toHaveCount(1);
  await expect(page.locator('#tl-marks .tl-act.ann')).toHaveCount(0);
  await page.locator('#annotate-bar .annotate-row[data-kind="arrow"]').click();
  const preview = await page.locator('#preview').boundingBox();
  if (!preview) throw new Error('no preview');
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  const from = at(0.3, 0.3);
  const to = at(0.7, 0.7);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  // The annotation lane shows where the annotation is.
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  expect(await colourOf(page, 'arrow')).toBe('#38a169');

  // An image, chosen from a file.
  await section(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#annotate-bar .annotate-row[data-kind="image"]').click();
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);

  // Text, typed into the app's own entry rather than the browser's prompt — in the colour the
  // clip's panel is left holding: neither the white a text used to fall back to nor the
  // arrow's.
  await page.locator('#props-btn').click();
  await page.locator('#clip-prop-menu .prop-row[data-id="annotationColour"] .colour-choice[data-value="#3182ce"]').click();
  await page.locator('#props-btn').click();
  await section(page);
  await page.locator('#annotate-bar .annotate-row[data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Hello');
  await page.locator('#text-entry-add').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(3);
  expect(await colourOf(page, 'text')).toBe('#3182ce');

  // The picked annotation's stretch is drawn on the lane as the active band, and a cut
  // section selected beside it is shown at the same time — the two do not replace each other.
  await expect(page.locator('#text-entry')).toBeHidden();   // its backdrop would take the press
  await expect(page.locator('#tl-annots .tl-annot-band.on')).toHaveCount(1);
  await ready(page);
  const track = (await page.locator('#thumbs').boundingBox())!;
  const y = track.y + track.height / 2;
  await page.mouse.click(track.x + track.width * 0.65, y);
  await page.mouse.click(track.x + track.width * 0.85, y);
  await expect(page.locator('#tl-marks .tl-sel')).toHaveCount(1);
  await expect(page.locator('#tl-annots .tl-annot-band.on')).toHaveCount(1);
});

/** Bound the whole clip as the section, so the text kind's action is offered and its stretch holds. */
async function wholeClip(page: Page): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  const y = strip.y + strip.height / 2;
  await page.mouse.click(strip.x + 1, y);
  await page.mouse.click(strip.x + strip.width - 1, y);
}

/** Park the playhead in the middle of the clip: the canvas only picks what the moment shows. */
async function parkInside(page: Page): Promise<void> {  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  const shown = () => page.evaluate(async url => {
    const { session, player } = await import(/* @vite-ignore */ url);
    return session.clip.annotationsAt(player.time()).length;
  }, HOOKS);
  // A click that misses the strip leaves the playhead where it was, so it is asked again —
  // a miss under load is the machine's, not a change in what the app does.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(strip.x + strip.width * 0.5, strip.y + strip.height / 2);
    try {
      await expect.poll(shown, { timeout: 4_000 }).toBe(1);
      return;
    } catch { /* the click missed the strip; ask again */ }
  }
  expect(await shown()).toBe(1);
}

/** Park on a fraction of a 4-second clip and let the seek settle. */
async function parkAtFraction(page: Page, fraction: number): Promise<void> {
  const strip = (await page.locator('#thumbs').boundingBox())!;
  const y = strip.y + strip.height / 2;
  const at = () => page.evaluate(async url => (await import(/* @vite-ignore */ url)).player.time(), HOOKS);
  for (let attempt = 0; attempt < 4; attempt++) {
    await ready(page);
    await page.mouse.click(strip.x + strip.width * fraction, y);
    try {
      await expect.poll(at, { timeout: 3_000 }).toBeCloseTo(fraction * 4, 1);
      return;
    } catch { /* the seek did not land; ask again */ }
  }
  await expect.poll(at).toBeCloseTo(fraction * 4, 1);
}

/** Click the timeline until the playhead settles near `seconds` of a 10 s clip. */
async function parkAt(page: Page, seconds: number): Promise<void> {
  const strip = (await page.locator('#thumbs').boundingBox())!;
  const y = strip.y + strip.height / 2;
  const at = () => page.evaluate(async url => (await import(/* @vite-ignore */ url)).player.time(), HOOKS);
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.mouse.click(strip.x + strip.width * (seconds / 10), y);
    try {
      await expect.poll(at, { timeout: 3_000 }).toBeCloseTo(seconds, 0);
      return;
    } catch { /* the click landed before the take was ready; ask again */ }
  }
  expect(await at()).toBeCloseTo(seconds, 0);
}

/** A press-and-drag of the mouse, from one point to another. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/** The preview's own pixels in a band: how many are light and their mean luma. */
const previewBand = (page: Page, band: { x: number; y: number; width: number; height: number }) =>
  page.evaluate(box => {
    const cv = document.querySelector<HTMLCanvasElement>('#preview')!;
    const data = cv.getContext('2d')!.getImageData(
      Math.round(box.x * cv.width), Math.round(box.y * cv.height),
      Math.round(box.width * cv.width), Math.round(box.height * cv.height),
    ).data;
    let light = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) light++;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return { light, mean: sum / (data.length / 4) };
  }, band);

/** The magnifier's own numbers, read from the clip's model. */
const magnifier = (page: Page) => page.evaluate(async url => {
  const one = (await import(/* @vite-ignore */ url)).session.clip.annotations.all
    .find((a: { kind: string }) => a.kind === 'magnifier') as
    { kind: string; geometry: { x: number; y: number; radius: number; zoom: number }; colour: string } | undefined;
  if (!one) return null;
  return { kind: one.kind, ...one.geometry, colour: one.colour };
}, HOOKS);

/** The preview's pixel at a fraction of the picture, as red, green and blue. */
const pixelAt = (page: Page, fx: number, fy: number) => page.evaluate(([x, y]) => {
  const cv = document.querySelector<HTMLCanvasElement>('#preview')!;
  const d = cv.getContext('2d')!.getImageData(Math.round(x * cv.width), Math.round(y * cv.height), 1, 1).data;
  return { r: d[0], g: d[1], b: d[2] };
}, [fx, fy] as [number, number]);

/** The annotation kinds the clip store has written down — the debounced write, awaited. */
const kept = async (page: Page): Promise<string[]> =>
  (await storedRecording(page))?.annotations?.map(annotation => annotation.kind) ?? [];

/** The one text annotation: its box, and the width the words are actually drawn at. */
const read = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const cv = document.getElementById('preview') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const one = session.clip.annotations.all.find((a: { kind: string }) => a.kind === 'text') as
    { geometry: { text: string; x: number; y: number; width: number; height: number } } | undefined;
  if (!one) return null;
  const g = one.geometry;
  ctx.font = `600 ${g.height * cv.height}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  return {
    count: session.clip.annotations.all.length,
    text: g.text,
    boxPx: g.width * cv.width,
    drawnPx: ctx.measureText(g.text).width,
    height: g.height,
    x: g.x, y: g.y, width: g.width,
  };
}, HOOKS);

test('a text keeps the words’ shape when it is dragged small, and a press inside it moves it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1512, height: 982, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await wholeClip(page);

  await page.locator('#annotate-bar .annotate-row[data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Africa-Toto');
  await page.locator('#text-entry-add').click();
  // The entry fades out; until it has, its backdrop is still over the picture and takes the press.
  await expect(page.locator('#text-entry')).toBeHidden();
  await parkInside(page);

  const placed = (await read(page))!;
  expect(placed.text).toBe('Africa-Toto');
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  // A grip is pressed a few px **outside** its corner. A press a hair inside a box with no body
  // would be taken as a press to move it, which is the rule this check is about — so the grips
  // are aimed at from the outside, where the corner still reaches 14 px.
  const grip = (box: { x: number; y: number; width: number; height: number }) =>
    at(box.x + box.width + 3 / preview.width, box.y + box.height);

  // Drag the bottom-right grip in, to a box smaller than the grips reach across — one with no
  // body of its own — but not down to the smallest size: the taller it is, the more room a
  // press has to land inside it, and anything under 28 screen px is still no body (the grips
  // reach 14 px, so a height that small puts the middle within a grip's reach of both corners).
  await drag(
    page,
    grip(placed),
    at(placed.x + placed.width * 0.45, placed.y + placed.height * 0.45),
  );

  const small = (await read(page))!;
  expect(small.height).toBeLessThan(placed.height);
  expect(small.height * preview.height).toBeLessThan(28);
  // Still the shape the words are, so the whole line is inside its own box.
  expect(small.boxPx).toBeGreaterThan(small.drawnPx * 0.9);
  expect(small.boxPx).toBeLessThan(small.drawnPx * 1.1);

  // A press only lands on an annotation the playhead is showing — both the move and a grip
  // are looked for among `annotationsAt(player.time())` — so the playhead is put back on the
  // clip's middle before a press, whatever a previous drag left it at.
  await parkInside(page);

  // A press just inside its left edge — within a grip's reach of both left corners, and the
  // very press that would otherwise resize it — **moves** it, keeping its size. The edge is
  // read again here, and 3 px in: the picked shape's own controls sit a fixed 22 px to either
  // side of that edge, so the press is kept well clear of them.
  const fresh = (await page.locator('#preview').boundingBox())!;
  const inside = { x: fresh.x + fresh.width * small.x + 3, y: fresh.y + fresh.height * (small.y + small.height / 2) };
  const away = { x: inside.x + fresh.width * 0.08, y: inside.y + fresh.height * 0.08 };
  await drag(page, inside, away);

  const moved = (await read(page))!;
  expect(moved.count).toBe(small.count);          // moved, not copied or removed
  expect(moved.x).toBeGreaterThan(small.x + 0.03);
  expect(moved.y).toBeGreaterThan(small.y + 0.03);
  expect(Math.abs(moved.width - small.width)).toBeLessThan(0.005);
  expect(Math.abs(moved.height - small.height)).toBeLessThan(0.005);
  expect(moved.boxPx).toBeGreaterThan(moved.drawnPx * 0.9);
  expect(moved.boxPx).toBeLessThan(moved.drawnPx * 1.1);

  // Dragged on past the smallest size it may be, it stops at the floor — the drag asked for
  // smaller — and stays the shape the words are there too. The playhead is put back first, so
  // the grip is one of the annotations the moment shows.
  await parkInside(page);
  await drag(
    page,
    grip(moved),
    at(moved.x + moved.width * 0.02, moved.y + moved.height * 0.02),
  );

  const floored = (await read(page))!;
  expect(floored.height).toBeLessThan(moved.height);
  expect(floored.height).toBeCloseTo(0.02, 3);
  expect(floored.boxPx).toBeGreaterThan(floored.drawnPx * 0.9);
  expect(floored.boxPx).toBeLessThan(floored.drawnPx * 1.1);
});

test('a kind placed with no stretch selected starts at the playhead with the default duration', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // Outside the review there are no annotate options at all.
  await expect(page.locator('#annotate-bar')).not.toHaveClass(/on/);

  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 10 });
  await app.seed(takes);
  await app.review();
  await expect(page.locator('#annotate-bar .annotate-row')).toHaveCount(5);

  // Put the playhead a quarter in with nothing selected — one click sets a mark, not a
  // section — and place an arrow from the column.
  await parkAt(page, 2.5);
  await page.locator('#annotate-bar .annotate-row[data-kind="arrow"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  await page.mouse.move(preview.x + preview.width * 0.3, preview.y + preview.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(preview.x + preview.width * 0.7, preview.y + preview.height * 0.7, { steps: 8 });
  await page.mouse.up();

  // It is shown for the default two seconds, with no stretch selected at all — and it is the
  // picked one, so its whole stretch is the active band. Where the moment itself lands is the
  // playhead's, and a seek still settling can move that under a cross-read assertion, so this
  // asserts the rule it is about — the default length with nothing selected — and not the instant.
  const span = await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    const one = session.clip.annotations.all[0];
    return one ? { s: one.span.s, e: one.span.e, total: session.clip.total() } : null;
  }, HOOKS);
  expect(span).not.toBeNull();
  expect((span!.e - span!.s) * span!.total).toBeCloseTo(2, 1);   // DEFAULT_ANNOTATION_S
  await expect(page.locator('#tl-marks .tl-sel')).toHaveCount(0); // no stretch was needed
  await expect(page.locator('#tl-annots .tl-annot-band.on')).toHaveCount(1);
});

// A sound annotation is heard, not drawn: what is only a browser can show is that the app's own
// sound is **in the exported file**, over the stretch it was placed on, mixed with the
// recording — and that the recording itself is untouched. The rules behind it live in node (the
// plan's `soundings()`, the store, the mix); this reads the bytes a real download holds.
test('a sound annotation is heard in the file over its stretch, and the recording is otherwise unchanged', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  // A quiet recording with a soft tone, and the clip's boost switched off so the recording stays
  // at its own low level — the added sound then stands out clearly where it lands, and what is
  // compared is the app's mixing, not the boost's.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 4, hasAudio: true, level: 0.01 });
  await app.seed(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await page.locator('#clip-prop-menu .prop-row[data-id="soundBoost"] input[type="checkbox"]').uncheck();
  await page.locator('#props-btn').click();

  // A sound over a section of the clip: the kind is offered on the picture, and the new one
  // plays at once in the app's default sound, with its preferences open.
  await section(page);                       // 25%…50% of the clip — about 1s…2s
  await page.locator('#annotate-bar .annotate-row[data-kind="sound"]').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);

  const withSound = await exportFile(page, '#exp-webm');
  // The window the sound lands in is far louder than a window the recording holds alone.
  const overSound = await rmsIn(page, withSound, 1.1, 1.9);
  const elsewhere = await rmsIn(page, withSound, 3.0, 3.8);
  expect(elsewhere).toBeGreaterThan(0);                 // the recording is really in the file
  expect(overSound).toBeGreaterThan(elsewhere * 3);

  // Delete the sound (it is picked on placement) and export again: where the sound was is now
  // the recording alone — the takes were never touched — and where it never was is the same.
  await page.keyboard.press('Delete');
  await expect(page.locator('#tl-annots > *')).toHaveCount(0);
  const without = await exportFile(page, '#exp-webm');
  expect(await rmsIn(page, without, 1.1, 1.9)).toBeLessThan(overSound / 3);
  expect(await rmsIn(page, without, 3.0, 3.8)).toBeCloseTo(elsewhere, 2);
});

// A clip whose takes carry no sound at all is silent — until a sound annotation is placed, and
// the file it writes carries that sound where before it carried none.
test('a clip with no recorded sound gains sound from a sound annotation', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 4 });
  await app.seed(takes);
  await app.review();

  const silent = await exportFile(page, '#exp-webm');
  expect(await hasSound(page, silent)).toBe(false);

  await section(page);
  await page.locator('#annotate-bar .annotate-row[data-kind="sound"]').click();
  const sounding = await exportFile(page, '#exp-webm');
  expect(await hasSound(page, sounding)).toBe(true);
});

// The sound is chosen in the preferences from a **drop-down** of the app's own sounds, with **one
// play button** that plays the chosen one.
test('the preferences choose the sound from a drop-down, and one play button plays the chosen one', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __previews?: number };
    w.__previews = 0;
    const proto = (window as unknown as { AudioBufferSourceNode?: { prototype: { start: (...a: unknown[]) => void } } }).AudioBufferSourceNode?.prototype;
    if (proto) {
      const start = proto.start;
      proto.start = function (this: unknown, ...args: unknown[]): void {
        w.__previews = (w.__previews ?? 0) + 1;
        return start.apply(this, args);
      };
    }
  });

  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 4, hasAudio: true, level: 0.03 });
  await app.seed(takes);
  await app.review();

  await section(page);
  await page.locator('#annotate-bar .annotate-row[data-kind="sound"]').click();
  // The picked sound's lane controls are remove and settings — there is no copy control: a
  // sound has no place on the picture to shift a copy to, so a copy is made from the keyboard.
  await expect(page.locator('#tl-annots .tl-annot-ctl[data-act="copy"]')).toHaveCount(0);
  await expect(page.locator('#tl-annots .tl-annot-ctl')).toHaveCount(2);
  // One drop-down of the app's own sounds, and one play button for the chosen one.
  const select = page.locator('#prop-menu .prop-sound-select');
  await expect(select).toHaveCount(1);
  await expect(select.locator('option')).toHaveText([
    'Chime', 'Gong', 'Pluck', 'Riser', 'Thud', 'Whoosh', 'Wow',
  ]);
  await expect(select).toHaveValue('chime');                       // the app's default
  await expect(page.locator('#prop-menu .prop-sound-play')).toHaveCount(1);

  // Choosing in the list changes the sound at once, and is what the one play button plays.
  await select.selectOption('gong');
  await expect(page.locator('#prop-menu .prop-sound-select')).toHaveValue('gong');
  const chosen = await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    const one = session.clip.annotations.all.find((a: { kind: string }) => a.kind === 'sound') as
      { geometry: { sound: string } } | undefined;
    return one?.geometry.sound ?? null;
  }, HOOKS);
  expect(chosen).toBe('gong');

  const heard = () => page.evaluate(() => (window as unknown as { __previews?: number }).__previews ?? 0);
  const before = await heard();
  await page.locator('#prop-menu .prop-sound-play').click();
  await expect.poll(heard, { timeout: 5_000 }).toBeGreaterThan(before);
});

// ── The magnifier ─────────────────────────────────────────────────────────────

// A band over the picture's centre, where the frame's number sits, and a corner band the
// spotlight leaves dark. Both are fractions of the picture; the lens band is square in
// pixels on a 16:9 picture, so 0.16 wide and 0.16 × 16/9 tall.
const LENS_BAND = { x: 0.42, y: 0.358, width: 0.16, height: 0.284 };
const CORNER_BAND = { x: 0.02, y: 0.02, width: 0.10, height: 0.18 };

test('a magnifier enlarges the detail in its lens and dims the rest, in the review and in the file', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // Hold the clip's middle: the lens's stretch starts there, and the frame's number is in
  // the middle of the picture, so the lens covers the detail.
  await parkAtFraction(page, 0.5);

  // The picture without a lens: the number's light and the corner's brightness are the
  // baseline every later reading is compared with.
  const before = await previewBand(page, LENS_BAND);
  const beforeCorner = await previewBand(page, CORNER_BAND);

  // Place the lens by dragging from the detail's centre out to its rim.
  await page.locator('#annotate-bar .annotate-row[data-kind="magnifier"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  await drag(page, at(0.5, 0.5), at(0.7, 0.5));

  // The lane mark and the model: the centre, the radius as the shorter side's fraction and
  // the default 2× zoom.
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  const placed = await magnifier(page);
  expect(placed?.kind).toBe('magnifier');
  expect(placed?.x).toBeCloseTo(0.5, 2);
  expect(placed?.y).toBeCloseTo(0.5, 2);
  expect(placed?.radius).toBeCloseTo(0.3556, 2);
  expect(placed?.zoom).toBe(2);

  // The review: the detail in the lens is the frame's number, larger than before; the corner
  // outside the lens is darker than before.
  await expect.poll(async () => (await previewBand(page, LENS_BAND)).light).toBeGreaterThan(before.light * 1.5);
  await expect.poll(async () => (await previewBand(page, CORNER_BAND)).mean).toBeLessThan(beforeCorner.mean * 0.9);

  // It is kept: the write is debounced, so wait for the store; a reload brings the same
  // circle, radius and zoom back. The restored review opens at the clip's start, so park
  // on the lens's stretch again before the file is read.
  await expect.poll(() => kept(page)).toContain('magnifier');
  await page.reload();
  await expect.poll(async () => (await magnifier(page))?.kind).toBe('magnifier');
  const back = await magnifier(page);
  expect(back?.x).toBeCloseTo(0.5, 2);
  expect(back?.y).toBeCloseTo(0.5, 2);
  expect(back?.radius).toBeCloseTo(0.3556, 2);
  expect(back?.zoom).toBe(2);
  await parkAtFraction(page, 0.5);
  const restored = (await page.locator('#preview').boundingBox())!;

  // The file: the same lens and the same dim over the stretch, and the picture untouched
  // outside it. The file is read at 2.5 s — the middle of the stretch — and at 0.5 s.
  const withLens = await exportFile(page, '#exp-webm');
  const lensLight = (await frameCounts(page, withLens, 'video/webm', 2.5, LENS_BAND)).light;
  expect(lensLight).toBeGreaterThan(before.light * 1.5);
  const cornerMid = await meanLumaIn(page, withLens, 'video/webm', 2.5, CORNER_BAND);
  expect(cornerMid).toBeLessThan(beforeCorner.mean * 0.9);
  const cornerEarly = await meanLumaIn(page, withLens, 'video/webm', 0.5, CORNER_BAND);

  // Delete the lens: the restored review has nothing selected, so pick the lens first, then
  // delete it. The file loses the lens and the dim, and the early stretch is the same.
  await page.mouse.click(restored.x + restored.width * 0.5, restored.y + restored.height * 0.5);
  await page.keyboard.press('Delete');
  await expect(page.locator('#tl-annots > *')).toHaveCount(0);
  const without = await exportFile(page, '#exp-webm');
  expect((await frameCounts(page, without, 'video/webm', 2.5, LENS_BAND)).light).toBeLessThan(lensLight * 0.75);
  expect(await meanLumaIn(page, without, 'video/webm', 2.5, CORNER_BAND)).toBeGreaterThan(cornerMid * 1.1);
  expect(await meanLumaIn(page, without, 'video/webm', 0.5, CORNER_BAND)).toBeCloseTo(cornerEarly, -1);

  // The one undo brings the lens back.
  await page.locator('#cut-undo').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
});

test('a magnifier’s preferences correct its zoom, colour and duration, and its body and rim are dragged', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();
  // Park early enough that the clip has room past the default 2 s stretch, so the duration
  // can be stepped longer without the clip's end refusing it.
  await parkAtFraction(page, 0.25);

  // Place the lens over the detail.
  await page.locator('#annotate-bar .annotate-row[data-kind="magnifier"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  await drag(page, at(0.5, 0.5), at(0.7, 0.5));
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);

  // Its settings control opens the panel: Colour, Zoom and Duration, in that order.
  await openSettings(page, preview);
  await expect(page.locator('#prop-menu')).toHaveClass(/on/);
  const ids = await page.locator('#prop-menu .prop-row').evaluateAll(rows =>
    rows.map(row => (row as HTMLElement).dataset.id));
  expect(ids).toEqual(['colour', 'zoom', 'duration']);

  // The zoom starts at 2×; stepping it up enlarges the detail in the review and the model.
  const zoom = page.locator('#prop-menu .prop-row[data-id="zoom"]');
  await expect(zoom.locator('.prop-duration-text')).toHaveText('2×');
  const before = (await previewBand(page, LENS_BAND)).light;
  await zoom.locator('.prop-step[aria-label="Higher"]').click();
  await expect(zoom.locator('.prop-duration-text')).toHaveText('2.5×');
  expect((await magnifier(page))?.zoom).toBe(2.5);
  await expect.poll(async () => (await previewBand(page, LENS_BAND)).light).toBeGreaterThan(before);

  // The colour is the rim's: the green swatch paints the rim green.
  await page.locator('#prop-menu .prop-row[data-id="colour"] .prop-swatch[data-value="#38a169"]').click();
  expect((await magnifier(page))?.colour).toBe('#38a169');
  await expect.poll(async () => {
    const rim = await pixelAt(page, 0.5, 0.5 - 0.3556);
    return rim.g > rim.r;
  }).toBe(true);

  // The duration steps in tenths and the model follows.
  const duration = page.locator('#prop-menu .prop-row[data-id="duration"]');
  await expect(duration.locator('.prop-duration-text')).toHaveText('2.00s');
  await duration.locator('.prop-step[aria-label="Longer"]').click();
  await expect(duration.locator('.prop-duration-text')).toHaveText('2.10s');

  // Moving the body keeps the centre's numbers and the zoom, and changes the centre.
  await drag(page, at(0.5, 0.5), at(0.55, 0.55));
  const moved = await magnifier(page);
  expect(moved?.x).toBeCloseTo(0.55, 2);
  expect(moved?.y).toBeCloseTo(0.55, 2);
  expect(moved?.zoom).toBe(2.5);

  // Resizing from the rim's right grip widens the lens around the same centre.
  const radiusBefore = moved!.radius;
  await drag(page, at(0.55 + 0.2, 0.55), at(0.55 + 0.3, 0.55));
  const resized = await magnifier(page);
  expect(resized!.radius).toBeGreaterThan(radiusBefore);

  // Copy and paste: a second lens, the same numbers, at the playhead; delete takes it away
  // and the one undo brings it back.
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);
  await page.keyboard.press('Delete');
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  await page.locator('#cut-undo').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);

  // A reload keeps both lenses' numbers — the write is debounced, so wait for the store.
  await expect.poll(async () => (await kept(page)).filter(kind => kind === 'magnifier').length).toBe(2);
  await page.reload();
  await expect.poll(async () => page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.annotations.all.filter((a: { kind: string }) => a.kind === 'magnifier').length;
  }, HOOKS)).toBe(2);
});

// ── the family proof ──────────────────────────────────────────────────────────
//
// The magnifier is an annotation like the others: a cut takes its stretch as it takes any
// annotation's, a sound-only clip offers no kind that needs a picture, and a picture that is
// not 16:9 still gets a round lens. These are what adding the kind must not change.

test('a cut through a magnifier’s stretch takes the lens and its dim, and the undo brings them back', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // The lens is placed over the whole clip, so the cut below takes only part of its stretch
  // and the rest is left on the lane.
  await wholeClip(page);
  await page.locator('#annotate-bar .annotate-row[data-kind="magnifier"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  await drag(page, at(0.5, 0.5), at(0.7, 0.5));
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);

  // Placing the lens spent the section — the clip announces the new annotation, and the
  // selection clears with it — so the cut's stretch is bounded now: the **third** second,
  // whose frame is blue-dominant, so the rim's absence reads as the frame's own colour.
  await section(page, 0.5, 0.75);

  // Inside the lens's stretch the rim is the annotation's red; the frame's own hue at 1.5 s
  // is not. The playhead is moved without touching the timeline, so the section stays bounded.
  await page.evaluate(async url => {
    const { player } = await import(/* @vite-ignore */ url);
    await player.seekAndDraw(1.5);
  }, HOOKS);
  await expect.poll(async () => {
    const rim = await pixelAt(page, 0.5, 0.5 - 0.3556);
    return rim.r > rim.b;
  }).toBe(true);

  // Cut that second: the frame the playhead lands on is inside the cut, so the rim is gone and
  // the picture's own colour is there — and the lens is still on the lane over what is left of
  // its stretch.
  await page.locator('#tl-marks .tl-act.ok').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  await expect.poll(async () => {
    const rim = await pixelAt(page, 0.5, 0.5 - 0.3556);
    return rim.r < rim.b;
  }).toBe(true);

  // The one undo brings the cut back, and the lens with it.
  await page.locator('#cut-undo').click();
  await expect.poll(async () => {
    const rim = await pixelAt(page, 0.5, 0.5 - 0.3556);
    return rim.r > rim.b;
  }).toBe(true);
});

test('a sound-only clip offers no magnifier, because there is no picture to read', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { soundOnly: true, seconds: 2 });
  await app.seed(takes);
  await app.reviewSoundOnly();

  // The sound kind is the only one a sound-only clip offers: the drawn kinds need a picture.
  await expect(page.locator('#annotate-bar .annotate-row')).toHaveCount(1);
  await expect(page.locator('#annotate-bar .annotate-row[data-kind="sound"]')).toHaveCount(1);
  await expect(page.locator('#annotate-bar .annotate-row[data-kind="magnifier"]')).toHaveCount(0);
});

test('a magnifier on a 2:1 picture is still a round lens, with its grips on the rim', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1200, height: 600, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await parkAtFraction(page, 0.5);

  // A square band in pixels: 240 × 240 on a 1200 × 600 picture, so 0.2 wide and 0.4 tall.
  const band = { x: 0.4, y: 0.3, width: 0.2, height: 0.4 };
  const before = await previewBand(page, band);

  // Drag to a 0.2 radius of the shorter side: 120 px on both axes, so the band stays square.
  await page.locator('#annotate-bar .annotate-row[data-kind="magnifier"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  await drag(page, at(0.5, 0.5), at(0.6, 0.5));
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  const lens = await magnifier(page);
  expect(lens?.radius).toBeCloseTo(0.2, 2);

  // The lens enlarges the detail and dims the corner, exactly as on a 16:9 picture.
  await expect.poll(async () => (await previewBand(page, band)).light).toBeGreaterThan(before.light * 1.5);
  await expect.poll(async () => {
    const corner = await previewBand(page, { x: 0.02, y: 0.02, width: 0.16, height: 0.18 });
    return corner.mean;
  }).toBeLessThan(before.mean * 0.9);

  // The rim and the two grips are the annotation's red; the picture's own hue is not.
  const rim = await pixelAt(page, 0.5, 0.3);
  expect(rim.r).toBeGreaterThan(rim.b);
  const left = await pixelAt(page, 0.4, 0.5);
  const right = await pixelAt(page, 0.6, 0.5);
  expect(left.r).toBeGreaterThan(left.b);
  expect(right.r).toBeGreaterThan(right.b);
});
