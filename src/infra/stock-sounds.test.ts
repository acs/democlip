import { describe, expect, it, vi } from 'vitest';

import { StockSoundStore } from './stock-sounds.js';

/** A stand-in for a decoded sound; the store only holds it and hands it back. */
const fakeBuffer = (tag: string) => ({ tag } as unknown as AudioBuffer);

describe('the stock sound store', () => {
  it('decodes a sound once and caches it by name', async () => {
    const decode = vi.fn(async () => fakeBuffer('chime'));
    const store = new StockSoundStore(decode);

    const a = await store.buffer('chime');
    const b = await store.buffer('chime');
    expect(a).toBe(b);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(store.get('chime')).toBe(a);
    expect(store.get('gong')).toBeNull();          // not asked for yet
  });

  it('answers null for a name the app does not serve, and never decodes it', async () => {
    const decode = vi.fn(async () => fakeBuffer('x'));
    const store = new StockSoundStore(decode);
    expect(await store.buffer('applause')).toBeNull();
    expect(decode).not.toHaveBeenCalled();
  });

  it('answers null when a sound will not read, and caches that', async () => {
    const decode = vi.fn(async () => { throw new Error('no decode'); });
    const store = new StockSoundStore(decode);
    expect(await store.buffer('gong')).toBeNull();
    expect(await store.buffer('gong')).toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);        // the failure is cached too
  });

  it('resolves ready() once the sounds it was asked for are decoded', async () => {
    const store = new StockSoundStore(async () => fakeBuffer('gong'));
    void store.buffer('gong');
    await store.ready();
    expect(store.get('gong')).not.toBeNull();
  });
});
