// Reading back what the app wrote.
//
// A check that asserts on a file's own bytes shares this: pick a target in the Export
// menu, then decode the file in the page — its duration and its video track's size, or a
// band of a frame at a moment — so only the numbers an expectation is stated in come
// back. The decoding is a browser job (a `<video>` and a canvas), which is why it runs in
// the page rather than in the runner.

import { type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pageModule } from './page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** A band of the picture, as fractions of it. */
export interface Band {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The whole picture. */
export const WHOLE: Band = { x: 0, y: 0, width: 1, height: 1 };

/** Pick a target in the Export menu and read the downloaded bytes. */
export async function exportFile(page: Page, item: string): Promise<Buffer> {
  await page.locator('#btn-exp').click();
  const download = page.waitForEvent('download');
  await page.locator(item).click();
  const file = await download;
  const path = await file.path();
  if (!path) throw new Error('the export wrote no file');
  return readFile(path);
}

/** A file's own metadata: its duration, and the size of its video track. */
export async function probeFile(
  page: Page,
  bytes: Buffer,
  mime: string,
): Promise<{ duration: number; width: number; height: number }> {
  return page.evaluate(async ({ base64, type }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([data], { type }));
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const read = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    URL.revokeObjectURL(url);
    return read;
  }, { base64: bytes.toString('base64'), type: mime });
}

/** Whether a file's sound can be decoded — a sound-only export has one, a picture-only file does not. */export async function hasSound(page: Page, bytes: Buffer): Promise<boolean> {
  return page.evaluate(async (base64) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const context = new OfflineAudioContext(1, 1, 48_000);
    try {
      await context.decodeAudioData(data.buffer);
      return true;
    } catch {
      return false;
    }
  }, bytes.toString('base64'));
}

/**
 * A file's own loudness and peak, measured with the app's own rule — the same `Loudness`
 * module the export and the review use, so a check reads the real number rather than a
 * second implementation of it. A value that is not finite (silence) comes back as -999,
 * because a number that is not a number does not cross into the runner.
 */
export async function loudnessOf(page: Page, bytes: Buffer): Promise<{ lufs: number; peakDb: number }> {
  return page.evaluate(async ({ base64, url }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const context = new OfflineAudioContext(2, 1, 48_000);
    const audio = await context.decodeAudioData(data.buffer);
    const { measure } = await import(/* @vite-ignore */ url);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
    const measured = measure(channels, audio.sampleRate);
    return {
      lufs: Number.isFinite(measured.lufs) ? measured.lufs : -999,
      peakDb: Number.isFinite(measured.peakDb) ? measured.peakDb : -999,
    };
  }, { base64: bytes.toString('base64'), url: HOOKS });
}

/**
 * The bytes of a take the app is holding — the **recording itself**, before any export and so
 * before the sound boost has had it. A check that reads what the mix came to, rather than what
 * a file came to, needs this one.
 */
export async function takeBytes(page: Page, index = 0): Promise<Buffer> {
  const base64 = await page.evaluate(async ({ url, at }) => {
    const { session } = await import(/* @vite-ignore */ url);
    const take = session.clip.takes.at(at);
    if (!take) return '';
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(take.blob);
    });
  }, { url: HOOKS, at: index });
  return Buffer.from(base64, 'base64');
}

/**
 * How loud one tone is in a sound, as its amplitude. The sound is cut into windows and the
 * signal correlated with a sine of that frequency over a whole number of its periods in each,
 * which is exact for a steady tone and blind to the others in the mix as long as they are not
 * harmonics of it. The answer is the **median** of the windows: the level that tone holds at.
 *
 * Not one average over the whole sound. A take's first moments carry the encoder's ramp, a
 * source's own audio can dip, and either drags an average down until a correct mix reads as a
 * quiet one — which is exactly what made the check that reads a voice against a shared tab's
 * audio fail about once in five runs, at 0.26 where the mix holds 0.40. The median ignores a
 * window or two of noise at either end, so what a check compares is the level the two constants
 * in the mix decide.
 */
export async function toneLevel(page: Page, bytes: Buffer, hz: number): Promise<number> {
  return page.evaluate(async ({ base64, hz }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const context = new OfflineAudioContext(1, 1, 48_000);
    const audio = await context.decodeAudioData(data.buffer);
    const samples = audio.getChannelData(0);

    /** This tone's amplitude in one stretch, over a whole number of its periods. */
    const levelOf = (from: number, to: number): number => {
      const period = audio.sampleRate / hz;
      const periods = Math.floor((to - from) / period);
      if (!(periods > 1)) return 0;
      const count = Math.floor(periods * period);
      let real = 0;
      let imaginary = 0;
      for (let i = 0; i < count; i++) {
        const angle = (i / audio.sampleRate) * hz * 2 * Math.PI;
        real += samples[from + i] * Math.cos(angle);
        imaginary += samples[from + i] * Math.sin(angle);
      }
      return (2 * Math.hypot(real, imaginary)) / count;
    };

    const windows = 8;
    const span = Math.floor(samples.length / windows);
    if (!(span > 1)) return 0;
    const levels = Array.from({ length: windows }, (_, at) => levelOf(at * span, (at + 1) * span))
      .sort((a, b) => a - b);
    const middle = levels.length / 2;
    return (levels[middle - 1]! + levels[middle]!) / 2;
  }, { base64: bytes.toString('base64'), hz });
}

/**
 * Decode a file at a moment and count the pixels of a band of the frame: `light`, the
 * near-white ones (the words a card draws), and `painted`, the ones the picture put
 * there at all — so a frame that failed to decode cannot pass for an empty one.
 */
export async function frameCounts(
  page: Page,
  bytes: Buffer,
  mime: string,
  at: number,
  box: Band = WHOLE,
): Promise<{ light: number; painted: number; width: number; height: number }> {
  return page.evaluate(async ({ base64, type, at, box }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([data], { type }));
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    video.currentTime = at;
    await new Promise<void>(resolve => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(video, 0, 0);
    const pixels = context.getImageData(
      Math.round(box.x * canvas.width),
      Math.round(box.y * canvas.height),
      Math.round(box.width * canvas.width),
      Math.round(box.height * canvas.height),
    ).data;
    let light = 0;
    let painted = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) light++;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 40) painted++;
    }
    URL.revokeObjectURL(url);
    return { light, painted, width: canvas.width, height: canvas.height };
  }, { base64: bytes.toString('base64'), type: mime, at, box });
}

/**
 * Decode the same moment of two files and count the pixels of a band that differ. It
 * says nothing about what colour a mark is, only that the band is not the same picture —
 * so any mark the app ships is held to the same standard.
 */
export async function frameDiff(
  page: Page,
  a: Buffer,
  b: Buffer,
  mime: string,
  at: number,
  box: Band = WHOLE,
): Promise<number> {
  return page.evaluate(async ({ left, right, type, at, box }) => {
    const frameAt = async (base64: string): Promise<ImageData> => {
      const binary = atob(base64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([data], { type: type as string }));
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.src = url;
      await new Promise<void>(resolve => {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
      video.currentTime = at;
      await new Promise<void>(resolve => {
        video.addEventListener('seeked', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(video, 0, 0);
      URL.revokeObjectURL(url);
      return context.getImageData(
        Math.round(box.x * canvas.width),
        Math.round(box.y * canvas.height),
        Math.round(box.width * canvas.width),
        Math.round(box.height * canvas.height),
      );
    };
    const one = await frameAt(left);
    const two = await frameAt(right);
    let differs = 0;
    for (let i = 0; i < one.data.length; i += 4) {
      if (Math.abs(one.data[i] - two.data[i]) > 60
        || Math.abs(one.data[i + 1] - two.data[i + 1]) > 60
        || Math.abs(one.data[i + 2] - two.data[i + 2]) > 60) differs++;
    }
    return differs;
  }, { left: a.toString('base64'), right: b.toString('base64'), type: mime, at, box });
}

/**
 * A file's sound energy in one window of it, as its RMS amplitude. The check a sound annotation
 * needs reads **where** a sound landed and compares it with the recording alone: the window the
 * sound plays over is louder than a window it does not, and two files differing only by the
 * annotation carry the same energy where the sound is not.
 */
export async function rmsIn(page: Page, bytes: Buffer, from: number, to: number): Promise<number> {
  return page.evaluate(async ({ base64, from, to }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const context = new OfflineAudioContext(2, 1, 48_000);
    const audio = await context.decodeAudioData(data.buffer);
    const samples = audio.getChannelData(0);
    const a = Math.max(0, Math.floor(from * audio.sampleRate));
    const b = Math.min(samples.length, Math.floor(to * audio.sampleRate));
    if (!(b > a)) return 0;
    let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / (b - a));
  }, { base64: bytes.toString('base64'), from, to });
}
