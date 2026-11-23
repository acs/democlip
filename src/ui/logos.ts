// The logos the app ships for a clip to wear.
//
// A clip's **logo** is the *name* of one of these, not a path: the files live in the app's own
// `web/public/logos/` and are served **beside** it, so nothing is uploaded and nothing is fetched
// from anywhere else. A **profile** may fix one, so every clip made under that profile opens
// with the same mark — and a clip with no logo at all is the ordinary case.
//
// The file is named **relative** to the app — `./logos/...` — and not from the domain root, so
// it is fetched from wherever the app itself is served. The build's own asset URLs are relative
// for the same reason (`base: './'` in `vite.config.ts`): the app runs at the root in
// development, under a project's path on GitHub Pages (`https://acs.github.io/democlip/`) and on
// a custom domain, and a path written `/logos/...` at runtime is none of those — it escapes to
// the domain root, where the file is not, and 404s. The app's HTML gets this rebasing from the
// build; a string built here at runtime does not, so it is written relative to begin with.
//
// The list is data, and this module is free of the DOM, so a clip property can offer these as
// the choices of a list — and refuse a name the app does not ship — without reaching for the
// browser, and a node test can read it.

export interface Logo {
  /** What a clip property holds: the name a person and a profile use. */
  readonly name: string;
  /** What the mark is called where a person chooses it. */
  readonly label: string;
  /** Where the app serves it from — **beside** the app, so it follows the base it is served on. */
  readonly file: string;
}

export const LOGOS: readonly Logo[] = [
  { name: 'democlip', label: 'DemoClip', file: './logos/democlip.png' },
  { name: 'graditone', label: 'Graditone', file: './logos/graditone.png' },
];

/** The file a logo's name means, or null for one this build does not ship. */
export function logoFile(name: string): string | null {
  return LOGOS.find(logo => logo.name === name)?.file ?? null;
}

/**
 * The name a logo's picture is kept under in the **picture store** (`src/infra/images.ts`), where
 * an image annotation's bytes live: the watermark's mark is an image annotation, so the app's own
 * file is fetched there once and drawn by the image kind, rather than by a kind fitted to it.
 */
export function logoPictureId(name: string): string {
  return `logo:${name}`;
}
