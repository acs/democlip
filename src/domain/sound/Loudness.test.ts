import { describe, expect, it } from 'vitest';

import { LoudnessMeter, measure } from './Loudness.js';

// The measurement, proved in node against the standard's own signals. ITU-R BS.1770 says a
// full-scale 1 kHz sine measures −3.01 LUFS, and the same sine 20 dB down −23.01 LUFS; the
// rest of these hold the pieces the rule is built from — the peak, the gates, and that a
// sound fed in a chunk at a time measures as the whole.

const RATE = 48_000;

/** A sine, which is what the standard's own test signals are. */
function sine(seconds: number, amplitude = 1, frequency = 1000, rate = RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / rate);
  return out;
}

describe('Loudness.measure', () => {
  it('measures a full-scale 1 kHz sine at about −3.01 LUFS, the standard’s own number', () => {
    const { lufs, peakDb } = measure([sine(3)], RATE);
    expect(lufs).toBeCloseTo(-3.01, 1);
    expect(peakDb).toBeCloseTo(0, 3);
  });

  it('measures the same sine 20 dB down at about −23.01 LUFS', () => {
    const { lufs } = measure([sine(3, 0.1)], RATE);
    expect(lufs).toBeCloseTo(-23.01, 1);
  });

  it('tells frequency apart, which is what the weighting is for: a low rumble reads quieter', () => {
    const voice = measure([sine(3, 0.3, 1000)], RATE).lufs;
    const rumble = measure([sine(3, 0.3, 40)], RATE).lufs;
    expect(rumble).toBeLessThan(voice - 3);
  });

  it('answers silence with no loudness and no peak — the gate has nothing to keep', () => {
    const { lufs, peakDb } = measure([new Float32Array(RATE)], RATE);
    expect(lufs).toBe(-Infinity);
    expect(peakDb).toBe(-Infinity);
  });

  it('answers an empty sound with silence rather than throwing', () => {
    expect(measure([new Float32Array(0)], RATE)).toEqual({ lufs: -Infinity, peakDb: -Infinity });
    expect(measure([], RATE)).toEqual({ lufs: -Infinity, peakDb: -Infinity });
  });

  it('reads the peak off the sound itself, before the weighting', () => {
    const sound = sine(2, 0.4);
    sound[1000] = 0.9;                       // a click the weighting would soften
    expect(measure([sound], RATE).peakDb).toBeCloseTo(20 * Math.log10(0.9), 3);
  });

  it('measures a sound shorter than one 400 ms window by the window it does fill', () => {
    const { lufs } = measure([sine(0.2)], RATE);
    expect(Number.isFinite(lufs)).toBe(true);
    expect(lufs).toBeCloseTo(-3.01, 1);
  });

  it('measures two channels of the same signal three decibels above one, as the standard counts them', () => {
    const mono = measure([sine(3, 0.3)], RATE).lufs;
    const stereo = measure([sine(3, 0.3), sine(3, 0.3)], RATE).lufs;
    expect(stereo).toBeCloseTo(mono + 3, 1);
  });

  it('measures a sound fed in a chunk at a time as the whole of it', () => {
    const left = sine(3, 0.5, 700);
    const right = sine(3, 0.4, 900);
    const whole = measure([left, right], RATE);

    const meter = new LoudnessMeter(RATE, 2);
    const step = 4000;
    for (let at = 0; at < left.length; at += step) {
      meter.push([left.subarray(at, at + step), right.subarray(at, at + step)]);
    }
    const fed = meter.result();

    expect(fed.peakDb).toBeCloseTo(whole.peakDb, 6);
    expect(fed.lufs).toBeCloseTo(whole.lufs, 3);
  });
});
