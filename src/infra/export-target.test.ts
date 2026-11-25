import { describe, expect, it } from 'vitest';

import { avcProbes, fitsBudget, specFor, videoBitrate } from './export-target.js';

describe('specFor', () => {
  it('names WebM with the codecs the download has always used', () => {
    const spec = specFor('webm');
    expect(spec.mime).toBe('video/webm');
    expect(spec.video.map(v => v.name)).toEqual(['vp9', 'vp8']);   // vp9 first, vp8 behind it
    expect(spec.audio).toBe('opus');
  });

  it('names the MP4 Bluesky insists on: H.264 with AAC', () => {
    const spec = specFor('mp4');
    expect(spec.mime).toBe('video/mp4');
    expect(spec.video.map(v => v.name)).toEqual(['avc']);
    expect(spec.audio).toBe('aac');
  });

  it('gives every codec something to probe, so support is asked, not assumed', () => {
    for (const spec of [specFor('webm'), specFor('mp4')]) {
      for (const choice of spec.video) {
        const probes = choice.probes(1920, 1080);
        expect(probes.length).toBeGreaterThan(0);
        for (const probe of probes) expect(probe).toMatch(/\S/);
      }
    }
  });
});

describe('the picture the encoder is given', () => {
  it('takes an MP4 down to the even size below it, which is what H.264 accepts', () => {
    const spec = specFor('mp4');
    expect(spec.picture(1919, 1079)).toEqual({ width: 1918, height: 1078 });
    expect(spec.picture(985, 611)).toEqual({ width: 984, height: 610 });
    expect(spec.picture(1920, 1080)).toEqual({ width: 1920, height: 1080 });   // already even
  });

  it('never leaves MP4 an odd edge — the crop that could not be exported', () => {
    const spec = specFor('mp4');
    for (const [w, h] of [[1919, 1080], [1920, 1079], [1919, 1079], [1, 1]]) {
      const picture = spec.picture(w, h);
      expect(picture.width % 2).toBe(0);
      expect(picture.height % 2).toBe(0);
      expect(picture.width).toBeGreaterThanOrEqual(2);
      expect(picture.height).toBeGreaterThanOrEqual(2);
    }
  });

  it('leaves a WebM exactly as the crop made it, odd edges and all', () => {
    const spec = specFor('webm');
    expect(spec.picture(1919, 1079)).toEqual({ width: 1919, height: 1079 });
  });
});

describe('avcProbes', () => {
  // The level is the last two hex digits of the codec string, e.g. avc1.640028.
  const levelOf = (width: number, height: number): string => avcProbes(width, height)[0].slice(9);

  it('grows the level to fit the picture', () => {
    expect(levelOf(1280, 720)).toBe('1f');     // 3.1 — good to 720p
    expect(levelOf(1920, 1080)).toBe('28');    // 4.0 — 3.1 is refused here
    expect(levelOf(2560, 1440)).toBe('32');    // 5.0
    expect(levelOf(3840, 2160)).toBe('33');    // 5.1
    expect(levelOf(5120, 2880)).toBe('3c');    // 6.0
  });

  it('never offers a level too small for the picture — the 1080p bug', () => {
    // The old probe pinned level 3.1 (avc1.42001f), good only to 1280x720, so any
    // larger capture came back "cannot encode MP4".
    expect(avcProbes(1920, 1080)).not.toContain('avc1.42001f');
    expect(avcProbes(2560, 1440)).not.toContain('avc1.640028');
  });

  it('offers High, Main and Baseline at that level, in that order', () => {
    expect(avcProbes(1920, 1080)).toEqual(['avc1.640028', 'avc1.4d0028', 'avc1.420028']);
  });
});

describe('videoBitrate', () => {
  it('follows the picture at every size, so a smaller export resolution is a smaller file', () => {
    // A flat 4 Mb/s floor used to sit above the rule here, so 720p and below all came out at one
    // bitrate and choosing a smaller resolution saved nothing at all.
    expect(videoBitrate(1280, 720)).toBe(3_317_760);
    expect(videoBitrate(854, 480)).toBe(1_475_712);
    expect(videoBitrate(640, 360)).toBe(829_440);
  });

  it('grows with the picture, which is what a screen of small text needs', () => {
    expect(videoBitrate(1920, 1080)).toBe(7_464_960);
    expect(videoBitrate(3440, 1440)).toBe(17_832_960);   // the 1440p screen that blurred
  });

  it('caps, so a long clip stays within the upload limits', () => {
    expect(videoBitrate(3840, 2160)).toBe(24_000_000);
    expect(videoBitrate(7680, 4320)).toBe(24_000_000);
  });

  it('holds under a byte budget, down to a quarter of what the picture asks and no further', () => {
    const budget = { bytes: 300_000_000 };
    expect(videoBitrate(3440, 1440, { ...budget, seconds: 60 })).toBe(17_832_960);    // fits anyway
    expect(videoBitrate(3440, 1440, { ...budget, seconds: 180 })).toBe(12_000_000);   // 300 MB in 3 min
    // 300 MB in 10 min affords 3.6 Mb/s, under the quarter this picture is written at — so the
    // caller refuses rather than writing a 1440p file at a bitrate that is not that picture.
    expect(videoBitrate(3440, 1440, { ...budget, seconds: 600 })).toBe(4_458_240);
  });
});

describe('fitsBudget', () => {
  it('says no where the share cannot reach the budget — the honest refusal', () => {
    // 900 KB over a minute affords 108 kb/s, far under the 1.48 Mb/s an 854x480 picture asks for.
    expect(fitsBudget(854, 480, { seconds: 60, bytes: 900_000 })).toBe(false);
  });

  it('says yes where the budget affords what the picture asks', () => {
    // 40 MB over a minute affords 4.8 Mb/s, above the 1.48 Mb/s the picture asks, so the file fits.
    expect(fitsBudget(854, 480, { seconds: 60, bytes: 40_000_000 })).toBe(true);
  });

  it('does not confuse a picture-sized bitrate above the budget with not fitting', () => {
    // 3440×1440 wants 17.8 Mb/s, and 300 MB over 3 min affords 12 Mb/s: the file still
    // fits, because the encoder lowers to what the budget affords.
    const fit = { seconds: 180, bytes: 300_000_000 };
    expect(videoBitrate(3440, 1440, fit)).toBe(12_000_000);
    expect(fitsBudget(3440, 1440, fit)).toBe(true);
  });

  it('says no for a big picture too, where the budget is under the share over a long clip', () => {
    // A 1440p picture is written at 4.46 Mb/s at the least; 10 MB over 3 min affords well under it.
    expect(fitsBudget(3440, 1440, { seconds: 180, bytes: 10_000_000 })).toBe(false);
  });
});
