// Export: the file a person downloads — its duration and its size, the card it opens
// with, and the files a clip leaves for editing and comes back from.
//
// The rules behind these live in node (the `ExportPlan`, the encoders' own tests). What
// is here is what only a browser shows: the bytes a real download holds, and a file
// taken back in becoming a take again.

import { expect, test, type Download, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot } from '../helpers/app.js';
import { makeFile, makeTakes, type FixtureFile } from '../fixtures/takes.js';
import { exportFile, frameCounts, hasSound, loudnessOf, probeFile } from '../helpers/exports.js';

/** Choose a file through the Import button, the way a person does. */
async function importFile(page: Page, file: FixtureFile): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#file-btn').click();
  await (await chooser).setFiles(file);
}

/** Whether this browser can write MP4 at all (AVC, offline); the upload and this need it. */
async function canEncodeMp4(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (typeof VideoEncoder !== 'function') return false;
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028', width: 854, height: 480, bitrate: 4_000_000,
    });
    return !!result.supported;
  });
}

// The regression this holds: an 854×480 take used to be encoded at 1280×720, six times
// the bytes and less detail than went in. The file is asked for its own track size, not
// the encoder's default — and it carries a real duration, not a MediaRecorder's zero.
test('exporting writes a file with a real duration, in the take’s own size — WebM and MP4', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 854, height: 480, seconds: 1 });
  await app.seed(takes);
  await app.review();

  const webm = await probeFile(page, await exportFile(page, '#exp-webm'), 'video/webm');
  expect(webm.duration).toBeGreaterThan(0.5);
  expect(webm.duration).toBeLessThan(2);
  expect({ width: webm.width, height: webm.height }).toEqual({ width: 854, height: 480 });

  test.skip(!(await canEncodeMp4(page)), 'this browser cannot encode MP4 (AVC) offline');
  const mp4 = await probeFile(page, await exportFile(page, '#exp-mp4'), 'video/mp4');
  expect(mp4.duration).toBeGreaterThan(0.5);
  expect(mp4.duration).toBeLessThan(2);
  expect({ width: mp4.width, height: mp4.height }).toEqual({ width: 854, height: 480 });
});

// The card at the head of a file: the clip's title and description over its first frame,
// for two seconds, when the clip asks for it. It is read the moment it appears, so its
// words are on its **first frame** — the poster a player and a file listing show.
test('a clip that asks for the card gets two seconds of it, with its words on the first frame', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  // The recording's own first frame: whatever light the take itself carries.
  const plain = await frameCounts(page, await exportFile(page, '#exp-webm'), 'video/webm', 0);

  // Give the clip its words, and turn the card on — through the panel, as a person would.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu')).toHaveClass(/on/);
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').fill('A short demo');
  await page.locator('#clip-prop-menu textarea').fill('What the clip shows in this recording');
  await page.locator('#clip-prop-menu .prop-row[data-id="addToExport"] input[type="checkbox"]').check();
  await page.locator('#props-btn').click();

  const carded = await exportFile(page, '#exp-webm');
  // One second of clip and two of card: about 2.95s, the export stopping a hair early.
  const duration = (await probeFile(page, carded, 'video/webm')).duration;
  expect(duration).toBeGreaterThan(2.4);
  expect(duration).toBeLessThan(4);

  // The card's own first frame is far more lit than the take's: the words are the
  // difference, since the take's frame is what the card is drawn over.
  const words = await frameCounts(page, carded, 'video/webm', 0);
  expect(words.light).toBeGreaterThan(plain.light * 3);
});

/** An arrow over the middle of the clip, through the app's own operation. */
async function drawAnArrow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { edit: { annotate(kind: string, params: unknown): unknown } } }).democlip;
    await surface?.edit.annotate('arrow', {
      span: { s: 0.2, e: 0.8 },
      from: { x: 0.3, y: 0.4 },
      to: { x: 0.6, y: 0.5 },
    });
  });
}

/** Export for editing, and keep the two files the browser writes — told apart by name. */
async function exportForEditing(page: Page, into: string): Promise<{ video: string; sidecar: string }> {
  const taken: Download[] = [];
  page.on('download', download => taken.push(download));

  await page.locator('#btn-exp').click();
  await page.locator('#exp-editing').click();

  await expect.poll(() => taken.length, { timeout: 30_000 }).toBe(2);
  // The two arrive in whatever order the browser delivers them, so their names decide:
  // the sidecar is named for the video, with `.democlip.json` where its extension was.
  let video = '';
  let sidecar = '';
  for (const download of taken) {
    const name = download.suggestedFilename();
    const path = join(into, name);
    await download.saveAs(path);
    if (name.endsWith('.democlip.json')) sidecar = path;
    else video = path;
  }
  if (!video || !sidecar) throw new Error(`the export wrote ${taken.map(d => d.suggestedFilename()).join(', ')}`);
  return { video, sidecar };
}

// A file already on the machine becomes a take, and a clip that leaves for editing comes
// back whole: the same way in, whether the file is a plain recording or the pair an
// editing export wrote.
test('a file becomes a take, and a clip exported for editing comes back with its annotations', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();          // the round trip draws its arrow through the surface

  // A WebM with sound joins as one take, holding its own length, and its own sound came
  // with it — so the waveform is drawn and the review opened on the file.
  const webm = await makeFile(page, {
    name: 'clip.webm', mimeType: 'video/webm', width: 640, height: 360, seconds: 1, hasAudio: true,
  });
  await importFile(page, webm);
  await expect.poll(() => app.clipLength(), { timeout: 15_000 }).toBeCloseTo(1, 1);
  await expect(page.locator('#thumbs canvas').first()).toBeVisible();
  await expect(page.locator('#btn-exp')).toBeVisible();
  await expect(page.locator('#waveform')).toBeVisible();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  // An MP4 taken in is read back by the export: the clip is two takes now, and the file
  // it writes has a real duration rather than a broken one.
  const mp4 = await makeFile(page, {
    name: 'clip.mp4', mimeType: 'video/mp4', container: 'mp4', width: 640, height: 360, seconds: 1,
  });
  await importFile(page, mp4);
  await expect.poll(() => app.clipLength(), { timeout: 15_000 }).toBeCloseTo(2, 1);
  const readBack = (await probeFile(page, await exportFile(page, '#exp-webm'), 'video/webm')).duration;
  expect(readBack).toBeGreaterThan(1.5);
  expect(readBack).toBeLessThan(3);

  // The round trip: a clip with an arrow leaves for editing — the picture alone, and the
  // annotations written beside it — and both come back, the arrow over the take.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await drawAnArrow(page);
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);

  const work = await mkdtemp(join(tmpdir(), 'democlip-round-trip-'));
  try {
    const { video, sidecar } = await exportForEditing(page, work);

    const chooser = page.waitForEvent('filechooser');
    await page.locator('#file-btn').click();
    await (await chooser).setFiles([video, sidecar]);

    // The take is in the clip — the clip's own four seconds plus the file — and the
    // annotations are back: the one that left, and the file's copy over the stretch it
    // was given.
    await expect.poll(async () =>
      Number((await page.locator('#t-clip').textContent())?.replace('s', '') ?? 0),
      { timeout: 20_000 },
    ).toBeGreaterThan(7.5);
    await expect(page.locator('#tl-annots > *')).toHaveCount(2);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

// The clip's sound is **boosted by default**: brought to a competitive loudness with peak
// safety, in every file, without anything being pressed — and given back as the recording it
// was when the switch is off, the picture the same either way. The review hears the same
// boosted sound, because it asks the same rule; a check cannot capture the page's audio, so
// that half is the shared-rule tests and a real session (`quickstart.md`).
test('the sound is boosted by default, and the switch gives the recording back', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  // Quiet on purpose: about −29 LUFS, the level a microphone a little far leaves.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1, hasAudio: true, level: 0.05 });
  await app.seed(takes);
  await app.review();

  // The switch is on for a clip that never touched it: nothing had to be pressed.
  await page.locator('#props-btn').click();
  const boost = page.locator('#clip-prop-menu .prop-row[data-id="soundBoost"] input[type="checkbox"]');
  await expect(boost).toBeChecked();
  await page.locator('#props-btn').click();

  const boosted = await exportFile(page, '#exp-webm');
  const loud = await loudnessOf(page, boosted);
  // The app's one speech target, within the LU the criterion allows.
  expect(loud.lufs).toBeGreaterThan(-17);
  expect(loud.lufs).toBeLessThan(-15);
  // And held below the top. The domain holds the exact −1.5 dBFS ceiling; a lossy re-encode
  // can overshoot a hair, so the file is asked only to be under it.
  expect(loud.peakDb).toBeLessThan(0);

  // Off: the file carries the recorded sound — far below the boosted one — and the picture is
  // the same either way, because the gain touches the sound alone.
  await page.locator('#props-btn').click();
  await boost.uncheck();
  await page.locator('#props-btn').click();

  const plain = await exportFile(page, '#exp-webm');
  const recorded = await loudnessOf(page, plain);
  expect(recorded.lufs).toBeLessThan(loud.lufs - 6);

  const withBoost = await frameCounts(page, boosted, 'video/webm', 0.2);
  const without = await frameCounts(page, plain, 'video/webm', 0.2);
  expect(without.painted).toBeGreaterThan(0);
  expect(without.light).toBeGreaterThan(withBoost.light * 0.9);
  expect(without.light).toBeLessThan(withBoost.light * 1.1);
});

// A clip with both kinds of take is a video; its sound-only stretch is black, so the file
// and the review stay in step. Cut the picture away and the same clip is a sound file.
test('a mixed clip writes black over its sound-only stretch, and sound alone once the picture is cut', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(
    page,
    { soundOnly: true, seconds: 1 },
    { width: 640, height: 360, seconds: 1 },
  );
  await app.seed(takes);
  await app.review();

  const mixed = await exportFile(page, '#exp-webm');
  const picture = await probeFile(page, mixed, 'video/webm');
  expect({ width: picture.width, height: picture.height }).toEqual({ width: 640, height: 360 });

  // The first kept second has no picture: the file writes it as black. The second is the
  // picture take's own frame.
  expect((await frameCounts(page, mixed, 'video/webm', 0.2)).painted).toBe(0);
  expect((await frameCounts(page, mixed, 'video/webm', 1.2)).painted).toBeGreaterThan(0);

  // Cut the whole picture take away, through the app's own operation.
  const cut = await page.evaluate(async () => {
    const surface = (globalThis as unknown as {
      democlip?: { edit: { cut: (from: number, to: number) => { ok: boolean } } };
    }).democlip;
    return surface?.edit.cut(0.5, 1);
  });
  expect(cut?.ok).toBe(true);

  // The kept clip has no picture, so the export is the sound alone — and no video service.
  const sound = await exportFile(page, '#exp-webm');
  const audio = await probeFile(page, sound, 'audio/webm');
  expect({ width: audio.width, height: audio.height }).toEqual({ width: 0, height: 0 });
  expect(audio.duration).toBeGreaterThan(0.5);
  expect(await hasSound(page, sound)).toBe(true);
});
