// The profiles: the book of them, and which one is active.
//
// It is the one place that knows the rules about *several* profiles — that the built-in
// default is always there and cannot go, that removing the active one falls back rather
// than leaving the app with none, and that a name cannot be emptied. `Profile` holds what
// one profile is; this holds what is true of the set.
//
// Nothing here reaches for storage or the browser: the app keeps the book in memory and
// writes it down through a port (the same split `RecordingStorePort` uses for a recording). What
// it reads back is treated as untrusted — a person's browser holds it, and it may be old
// or written by another version — so `of` repairs what it can and never throws.

import { Profile, type StoredProfile } from './Profile.js';

/** The shape this build writes and reads; another version is not guessed at. */
export const PROFILES_FORMAT = 2;

export interface StoredProfiles {
  version: number;
  activeId: string;
  profiles: StoredProfile[];
}

const DEFAULT_NAME = 'Default';

export class Profiles {
  /** The built-in default's id: the profile the app always has. */
  static readonly DEFAULT_ID = 'default';

  private constructor(
    readonly all: readonly Profile[],
    readonly activeId: string,
  ) {}

  /** The app with nothing set up: the built-in default alone, and active. */
  static starting(): Profiles {
    return new Profiles([defaultProfile()], Profiles.DEFAULT_ID);
  }

  /**
   * Read a written book back. Every entry is untrusted: a profile that cannot be named is
   * dropped, an entry claiming the built-in default's id is the app's own default, and an
   * `activeId` that names nothing lands on the default — so the book is never empty and
   * always has one active profile.
   */
  static of(stored: StoredProfiles | null | undefined): Profiles {
    if (!stored || typeof stored !== 'object' || !Array.isArray(stored.profiles)) return Profiles.starting();

    const seen = new Set<string>();
    const kept: Profile[] = [];
    for (const raw of stored.profiles) {
      const profile = Profile.restore(raw);
      // The built-in default is the app's own: a stored entry with its id is not taken
      // for it (it could have been renamed or given settings), so it is replaced below.
      if (!profile || profile.id === Profiles.DEFAULT_ID || seen.has(profile.id)) continue;
      seen.add(profile.id);
      kept.push(profile);
    }

    const all = [defaultProfile(), ...kept];
    const activeId = all.some(profile => profile.id === stored.activeId) ? stored.activeId : Profiles.DEFAULT_ID;
    return new Profiles(all, activeId);
  }

  /** The profile the app is working under. There is always one. */
  active(): Profile {
    return this.get(this.activeId) ?? this.all[0]!;
  }

  /**
   * The active profile when it controls this item, or null when the item is the person's —
   * which is what makes an item the person cannot change, in the one place both the panel
   * and the automation surface ask.
   */
  controlling(id: string): Profile | null {
    const active = this.active();
    return active.declares(id) ? active : null;
  }

  has(id: string): boolean {
    return this.all.some(profile => profile.id === id);
  }

  /** One by id, or null for one this book does not hold. */
  get(id: string): Profile | null {
    return this.all.find(profile => profile.id === id) ?? null;
  }

  /** Make one active, or null when there is no such profile. */
  choose(id: string): Profiles | null {
    return this.has(id) ? new Profiles(this.all, id) : null;
  }

  /** Add one, or null when its id is already taken. */
  add(profile: Profile): Profiles | null {
    if (this.has(profile.id)) return null;
    return new Profiles([...this.all, profile], this.activeId);
  }

  /** Rename one of the person's own profiles, or null when it cannot be renamed. */
  rename(id: string, name: string): Profiles | null {
    if (id === Profiles.DEFAULT_ID) return null;
    const current = this.get(id);
    const renamed = current?.renamed(name);
    if (!renamed) return null;
    return new Profiles(this.all.map(profile => (profile.id === id ? renamed : profile)), this.activeId);
  }

  /**
   * Put one item under this profile's control, fixed at `value` — or take it out of the
   * profile's control with `null`, so the person has it again. null also answers an unknown
   * profile.
   */
  declare(id: string, property: string, value: string | null): Profiles | null {
    const current = this.get(id);
    if (!current) return null;
    const changed = value === null ? current.free(property) : current.declare(property, value);
    return new Profiles(this.all.map(profile => (profile.id === id ? changed : profile)), this.activeId);
  }

  /**
   * Take one of the person's own profiles away, or null when it cannot go. When the one
   * removed was active, the built-in default becomes active, so the app is never left
   * without a profile to work under.
   */
  remove(id: string): Profiles | null {
    if (id === Profiles.DEFAULT_ID) return null;
    if (!this.has(id)) return null;
    const all = this.all.filter(profile => profile.id !== id);
    const activeId = this.activeId === id ? Profiles.DEFAULT_ID : this.activeId;
    return new Profiles(all, activeId);
  }

  /** The book as it is written down. */
  stored(): StoredProfiles {
    return {
      version: PROFILES_FORMAT,
      activeId: this.activeId,
      profiles: this.all.map(profile => profile.stored()),
    };
  }
}

/** The built-in default: no settings, a fixed name, and always present. */
function defaultProfile(): Profile {
  return Profile.create(Profiles.DEFAULT_ID, DEFAULT_NAME)!;
}
