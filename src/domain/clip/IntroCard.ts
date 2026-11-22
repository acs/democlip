// The title card an export may put at its head: the clip's first frame held still, with
// what the clip says about itself — its **title** and its **description** — drawn over it.
//
// It is the clip's own, like a **clip property**, and it is a **value**: how long the
// card lasts and which words it shows, decided before anything is encoded, so a plan
// can carry it and be read without a browser. A card with nothing to say is not a card
// — `of` answers null — so an empty title and description never put a blank three
// seconds at the head of a file.

export class IntroCard {
  private constructor(
    /** The line shown first and largest. May be empty when only a description is set. */
    readonly title: string,
    /** The words beneath it. May be empty when only a title is set. */
    readonly description: string,
    /** How long the card lasts, in seconds. */
    readonly seconds: number,
  ) {}

  /**
   * The card a clip's words make, or null when there is nothing to show (both empty) or
   * no time to show it in.
   */
  static of(title: string, description: string, seconds: number): IntroCard | null {
    if (!(seconds > 0)) return null;
    const t = title.trim();
    const d = description.trim();
    if (!t && !d) return null;
    return new IntroCard(t, d, seconds);
  }
}
