// A profile: a named set of the app's configuration a person works under.
//
// It is a value object rather than a plain interface, because it has rules: a name that
// cannot be empty, and a setting that may be **unset** as distinct from empty. A profile
// lives outside any clip, so it outlives the clip, the page and the session — what
// `Profiles` writes down and the store keeps.
//
// It holds no rule about *which* settings exist. The app declares those, as it declares
// the clip properties a profile may preload (`ui/clip/clip-properties.ts`), and a setting
// for one this build does not know is **kept and never applied**, so a profile written by
// a later version still reads and one written earlier still opens.

export interface StoredProfile {
  id: string;
  name: string;
  values: Record<string, string>;
}

export class Profile {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly values: Readonly<Record<string, string>>,
  ) {}

  /**
   * A profile with this id and name, or null when either is not usable: the id must be a
   * non-empty string, and the name must still have something in it once trimmed.
   */
  static create(id: string, name: string, values?: Readonly<Record<string, string>> | null): Profile | null {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (typeof id !== 'string' || id === '' || trimmed === '') return null;
    return new Profile(id, trimmed, clean(values));
  }

  /** Read a profile back, or null when the record cannot name one. */
  static restore(stored: StoredProfile | null | undefined): Profile | null {
    if (!stored || typeof stored !== 'object') return null;
    return Profile.create(stored.id, stored.name, stored.values);
  }

  /** The setting this profile gives a property, or null when it says nothing about it. */
  valueFor(id: string): string | null {
    return this.values[id] ?? null;
  }

  /** The same profile with one setting; an empty value clears it. */
  with(id: string, value: string): Profile {
    const next = { ...this.values };
    if (value === '') delete next[id];
    else next[id] = value;
    return new Profile(this.id, this.name, next);
  }

  /** The same profile under another name, or null for one with nothing in it. */
  renamed(name: string): Profile | null {
    return Profile.create(this.id, name, this.values);
  }

  /** The profile as it is written down. */
  stored(): StoredProfile {
    return { id: this.id, name: this.name, values: { ...this.values } };
  }
}

/**
 * Named string values only, with an empty value left out — so "unset" has one
 * representation, which is what a clip property does and what a profile written by hand
 * or by another version reads back as.
 */
function clean(values?: Readonly<Record<string, string>> | null): Readonly<Record<string, string>> {
  if (!values || typeof values !== 'object') return {};
  const kept: Record<string, string> = {};
  for (const [id, value] of Object.entries(values)) {
    if (id && typeof value === 'string' && value !== '') kept[id] = value;
  }
  return kept;
}
