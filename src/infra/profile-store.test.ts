import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadProfiles, saveProfiles } from './profile-store.js';
import type { StoredProfiles } from '../domain/profile/Profiles.js';

// The localStorage adapter, proved in node with a fake storage: it holds no rules, so
// what matters is that a written book comes back unchanged and that anything unusable
// reads as nothing.

const KEY = 'democlip_profiles';

class FakeStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

const book = (): StoredProfiles => ({
  version: 1,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', values: {} },
    { id: 'tv', name: 'DemoClipTV', values: { addToExport: 'true' } },
  ],
});

beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage(); });
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

describe('the profile store', () => {
  it('reads nothing back when nothing was written', async () => {
    expect(await loadProfiles()).toBeNull();
  });

  it('gives back what it was given, whole', async () => {
    await saveProfiles(book());
    expect(await loadProfiles()).toEqual(book());
  });

  it('reads nothing back from an unusable record', async () => {
    localStorage.setItem(KEY, 'not json at all');
    expect(await loadProfiles()).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ version: 99, activeId: 'x', profiles: [] }));
    expect(await loadProfiles()).toBeNull();

    localStorage.setItem(KEY, JSON.stringify('just a string'));
    expect(await loadProfiles()).toBeNull();
  });

  it('reports a write the browser will not take', async () => {
    const refusing = new FakeStorage();
    refusing.setItem = () => { throw new Error('QuotaExceededError'); };
    (globalThis as { localStorage?: unknown }).localStorage = refusing;
    await expect(saveProfiles(book())).rejects.toThrow('QuotaExceededError');
  });
});
