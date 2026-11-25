// The sounds the app ships for a sound annotation to play.
//
// A sound annotation's sound is the *name* of one of these, not bytes: the files live in the
// app's own `web/public/sounds/` and are served **beside** it, so nothing is uploaded and
// nothing is fetched from anywhere else, and a clip holds a name rather than a copy of a
// sound. The person cannot load, import or record one — the list is the app's, and it is
// data, so the domain can refuse a name it does not serve without reaching for the browser.
//
// The file is named **relative** to the app — `./sounds/...` — and not from the domain root,
// for the same reason the logos are (`src/ui/logos.ts`): the app is served at the root in
// development, under a project's path on GitHub Pages and on a custom domain, and a path
// written `/sounds/...` at runtime escapes to the domain root where the file is not.
//
// `SOUND_LEVEL` is the one level an added sound is mixed at, and it is here, in the domain,
// because the export's mix and the review's trigger must use the **same** number — one
// constant read by both is how "the review is what the file carries" is true by construction
// rather than by two numbers kept in step.

export interface StockSound {
  /** What a sound annotation holds: the name a person and an agent use. */
  readonly name: string;
  /** What the sound is called where a person chooses it. */
  readonly label: string;
  /** Where the app serves it from — **beside** the app, so it follows the base it is served on. */
  readonly file: string;
}

export const STOCK_SOUNDS: readonly StockSound[] = [
  { name: 'chime', label: 'Chime', file: './sounds/chime.wav' },
  { name: 'gong', label: 'Gong', file: './sounds/gong.wav' },
  { name: 'pluck', label: 'Pluck', file: './sounds/pluck.wav' },
  { name: 'riser', label: 'Riser', file: './sounds/riser.wav' },
  { name: 'thud', label: 'Thud', file: './sounds/thud.wav' },
  { name: 'whoosh', label: 'Whoosh', file: './sounds/whoosh.wav' },
  { name: 'wow', label: 'Wow', file: './sounds/wow.wav' },
];

/** The sound a new annotation is made in — the app's own default. */
export const DEFAULT_STOCK_SOUND = STOCK_SOUNDS[0].name;

/**
 * The level an added sound is mixed at, relative to the recording: chosen for the build so a
 * stock sound sits clearly over a voice. Not a property, and not the person's.
 */
export const SOUND_LEVEL = 1;

/** Is this a sound the app serves? The whole of "may this annotation exist". */
export function isStockSound(name: unknown): boolean {
  return typeof name === 'string' && STOCK_SOUNDS.some(sound => sound.name === name);
}

/** The sound a name means, or null for one this build does not ship. */
export function stockSound(name: string): StockSound | null {
  return STOCK_SOUNDS.find(sound => sound.name === name) ?? null;
}
