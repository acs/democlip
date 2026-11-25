import { describe, expect, it } from 'vitest';

import { BOOST_ID, OFF, PEAK_CEILING_DBFS, TARGET_LUFS, boostsSound, gainFor } from './SoundBoost.js';
import { ClipProperties } from '../clip/ClipProperties.js';

// The rule, proved in node: the switch's default and its stored off, and the gain that brings
// a measured sound to the target without letting its peak past the ceiling.

const peakOf = (gain: number, peakDb: number) => peakDb + 20 * Math.log10(gain);

describe('SoundBoost', () => {
  it('is on for a clip that never set the switch, and off only when the clip says so', () => {
    expect(boostsSound(ClipProperties.EMPTY)).toBe(true);
    expect(boostsSound(ClipProperties.EMPTY.with(BOOST_ID, 'true'))).toBe(true);
    expect(boostsSound(ClipProperties.EMPTY.with(BOOST_ID, OFF))).toBe(false);
    expect(boostsSound(ClipProperties.EMPTY.with(BOOST_ID, 'anything else'))).toBe(true);
  });

  it('lifts a quiet recording to the target when its peak leaves room', () => {
    const gain = gainFor(-30, -40);
    expect(gain).toBeGreaterThan(1);
    expect(-30 + 20 * Math.log10(gain)).toBeCloseTo(TARGET_LUFS, 6);
  });

  it('brings a loud recording down to the target, which is what makes a set of clips one loudness', () => {
    const gain = gainFor(-10, -2);
    expect(gain).toBeLessThan(1);
    expect(-10 + 20 * Math.log10(gain)).toBeCloseTo(TARGET_LUFS, 6);
  });

  it('lifts a recording only as far as its peak allows, never past the ceiling', () => {
    const gain = gainFor(-30, -6);
    // The target would need more than the peak has room for, so the ceiling decides.
    expect(peakOf(gain, -6)).toBeCloseTo(PEAK_CEILING_DBFS, 6);
    expect(peakOf(gain, -6)).toBeLessThanOrEqual(PEAK_CEILING_DBFS + 1e-9);
  });

  it('answers silence with no gain at all — there is nothing to bring up', () => {
    expect(gainFor(-Infinity, -Infinity)).toBe(1);
    expect(gainFor(-Infinity, -90)).toBe(1);
  });

  it('ignores a peak it cannot know, rather than refusing the sound', () => {
    const gain = gainFor(-30, -Infinity);
    expect(-30 + 20 * Math.log10(gain)).toBeCloseTo(TARGET_LUFS, 6);
  });
});
