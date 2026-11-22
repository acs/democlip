import { describe, expect, it } from 'vitest';

import { ManageProfiles } from './profiles.js';
import { Profiles, type StoredProfiles } from '../domain/profile/Profiles.js';
import type { ProfileStorePort } from './ports/ProfileStorePort.js';

// The use case: the capture lock and the writing down. The store is a fake so every rule
// and refusal can be read off without a browser; the domain's own rules are proved beside
// the domain, and this does not repeat them.

class FakeStore implements ProfileStorePort {
  saved: StoredProfiles | null = null;
  loadRefuses: boolean;
  saveRefuses: boolean;
  constructor(options: { written?: StoredProfiles | null; loadRefuses?: boolean; saveRefuses?: boolean } = {}) {
    this.saved = options.written ?? null;
    this.loadRefuses = options.loadRefuses ?? false;
    this.saveRefuses = options.saveRefuses ?? false;
  }
  load(): Promise<StoredProfiles | null> {
    return this.loadRefuses ? Promise.reject(new Error('the store refused')) : Promise.resolve(this.saved);
  }
  save(state: StoredProfiles): Promise<void> {
    if (this.saveRefuses) return Promise.reject(new Error('no room left'));
    this.saved = state;
    return Promise.resolve();
  }
}

interface Options {
  readonly written?: StoredProfiles | null;
  readonly capturing?: boolean;
  readonly loadRefuses?: boolean;
  readonly saveRefuses?: boolean;
  readonly warn?: (error: unknown) => void;
}

const manage = (options: Options = {}) => {
  const store = new FakeStore(options);
  let next = 1;
  const profiles = new ManageProfiles({
    store,
    capturing: () => options.capturing ?? false,
    newId: () => `p${next++}`,
    warn: options.warn,
  });
  return { profiles, store };
};

const written = (): StoredProfiles => ({
  version: 2,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', controls: {} },
    { id: 'tv', name: 'DemoClipTV', controls: { addToExport: 'true' } },
  ],
});

/** Create one and answer its id, for the tests that need a second profile. */
const make = (profiles: ManageProfiles, name: string): string => {
  const outcome = profiles.create(name);
  if (!outcome.ok) throw new Error(`could not create ${name}`);
  return outcome.id;
};

describe('ManageProfiles', () => {
  it('starts on its built-in default before anything is read', () => {
    expect(manage().profiles.current.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
  });

  it('reads the written book in', async () => {
    const { profiles } = manage({ written: written() });
    await profiles.load();
    expect(profiles.current.activeId).toBe('tv');
    expect(profiles.current.active().valueFor('addToExport')).toBe('true');
  });

  it('falls back to its built-in default when the book cannot be read', async () => {
    const warnings: unknown[] = [];
    const { profiles } = manage({ loadRefuses: true, warn: e => warnings.push(e) });
    await profiles.load();
    expect(profiles.current.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
    expect(warnings).toHaveLength(1);
  });

  it('chooses a profile when the session has not begun to capture, and writes it down', () => {
    const { profiles, store } = manage();
    const id = make(profiles, 'DemoClipTV');

    expect(profiles.choose(id)).toEqual({ ok: true, active: id });
    expect(profiles.current.activeId).toBe(id);
    expect(store.saved?.activeId).toBe(id);
  });

  it('refuses to choose once the session has begun to capture, leaving the book alone', () => {
    const { profiles } = manage({ capturing: true });
    const id = make(profiles, 'DemoClipTV');

    const refused = profiles.choose(id);
    expect(refused.ok).toBe(false);
    expect((refused as { reason: string }).reason).toMatch(/fixed once recording has started/);
    expect(profiles.current.activeId).toBe(Profiles.DEFAULT_ID);
  });

  it('lets a profile be created while capturing without becoming active', () => {
    const { profiles } = manage({ capturing: true });
    expect(profiles.create('DemoClipTV').ok).toBe(true);
    expect(profiles.current.all.map(p => p.name)).toEqual(['Default', 'DemoClipTV']);
    expect(profiles.current.activeId).toBe(Profiles.DEFAULT_ID);
  });

  it('refuses a profile with no name', () => {
    const { profiles } = manage({ capturing: true });
    expect(profiles.create('   ')).toEqual({ ok: false, reason: 'a profile needs a name' });
    expect(profiles.current.all).toHaveLength(1);
  });

  it('lets another profile be defined while capturing, but not the active one', async () => {
    const { profiles, store } = manage({ written: written(), capturing: true });
    await profiles.load();
    const other = make(profiles, 'GraditoneTV');

    expect(profiles.declare('tv', 'addToExport', null)).toEqual({
      ok: false,
      reason: 'A profile is fixed once recording has started — press New to start another session.',
    });
    expect(profiles.declare(other, 'addToExport', 'true')).toEqual({ ok: true, property: 'addToExport', value: 'true' });
    expect(profiles.current.get(other)?.valueFor('addToExport')).toBe('true');
    expect(profiles.current.get('tv')?.valueFor('addToExport')).toBe('true');   // unmoved
    expect(store.saved?.profiles.find(p => p.id === other)?.controls.addToExport).toBe('true');
  });

  it('hands an item back with null, so it is the person’s again', async () => {
    const { profiles } = manage({ written: written() });
    await profiles.load();
    expect(profiles.declare('tv', 'addToExport', null)).toEqual({ ok: true, property: 'addToExport', value: null });
    expect(profiles.current.controlling('addToExport')).toBeNull();
  });

  it('refuses to rename the built-in default, or to give a profile no name', () => {
    const { profiles } = manage();
    expect(profiles.rename(Profiles.DEFAULT_ID, 'Mine')).toEqual({
      ok: false,
      reason: 'the default profile cannot be renamed',
    });
    const id = make(profiles, 'DemoClipTV');
    expect(profiles.rename(id, '  ')).toEqual({ ok: false, reason: 'a profile needs a name' });
    expect(profiles.rename('nobody', 'X')).toEqual({ ok: false, reason: 'there is no profile called nobody' });
  });

  it('renames another profile while capturing, but not the active one', async () => {
    const { profiles } = manage({ written: written(), capturing: true });
    await profiles.load();
    const other = make(profiles, 'GraditoneTV');

    expect(profiles.rename(other, 'Graditone')).toEqual({ ok: true, id: other, name: 'Graditone' });
    expect(profiles.current.get(other)?.name).toBe('Graditone');
    expect(profiles.rename('tv', 'Renamed').ok).toBe(false);
  });

  it('refuses to remove the built-in default', () => {
    const { profiles } = manage();
    expect(profiles.remove(Profiles.DEFAULT_ID)).toEqual({
      ok: false,
      reason: 'the default profile cannot be removed',
    });
  });

  it('falls back to the built-in default when the active profile is removed', async () => {
    const { profiles } = manage({ written: written() });
    await profiles.load();
    expect(profiles.remove('tv')).toEqual({ ok: true, activeId: Profiles.DEFAULT_ID });
    expect(profiles.current.activeId).toBe(Profiles.DEFAULT_ID);
    expect(profiles.current.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
  });

  it('refuses to remove the active profile while capturing, but removes another', async () => {
    const { profiles } = manage({ written: written(), capturing: true });
    await profiles.load();
    const other = make(profiles, 'GraditoneTV');

    expect(profiles.remove('tv').ok).toBe(false);
    expect(profiles.remove(other)).toEqual({ ok: true, activeId: 'tv' });
    expect(profiles.current.has(other)).toBe(false);
  });

  it('keeps the change and says so when the book cannot be written down', () => {
    const warnings: unknown[] = [];
    const { profiles } = manage({ saveRefuses: true, warn: e => warnings.push(e) });
    expect(profiles.create('DemoClipTV').ok).toBe(true);
    expect(profiles.current.all).toHaveLength(2);
    // The save is attempted as the change is taken; a rejection is reported, not thrown.
    return Promise.resolve().then(() => {
      expect(warnings).toHaveLength(1);
    });
  });
});
