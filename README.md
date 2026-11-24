<h1>
  <img src="web/public/branding/logo.png" alt="DemoClip" width="420">
</h1>

**🚀 Live App**: [https://acs.github.io/democlip/](https://acs.github.io/democlip/)

Capture. Create. Share.

DemoClip is a lightweight video studio that runs entirely in your browser. Record your screen, webcam or microphone — independently or in any combination — to create software demos, tutorials or personal video updates.

Review your recordings, make quick cuts, point at what matters with an arrow or a picture, and publish directly to Bluesky or YouTube. Or simply export your video to a file.

No installation. No recording server. Just open DemoClip and start creating.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-5-6E9F18)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3)](https://eslint.org/)
[![WebCodecs](https://img.shields.io/badge/WebCodecs-export-1B7F79)](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
[![Mediabunny](https://img.shields.io/badge/Mediabunny-1.66-6E56CF)](https://mediabunny.dev/)
[![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Bluesky](https://img.shields.io/badge/Bluesky-AT_Protocol-0285FF)](https://atproto.com/)

A minute and a half of DemoClip recording, cutting and exporting a clip — recorded with DemoClip itself:

https://github.com/user-attachments/assets/81f83dc4-a036-4e10-a398-b36ceca93122

---

## Features

The headline capabilities; the **[full list is in docs/FEATURES.md](docs/FEATURES.md)**.

- **Screen, webcam and mic** — record a screen, window or tab with its audio, the camera, the microphone, or any combination of them — **the microphone on its own records a sound-only clip**
- **Nothing captured until you ask** — every source starts off, so the app never opens a screen picker on its own
- **Region crop** — drag a box over the preview to record just part of the screen, and click to reset
- **Timeline cutting** — click twice to select a section, cut it out with the scissors, and undo it
- **Annotations** — point at a detail with an arrow, put a picture over a chosen stretch, or write a line of text on it, shown in playback and in the exported file, and kept with the clip
- **Add more takes** — Record again appends to the end of the clip, with a fade and a dissolve across the join
- **Import a video file** — bring a WebM or MP4 in as a take to cut, annotate and export alongside your recordings; nothing is re-recorded
- **Export to a file, encoded offline** — WebM for size or MP4 for compatibility, written in the browser by WebCodecs about 10× faster than the clip, with a duration and cue points any player can scrub
- **A clip that leaves and comes back** — **WebM for editing** writes the picture alone with its **annotations** beside it, so the video can be improved with anything you have and imported back with the annotations still yours to move
- **Nothing leaves your machine** — recording, playback and export are entirely local; publishing to Bluesky or YouTube is optional, and only happens when you ask
- **Light / dark and installable** — CSS-variable theming, and a PWA that installs as a desktop app

---

## Documentation

- [File structure](docs/FILES.md) — where the code lives, and how the layers split
- [Development](docs/DEVELOPMENT.md) — setup, the npm commands, and the tests
- [Deploy your own](docs/DEPLOYMENT.md) — GitHub Pages, and the one-time YouTube setup
- [Drive it from an agent](docs/AI.md) — the local MCP server that lets a chat edit the clip
- [Features](docs/FEATURES.md) — every feature in full
- [Glossary](docs/GLOSSARY.md) — the words this project uses
- [Versioning](docs/VERSIONING.md) — how the version is bumped, tagged and shown

## Browser support

| Browser | Screen capture | Screen audio | Webcam & mic | Export |
|---|---|---|---|---|
| Chrome 94+ · Edge 94+ | ✓ | ✓ | ✓ | ✓ |
| Firefox 130+ | ✓ | ✗ | ✓ | ✓ |
| Safari 26+ (macOS) | ✓ | ✗ | ✓ | ✓ |
| Chrome (Android) | ✗ | ✗ | ✓ | ✓ |
| Firefox (Android) | ✗ | ✗ | ✓ | ✗ |
| Safari (iOS 27+) | ✓ | ✗ | ✓ | ✓ |

Screen capture needs `getDisplayMedia`. **No mobile browser had it until Safari 27
on iOS** — Chrome and Firefox on Android still cannot share a screen. A phone or
tablet records the **webcam and the microphone** instead, with the same timeline,
cutting and export; the Screen button is out there, and the header says why.

The export needs WebCodecs (`VideoEncoder` and `AudioEncoder`): Chrome and Edge
94+, Firefox 130+ and Safari 26+. **Firefox 113–129 can record but not export** —
it arrived in Firefox 130 — and Firefox on Android cannot export at all. There is
no slower path to fall back to any more, and the app says so rather than failing
halfway.

Screen audio is Chrome and Edge only, and even there the browser and the
operating system decide: Windows and ChromeOS offer system audio, elsewhere it is
the shared tab's own sound. The microphone is unaffected.

Safari works on the current version — **26 or later**, since WebM recording arrived
in 18.4 and `AudioEncoder` in 26. On macOS the first share also asks for **Screen
Recording** permission in System Settings.

---

## License

MIT — see [LICENSE.md](LICENSE.md).
