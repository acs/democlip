import { describe, expect, it } from 'vitest';
import { SourceSet } from './SourceSet.js';

describe('SourceSet', () => {
  it('starts with nothing on', () => {
    expect(SourceSet.NONE.any).toBe(false);
    expect(SourceSet.NONE.hasPicture).toBe(false);
    expect(SourceSet.NONE.canRecord).toBe(false);
  });

  it('needs a source for a take: a picture, or the microphone on its own', () => {
    expect(SourceSet.of(true, false, false).canRecord).toBe(true);
    expect(SourceSet.of(false, true, false).canRecord).toBe(true);
    expect(SourceSet.of(false, false, true).canRecord).toBe(true);
    expect(SourceSet.NONE.canRecord).toBe(false);
  });

  it('knows the picture sources apart from the microphone alone', () => {
    expect(SourceSet.of(true, false, false).hasPicture).toBe(true);
    expect(SourceSet.of(false, true, false).hasPicture).toBe(true);
    expect(SourceSet.of(false, false, true).hasPicture).toBe(false);
    expect(SourceSet.of(false, false, true).soundOnly).toBe(true);
    expect(SourceSet.of(true, false, true).soundOnly).toBe(false);
    expect(SourceSet.of(false, true, true).soundOnly).toBe(false);
  });

  it('keeps the three toggles independent', () => {
    const all = SourceSet.NONE.withScreen(true).withWebcam(true).withMic(true);
    expect(all.screen).toBe(true);
    expect(all.webcam).toBe(true);
    expect(all.mic).toBe(true);

    const screenOnly = all.withWebcam(false).withMic(false);
    expect(screenOnly.screen).toBe(true);
    expect(screenOnly.webcam).toBe(false);
    expect(screenOnly.mic).toBe(false);
  });

  it('shares the empty set', () => {
    expect(SourceSet.of(false, false, false)).toBe(SourceSet.NONE);
  });

  it('compares by value', () => {
    expect(SourceSet.of(true, false, true).equals(SourceSet.of(true, false, true))).toBe(true);
    expect(SourceSet.of(true, false, false).equals(SourceSet.NONE)).toBe(false);
  });
});
