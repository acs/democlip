// The logos the app ships for a clip to wear.
//
// A clip's **logo** is the *name* of one of these, not a path: the files live in the app's own
// `web/public/logos/` and are served beside it, so nothing is uploaded and nothing is fetched
// from anywhere else. A **profile** may fix one, so every clip made under that profile opens
// with the same mark — and a clip with no logo at all is the ordinary case.
//
// The list is data, and this module is free of the DOM, so a clip property can refuse a name
// the app does not ship without reaching for the browser, and a node test can read it.

export interface Logo {
  /** What a clip property holds: the name a person and a profile use. */
  readonly name: string;
  /** Where the app serves it from. */
  readonly file: string;
}

export const LOGOS: readonly Logo[] = [
  { name: 'democlip', file: '/logos/democlip.png' },
  { name: 'graditone', file: '/logos/graditone.png' },
];

/** The file a logo's name means, or null for one this build does not ship. */
export function logoFile(name: string): string | null {
  return LOGOS.find(logo => logo.name === name)?.file ?? null;
}
