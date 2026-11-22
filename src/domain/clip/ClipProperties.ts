// The clip's own properties: what a clip says about itself — its title and its
// description — rather than what is drawn over its picture.
//
// It is the annotation seam one level up. An annotation's properties live with the
// annotation and are declared by its kind; a clip's live with the clip and are declared
// by the app (`ui/clip/clip-properties.ts`), which is the same split. What is here is
// only the value: a small map of named strings, kept so the shape cannot drift and
// written down with the clip so it comes back after a reload.
//
// Nothing here is a fraction and nothing is scaled when the clip grows: a title is the
// same title however long the recording is.

export class ClipProperties {
  private constructor(readonly values: Readonly<Record<string, string>>) {}

  static readonly EMPTY = new ClipProperties({});

  /**
   * The properties as written down. Anything that is not a named string is dropped, and
   * an empty value is left out, so "unset" has one representation — which is what a clip
   * written by a later version, or by hand, reads back as.
   */
  static of(values?: Readonly<Record<string, string>> | null): ClipProperties {
    if (!values || typeof values !== 'object') return ClipProperties.EMPTY;
    const kept: Record<string, string> = {};
    for (const [id, value] of Object.entries(values)) {
      if (id && typeof value === 'string' && value !== '') kept[id] = value;
    }
    return Object.keys(kept).length > 0 ? new ClipProperties(kept) : ClipProperties.EMPTY;
  }

  /** What a property holds, or '' when it was never set. */
  get(id: string): string {
    return this.values[id] ?? '';
  }

  /** The same properties with one set. An empty value clears it. */
  with(id: string, value: string): ClipProperties {
    const next = { ...this.values };
    if (value === '') delete next[id];
    else next[id] = value;
    return new ClipProperties(next);
  }

  /** The properties as a plain record, for writing the clip down. */
  toRecord(): Record<string, string> {
    return { ...this.values };
  }
}
