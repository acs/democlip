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

- **Screen, webcam and mic** — record a screen, window or tab with its audio, the camera, the microphone, or any combination of them
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

## Usage

1. Open [DemoClip](https://acs.github.io/democlip/) — nothing is captured yet. Press **Screen** to pick a screen, window or tab (full screen is preselected; tick **Share tab audio** / **Share system audio** for sound), or **Webcam** to record the camera on its own — **Mic** adds the microphone to either. Pressing a source again lets it go, and **New** goes back to the picker if you forget the audio
2. The red box over the preview shows what will be recorded — the whole screen by default; drag to record only a region, and click to go back to the full screen
3. Press the red button to record — it starts at once; press it again to stop
4. Press Record again to add another take to the end of the clip — the timeline then holds every take, and the cuts you already made are kept — or press **Import** to bring a **WebM or MP4** file already on your machine in as a take beside them
5. The timeline holds a playback control and an audio track
6. Play it back (**P** or ▶), or click anywhere on the timeline to bring the playhead there — it holds the frame rather than playing, so you can find the exact moment. To cut a section out, click where it starts and where it ends, then press the **scissors** (or click inside the shaded section): it leaves the timeline and the rest closes up. To point at a detail instead, press the **arrow** on the section and drag across the preview — the arrow is shown over that stretch in playback and in the export — or press the **image** beside it to put a picture over the stretch (choose a file, paste one, or drop one on the preview) and drag its corners to resize it (hold **Shift** to stretch it freely), or press the **text** button to type a line, which grows and shrinks as you drag a corner. Click an annotation on the picture to move, aim or resize it, click its mark on the timeline lane to jump to it, copy it and paste a new one at the playhead (**⌘/Ctrl+C**, **⌘/Ctrl+V**), or delete it by pressing **Delete** with it picked, or by tapping the **×** that appears on it (and the **copy** beside it puts another like it on the picture). The **undo** on the section drops the selection, and the **undo** in the header brings back whatever you last did, a cut or an annotation. Marks and the selected section can be dragged to reposition them, with the frame under them following, or nudged a frame at a time with **←** / **→** (hold **Shift** for a second)
7. Give the clip a **title** and a **description** from the **settings** control in the corner of the preview — the pencil over the picture — what it says about itself, kept with the clip and read back after a reload. Turn on **Add to export** there and **every export — a file or a publish — begins with a 2-second title card**: the clip's first frame held still, with those two lines over it and the date and the app's name under them. Then press **Export ▾** and pick where the clip goes — a **WebM** file (small and sharp), an **MP4** file (plays anywhere), **Bluesky** to publish it as a video post, or **YouTube** to upload it to your own channel. Publishing fills its fields from those properties — a video's title and description, a post's text and its alt — and you can still change them for one publish. The encode runs offline, over the clip with its cuts taken out, roughly ten times faster than the clip, and the timeline counts down how much is left to write. **WebM for editing** is the one for a clip that is coming back: it writes the picture **alone**, with a `.json` **sidecar** beside it holding the annotations, and **Import** takes the video and the sidecar together, so the clip returns from whatever worked on it with its annotations whole
8. The clip has one **clip size** — the largest width and height among its takes, both even — and every take is shown in it whole and centred, in the review and in every export, so a file never changes picture size partway. The same **settings** control shows it; change the width and height there and the review and the next export follow, kept with the clip and taken back by the one undo

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

## Tech

- [Vite](https://vite.dev/) — dev server and build
- TypeScript — the whole app, unit-tested with [Vitest](https://vitest.dev/) and linted with ESLint
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — screen capture
- [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — WebM encoding as a take is recorded
- [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) — `VideoEncoder`/`AudioEncoder` for the offline export
- [Mediabunny](https://mediabunny.dev/) — reads the takes back frame by frame for that export, and writes the exported file, duration and cue points included
- Bundled licences — filled at build time from `THIRD-PARTY-NOTICES.template.txt`, carried inside the JS bundle and served beside the app as `THIRD-PARTY-NOTICES.txt`
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT — see [LICENSE.md](LICENSE.md).
