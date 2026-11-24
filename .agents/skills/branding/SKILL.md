---
name: Branding
description: How DemoClip's mark and name are used — the mark-only images, the wordmark as live text and its red, the per-theme files, the icon set, and where the text-banner files are still right. Use when changing the logo, the header, an icon, the social card, or anything that shows the project's name.
---

# Branding

**The mark is an image. The name is text.** The header shows
`/branding/logo-small-dark.png` — or its light twin — and writes `DemoClip`
beside it in HTML, so the wordmark wears the app's own Syne, at the app's own size,
and follows the theme with the rest of the interface. A logo-with-text image cannot
do that: its font, spacing and colour are frozen into the file.

So `web/public/branding/` holds two families:

- **the mark alone** — `logo-small.png`, `logo-small-dark.png`: the clapperboard,
  its red dot and its play triangle, in the ink that reads on the background.
- **the logo with its text banner** — `logo.png`, `logo-transparent.png`,
  `logo-dark.png`: mark and wordmark as one image. For places with no CSS of their
  own — the GitHub README, the social card, a store listing. **Not** the app.

## The name

`DemoClip`: capital D, lowercase `emo`, capital C, lowercase `lip` — one word, no
space. `Clip` is the brand red — the record button's own red; `Demo` is the
interface's text colour, so it follows the theme. Do not uppercase it —
`text-transform: uppercase` is how the header came to say DEMOCLIP — and do not
track it like small capitals.

```html
<img class="logo-mark logo-mark-dark" src="/branding/logo-small-dark.png" alt="" width="37" height="27">
<img class="logo-mark logo-mark-light" src="/branding/logo-small.png" alt="" width="37" height="27">
<span class="logo-title">Demo<span class="logo-title-accent">Clip</span></span>
```

```css
:root{--crimson:#E53E3E;--brand-red:var(--crimson);}       /* dark */
[data-theme="light"]{--brand-red:#C62828;}                  /* deep enough to read */
.logo-title-accent{color:var(--brand-red);}
```

The mark carries `alt=""`: the name is text right beside it, and a second
"DemoClip" would be read twice. Where the mark stands alone, name it.

## The colours

`web/public/branding/logo.svg` is the source of truth — read the hex from the vector,
not from a PNG. The PNGs have been through a resize and their inks are a few digits
off: sampling `logo.png` gives `#131312` for a black that is `#111111`.

| part | the vector |
|---|---|
| `Clip` | `#E53E3E` — the `--brand-red` token, the record button's red |
| the record dot | `#FF2731` |
| the clapperboard, `Demo` | `#111111` on light; `#FFFFFF` in the on-dark files |

The wordmark and the interface's recording accent are one red: `#E53E3E` is
`--crimson`, and `--brand-red` follows it, so the brand cannot drift from the record
button. The mark's own dot is a second, lighter red, `#FF2731`, and is not the
accent: do not recolour the dot to the accent, or the accent to the dot.

On the light theme `#E53E3E` sits at about 3.6:1 against `#ECF0FA`, below the 4.5:1
an 11px link wants. The token therefore carries a deeper red in that theme,
`#C62828` (about 4.9:1), rather than each component darkening itself.

## The files

| file | what it holds | where it is used |
|---|---|---|
| `logo.svg` | the vector, 1084×225, all four inks | the source; regenerate from it |
| `logo-small.png` | the mark alone, transparent, `#111111` ink | the header, light theme |
| `logo-small-dark.png` | the mark alone, transparent, white ink | the header, dark theme (the default) |
| `logo.png` | mark and wordmark on their own near-white background | `README.md`, where no CSS reaches the text |
| `logo-transparent.png` | mark and wordmark, transparent, `#111111` ink | light-background art outside the app |
| `logo-dark.png` | mark and wordmark, white on black | dark-background art outside the app |
| `icon-192.png`, `icon-512.png` | the square mark on the app background `#060710` | the manifest, the favicon, `apple-touch-icon` |
| `og-image.png` | the 1200×630 card | `og:image`, `twitter:image` |

`web/public/` is served verbatim by Vite, so in the app a path is `/branding/…` —
the `public/` left out — while the README names `web/public/branding/…`, resolved
against the repository root.

## Which theme gets which mark

Both marks are in the DOM and CSS shows one: the default theme is **dark** and gets
`logo-small-dark.png`; `[data-theme="light"]` on the root gets `logo-small.png`.
Both files are in the service worker's `CORE` list in `web/public/sw.js`, so the header
is painted offline on the first load. A new branding asset the app shell needs goes
there too.

## Making a variant

Work from `logo.svg`: render it at the size needed on a transparent background
(`rsvg-convert`, `resvg`, Inkscape, or a browser), and for an on-dark variant swap
`#111111` and `#FFFFFF` while leaving `#E53E3E` and `#FF2731` alone. Do not trace a
PNG, and do not filter the mark with CSS — a filter takes the colours with it.

## Proving a branding change

Branding is drawn, so it is proved the way the **Verification** skill says anything
drawn is: on the running dev server, at a desktop and a phone width, in both themes.
Look at it, and ask the browser what it computed:

- the name reads `DemoClip`, with `Clip` at `rgb(229, 62, 62)` — or
  `rgb(198, 40, 40)` on the light theme
- the mark that loads matches the theme, and the other one is `display:none`
- nothing asked for a missing file

A raster cannot be unit-tested, and a build says nothing about whether the logo
looks right.

## In prose

The project is `DemoClip`, one word — not Demo Clip, not Democlip, not DEMOCLIP.
The header's second line is the build's version, `vX.Y.Z`, and it links to the
project on GitHub. It replaced the `Screen · WebM` label, which is no longer shown.