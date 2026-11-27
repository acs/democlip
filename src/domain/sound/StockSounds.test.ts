import { describe, expect, it } from 'vitest';

import { DEFAULT_STOCK_SOUND, STOCK_SOUNDS, SOUND_LEVEL, isStockSound, stockSound } from './StockSounds.js';

describe('the stock sounds', () => {
  it('holds the app’s chosen sounds and refuses a name it does not serve', () => {
    const names = STOCK_SOUNDS.map(sound => sound.name);
    for (const wanted of ['chime', 'gong', 'pluck', 'riser', 'thud', 'whoosh', 'wow']) {
      expect(names).toContain(wanted);
    }
    expect(isStockSound('chime')).toBe(true);
    expect(isStockSound('gong')).toBe(true);
    expect(isStockSound('applause')).toBe(false);
    // Names that were never shipped, or were thrown away, are refused.
    for (const gone of ['claps', 'bip', 'blip', 'click', 'pop', 'zap']) {
      expect(isStockSound(gone)).toBe(false);
    }
    expect(isStockSound(undefined)).toBe(false);
    expect(isStockSound(42)).toBe(false);
  });

  it('serves every sound from a path beside the app, not from the domain root', () => {
    for (const sound of STOCK_SOUNDS) {
      expect(sound.file).toBe(`./sounds/${sound.name}.wav`);
    }
    expect(stockSound('chime')?.file).toBe('./sounds/chime.wav');
    expect(stockSound('applause')).toBeNull();
  });

  it('names a default that is one of the list, and a level for the build', () => {
    expect(isStockSound(DEFAULT_STOCK_SOUND)).toBe(true);
    expect(DEFAULT_STOCK_SOUND).toBe('chime');
    expect(SOUND_LEVEL).toBeGreaterThan(0);
  });
});