// A profile: a named set of the app's configuration a person works under.
//
// It does not hold *defaults*; it holds **declarations**. A profile says which items it
// controls, and the value each of them is fixed at — and while that profile is active, an
// item it controls is applied to the app and **cannot be changed by the person**. An item it
// does not control is free, exactly as it is with no profile at all. A profile that declares
// nothing is therefore a free profile, and the built-in **Empty** is that profile.
//
// A declaration is a named string, and a key present is what makes it a declaration: the
// value may be empty, because for a boolean item empty *is* the off value. That is the one
// place where "declared" and "empty" have to be told apart — `ClipProperties` folds an empty
// value to unset, and this does not.
//
// It holds no rule about *which* items exist. The app declares those, as it declares the clip
// properties a profile may control (`ui/clip/clip-properties.ts`), and a declaration for one
// this build does not know is **kept and never applied**, so a profile written by a later
// version still reads.

export interface StoredProfile {
  id: string;
  name: string;
  /** The items this profile controls, and the value each is fixed at. A key present is a declaration. */
  controls: Record<string, string>;
}

export class Profile {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly controls: Readonly<Record<string, string>>,
  ) {}

  /**
   * A profile with this id and name, or null when either is not usable: the id must be a
   * non-empty string, and the name must still have something in it once trimmed.
   */
  static create(id: string, name: string, controls?: Readonly<Record<string, string>> | null): Profile | null {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (typeof id !== 'string' || id === '' || trimmed === '') return null;
    return new Profile(id, trimmed, clean(controls));
  }

  /** Read a profile back, or null when the record cannot name one. */
  static restore(stored: StoredProfile | null | undefined): Profile | null {
    if (!stored || typeof stored !== 'object') return null;
    return Profile.create(stored.id, stored.name, stored.controls);
  }

  /** Does this profile control this item? */
  declares(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.controls, id);
  }

  /** What this profile fixes an item at, or null when it does not control it. May be ''. */
  valueFor(id: string): string | null {
    return this.declares(id) ? this.controls[id]! : null;
  }

  /** The same profile with one more item under its control, fixed at `value` (which may be ''). */
  declare(id: string, value: string): Profile {
    return new Profile(this.id, this.name, { ...this.controls, [id]: value });
  }

  /** The same profile with one item let go of, so it is the person's again. */
  free(id: string): Profile {
    const next = { ...this.controls };
    delete next[id];
    return new Profile(this.id, this.name, next);
  }

  /** The same profile under another name, or null for one with nothing in it. */
  renamed(name: string): Profile | null {
    return Profile.create(this.id, name, this.controls);
  }

  /** The profile as it is written down. */
  stored(): StoredProfile {
    return { id: this.id, name: this.name, controls: { ...this.controls } };
  }
}

/**
 * Named string values only. A key present is a declaration and is **kept even when its value
 * is empty**, because empty is what a controlled boolean is fixed at when it is fixed off.
 */
function clean(controls?: Readonly<Record<string, string>> | null): Readonly<Record<string, string>> {
  if (!controls || typeof controls !== 'object') return {};
  const kept: Record<string, string> = {};
  for (const [id, value] of Object.entries(controls)) {
    if (id && typeof value === 'string') kept[id] = value;
  }
  return kept;
}
