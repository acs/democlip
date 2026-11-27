// The profile a recording is made under, written down with the recording.
//
// A project names a **default** profile, and a recording starts under it. The recording
// may use another profile, chosen before it captures — but whichever profile is in force
// is written down here as a snapshot: its id, its name and the declarations it held at
// that moment. The snapshot is what the lock reads (`controls`), so editing, renaming or
// removing the profile afterwards never reaches a recording already made, and a reopened
// recording still says who fixes its items.
//
// This is a value object: it answers the same two questions `Profile` does (`declares`,
// `valueFor`) so the properties panel and the automation surface need one shape, and it
// carries no rule about which items exist.

import type { Profile } from '../profile/Profile.js';
import { Profiles } from '../profile/Profiles.js';

/** How a clip profile is written down; the shape a snapshot carries. */
export interface StoredClipProfile {
  id: string;
  name: string;
  /** The declarations, copied. A key present is a declaration; the value may be empty. */
  controls: Record<string, string>;
}

export class ClipProfile {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly controls: Readonly<Record<string, string>>,
  ) {}

  /** The app's free profile: what a recording written before projects reads as. */
  static readonly DEFAULT = new ClipProfile(Profiles.DEFAULT_ID, 'Default', {});

  /** A snapshot with this id and name, or null when either is not usable. */
  static create(id: string, name: string, controls?: Readonly<Record<string, string>> | null): ClipProfile | null {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (typeof id !== 'string' || id === '' || trimmed === '') return null;
    return new ClipProfile(id, trimmed, clean(controls));
  }

  /** The snapshot of a profile in the book, as it stands now. */
  static of(profile: Profile): ClipProfile {
    return new ClipProfile(profile.id, profile.name, { ...profile.controls });
  }

  /** Read one back, or null when the record cannot name one. */
  static restore(stored: StoredClipProfile | null | undefined): ClipProfile | null {
    if (!stored || typeof stored !== 'object') return null;
    return ClipProfile.create(stored.id, stored.name, stored.controls);
  }

  /** Does the profile in force declare this item? */
  declares(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.controls, id);
  }

  /** What it fixes the item at, or null when it does not declare it. */
  valueFor(id: string): string | null {
    return this.declares(id) ? this.controls[id]! : null;
  }

  /** Would choosing this change anything? Sameness is the whole snapshot, not just the id. */
  equals(other: ClipProfile): boolean {
    if (this.id !== other.id || this.name !== other.name) return false;
    const mine = Object.keys(this.controls);
    const theirs = Object.keys(other.controls);
    return mine.length === theirs.length && mine.every(id => this.controls[id] === other.controls[id]);
  }

  /** The snapshot as it is written down. */
  stored(): StoredClipProfile {
    return { id: this.id, name: this.name, controls: { ...this.controls } };
  }
}

function clean(controls?: Readonly<Record<string, string>> | null): Readonly<Record<string, string>> {
  if (!controls || typeof controls !== 'object') return {};
  const kept: Record<string, string> = {};
  for (const [id, value] of Object.entries(controls)) {
    if (id && typeof value === 'string') kept[id] = value;
  }
  return kept;
}