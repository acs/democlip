import { describe, expect, it } from 'vitest';

import { EXPORT_RESOLUTION_ID, ExportResolution, exportPicture, isExportResolution, LEVELS } from './ExportResolution.js';
import { ClipSize } from './ClipSize.js';
import { ClipProperties } from './ClipProperties.js';

// The export resolution, proved in node: the levels, the one refusal, and the picture it answers —
// the clip size **scaled**, the aspect kept and both edges even. Nothing here needs a browser.

const size = (width: number, height: number): ClipSize => ClipSize.of(width, height)!;
const landscape = size(3840, 2160);
const portrait = size(1080, 1920);
const fourThree = size(1440, 1080);

describe('the levels the app offers', () => {
  it('are the shorter edge, high to low', () => {
    expect(LEVELS).toEqual([2160, 1440, 1080, 720, 480]);
  });

  it('reads the clip size as the empty value, and a level as its own', () => {
    expect(ExportResolution.of('')!.value).toBe('');
    expect(ExportResolution.of('1080')!.value).toBe('1080');
    // Surrounding space is not part of the value.
    expect(ExportResolution.of('1080')!.label()).toBe('1080p');
    expect(ExportResolution.of('')!.label()).toBe('Clip size');
  });

  it('refuses a value the app does not offer', () => {
    expect(ExportResolution.of('999')).toBeNull();
    expect(ExportResolution.of('1080p')).toBeNull();
    expect(ExportResolution.of('0')).toBeNull();
    expect(ExportResolution.of('-720')).toBeNull();
    expect(isExportResolution('')).toBe(true);
    expect(isExportResolution('720')).toBe(true);
    expect(isExportResolution('999')).toBe(false);
    expect(isExportResolution('1080p')).toBe(false);
  });
});

describe('the picture the file is written at', () => {
  it('is the clip size itself when none is chosen', () => {
    const picture = ExportResolution.of('')!.picture(landscape);
    expect(picture?.toString()).toBe('3840x2160');
  });

  it('keeps the clip size\'s aspect ratio, at the level\'s shorter edge', () => {
    // 16:9 in, 16:9 out: 1080 on the shorter edge is 1920x1080.
    expect(ExportResolution.of('1080')!.picture(landscape)?.toString()).toBe('1920x1080');
    // Portrait stays portrait: 1080 on the shorter edge is 1080x1920.
    expect(ExportResolution.of('1080')!.picture(portrait)?.toString()).toBe('1080x1920');
    // 4:3 stays 4:3.
    expect(ExportResolution.of('1080')!.picture(fourThree)?.toString()).toBe('1440x1080');
    // And a step down the ladder.
    expect(ExportResolution.of('720')!.picture(landscape)?.toString()).toBe('1280x720');
    expect(ExportResolution.of('720')!.picture(portrait)?.toString()).toBe('720x1280');
  });

  it('comes out even on both edges, whatever the clip size', () => {
    // An odd clip size is scaled to the next even picture, so no codec is asked for an odd edge.
    const odd = size(1921, 1081);
    const picture = ExportResolution.of('1080')!.picture(odd)!;
    expect(picture.width % 2).toBe(0);
    expect(picture.height % 2).toBe(0);
  });

  it('enlarges a clip smaller than the level, so a production\'s output is uniform', () => {
    expect(ExportResolution.of('2160')!.picture(size(1280, 720))?.toString()).toBe('3840x2160');
  });

  it('answers null rather than failing when the scale runs past the ceiling', () => {
    // A very thin clip: scaling it to a level would pass ClipSize.MAX_EDGE, so the picture is
    // null and the caller keeps the clip size.
    const thin = size(200, 8192);
    expect(ExportResolution.of('480')!.picture(thin)).toBeNull();
    expect(exportPicture(ClipProperties.EMPTY.with(EXPORT_RESOLUTION_ID, '480'), thin)?.toString()).toBe('200x8192');
  });
});

describe('exportPicture', () => {
  it('reads the clip\'s own property', () => {
    const chosen = ClipProperties.EMPTY.with(EXPORT_RESOLUTION_ID, '1080');
    expect(exportPicture(chosen, landscape)?.toString()).toBe('1920x1080');
  });

  it('is the clip size when the clip holds none, and null when it has no size', () => {
    expect(exportPicture(ClipProperties.EMPTY, landscape)?.toString()).toBe('3840x2160');
    expect(exportPicture(ClipProperties.EMPTY, null)).toBeNull();
  });

  it('treats an unknown stored value as the clip size rather than throwing', () => {
    const broken = ClipProperties.EMPTY.with(EXPORT_RESOLUTION_ID, '999');
    expect(exportPicture(broken, landscape)?.toString()).toBe('3840x2160');
  });
});
