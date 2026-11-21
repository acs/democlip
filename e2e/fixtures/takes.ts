// Fixture takes, from the test side.
//
// The encoding happens in page context (encode-take.ts), because WebCodecs and a
// canvas are browser APIs. The blobs stay in the page — a check seeds the clip from
// them there — and the test holds only their metadata.

import type { Page } from '@playwright/test';
import { pageModule } from '../helpers/page-module.js';

export interface FixtureSpec {
  width: number;
  height: number;
  seconds: number;
  fps?: number;
  hasAudio?: boolean;
  pattern?: string;
}

/** A take built in the page: its metadata, and where its blob is kept. */
export interface FixtureTake {
  /** Its position in the page's take store, for `boot.seed`. */
  index: number;
  seconds: number;
  shape: string;
  hasAudio: boolean;
}

interface PageWindow {
  __e2eTakes?: Array<{ blob: Blob; seconds: number; shape: string; hasAudio: boolean }>;
}

/** Build one deterministic take in the page. Resolves in milliseconds. */
export async function makeTake(page: Page, spec: FixtureSpec): Promise<FixtureTake> {
  const [take] = await makeTakes(page, spec);
  return take;
}

/** Build several takes in the page, for a multi-take clip. */
export async function makeTakes(page: Page, ...specs: FixtureSpec[]): Promise<FixtureTake[]> {
  const url = pageModule('e2e/fixtures/encode-take.ts');
  return page.evaluate(async ({ specs, url }) => {
    const mod = await import(/* @vite-ignore */ url);
    const store = ((window as unknown as PageWindow).__e2eTakes ??= []);
    const metas: FixtureTake[] = [];
    for (const spec of specs) {
      const take = await mod.encodeTake(spec);
      const index = store.push(take) - 1;
      metas.push({ index, seconds: take.seconds, shape: take.shape, hasAudio: take.hasAudio });
    }
    return metas;
  }, { specs, url });
}

/** A real video file, as bytes, to hand to a file input — as a person would. */
export interface FixtureFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Build a decodable video file in the page and bring its bytes back, so a check can
 * hand it to an `<input type="file">`. The page encodes it (WebCodecs and a canvas are
 * browser APIs) and returns it as base64; the file itself is the check's.
 */
export async function makeFile(
  page: Page,
  options: FixtureSpec & { name: string; mimeType: string },
): Promise<FixtureFile> {
  const { name, mimeType, ...spec } = options;
  const url = pageModule('e2e/fixtures/encode-take.ts');
  const base64 = await page.evaluate(async ({ spec, url }) => {
    const mod = await import(/* @vite-ignore */ url);
    const take = await mod.encodeTake(spec);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(take.blob);
    });
  }, { spec, url });
  return { name, mimeType, buffer: Buffer.from(base64, 'base64') };
}
