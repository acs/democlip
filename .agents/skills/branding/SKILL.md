---
name: Branding
description: How DemoClip's mark and name are used — the mark-only images, the wordmark as live text and its orange, the per-theme files, the icon set, and where the text-banner files are still right. Use when changing the logo, the header, an icon, the social card, or anything that shows the project's name.
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
space. `Clip` is the brand orange; `Demo` is the interface's text colour, so it
follows the theme. Do not uppercase it — `text-transform: uppercase` is how the
header came to say DEMOCLIP — and do not track it like small capitals.

```html
<img class="logo-mark logo-mark-dark" src="/branding/logo-small-dark.png" alt="" width="37" height="27">
<img class="logo-mark logo-mark-light" src="/branding/logo-small.png" alt="" width="37" height="27">
<span class="logo-title">Demo<span class="logo-title-accent">Clip</span></span>
```

```css
:root{--brand-orange:#FF6C23;}
.logo-title-accent{color:var(--brand-orange);}
```

The mark carries `alt=""`: the name is text right beside it, and a second
"DemoClip" would be read twice. Where the mark stands alone, name it.

## The colours

`web/public/branding/logo.svg` is the source of truth — read the hex from the vector,
not from a PNG. The PNGs have been through a resize and their inks are a few digits
off: sampling `logo.png` gives `#F96B04` for an orange that is `#FF6C23`.

| part | the vector |
|---|---|
| `Clip` | `#FF6C23` — the `--brand-orange` token |
| the record dot | `#FF2731` |
| the clapperboard, `Demo` | `#111111` on light; `#FFFFFF` in the on-dark files |

Two reds live here and are not meant to become one: the logo's dot is `#FF2731`,
the interface's recording accent is `--crimson` `#E53E3E`. Do not recolour the mark
to the accent, or the accent to the mark.

On the light theme the brand orange sits at about 2.5:1 against `#ECF0FA`, below the
4.5:1 a 13px label wants. It is a brand mark rather than body text and is kept
exact; if it must ever be darkened (as `.tl-mark` does in light), give the token a
light-theme value rather than a colour to the component.

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
`#111111` and `#FFFFFF` while leaving `#FF6C23` and `#FF2731` alone. Do not trace a
PNG, and do not filter the mark with CSS — a filter takes the colours with it.

## Proving a branding change

Branding is drawn, so it is proved the way the **Verification** skill says anything
drawn is: on the running dev server, at a desktop and a phone width, in both themes.
Look at it, and ask the browser what it computed:

- the name reads `DemoClip`, with `Clip` at `rgb(255, 108, 35)`
- the mark that loads matches the theme, and the other one is `display:none`
- nothing asked for a missing file

A raster cannot be unit-tested, and a build says nothing about whether the logo
looks right.

## In prose

The project is `DemoClip`, one word — not Demo Clip, not Democlip, not DEMOCLIP.
The header's second line, `Screen · WebM`, is a label and not the name; it may stay
small capitals.