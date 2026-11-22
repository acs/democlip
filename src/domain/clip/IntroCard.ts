// The title card an export may put at its head: the clip's first frame held still, with
// what the clip says about itself — its **title** and its **description** — drawn over it,
// and, under them, the day the card was made and the app's name.
//
// It is the clip's own, like a **clip property**, and it is a **value**: how long the
// card lasts and which words it shows, decided before anything is encoded, so a plan
// can carry it and be read without a browser. The day line is always there, so a card
// with nothing else to say still shows where it came from; only a card with no time to
// be shown in is no card.

export class IntroCard {
  private constructor(
    /** The line shown first and largest. May be empty when only a description is set. */
    readonly title: string,
    /** The words beneath it. May be empty when only a title is set. */
    readonly description: string,
    /** The line under them all: the day, and the app's name. Never empty. */
    readonly stamp: string,
    /** How long the card lasts, in seconds. */
    readonly seconds: number,
  ) {}

  /**
   * The card a clip's words make for the day it is made, or null when there is no time
   * to show it in.
   */
  static of(title: string, description: string, when: Date, seconds: number): IntroCard | null {
    if (!(seconds > 0)) return null;
    return new IntroCard(title.trim(), description.trim(), stampOf(when), seconds);
  }
}

/** The line a card wears under its words: the day it was made, and the app's name. */
export function stampOf(when: Date): string {
  return `${dayOf(when)} - DemoClip`;
}

/** The day, in the person's own time, as `YYYY-MM-DD`. */
function dayOf(when: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}
