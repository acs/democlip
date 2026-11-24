# File structure

```
democlip/
├── web/                  # The web shell: what the browser loads, and nothing else
│   ├── index.html        # The page — links the stylesheet and the entry below
│   ├── help.html         # The complete guide, a page of its own — the dialog links here
│   ├── main.ts           # The page's entry — imports src/main.ts, one level up
│   ├── help-page.ts      # The guide page's entry — the theme and the version
│   ├── styles.css        # All styling (theme variables, layout, components)
│   └── public/           # Copied verbatim into the build
│       ├── manifest.json # PWA manifest
│       ├── sw.js         # Service worker — cache-first offline support
│       ├── oauth-client-metadata.json # the Bluesky OAuth client_id document
│       ├── youtube-client.json # the app's own Google client ID, so a fork sets its own
│       └── branding/     # Logo (with background, transparent, dark), icon-only mark, app icons
├── src/                  # TypeScript source
│   ├── main.ts           # Composition root — the only module importing all four layers
│   ├── session.ts        # The single Session: the clip and the audio, and the one place that ends it
│   ├── state.ts          # The phase: its one owner and its change event
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── util.ts           # Tiny shared helpers (clampToClip)
│   ├── globals.d.ts      # Ambient types (prefixed AudioContext, captureStream)
│   ├── vite-env.d.ts     # Vite client types
│   ├── domain/clip/      # Pure logic — no DOM, no browser APIs; a test beside every rule
│   │   ├── Clip.ts         # The aggregate: the takes, the cuts, the annotations, what it says
│   │   ├── ClipProperties.ts # What a clip says about itself: its title, its description
│   │   ├── IntroCard.ts    # The card an export may put at its head, from those two lines
│   │   ├── Take.ts         # One press of Record: id, blob, url, duration
│   │   ├── TakeRepository.ts # The port the clip takes its takes from
│   │   ├── TakeFile.ts     # Which files may be imported: WebM or MP4, what the export reads back
│   │   ├── Span.ts         # A half-open range: [s, e)
│   │   ├── SpanSet.ts      # Ranges that cannot overlap — what was cut
│   │   ├── TimelineMap.ts  # Recording time ↔ kept time, in one place
│   │   └── ExportPlan.ts   # What the file will hold, and the annotations to draw
│   ├── domain/capture/   # The capture rules: what a take needs and what it records
│   │   ├── CropRegion.ts   # The part of the picture a take records, normalised to 0..1
│   │   └── SourceSet.ts    # The three sources, their toggles and the picture requirement
│   ├── domain/export/    # The export's own words
│   │   └── ExportTarget.ts # WebM or MP4 — what the person chose to write
│   ├── domain/annotation/ # What is drawn over the picture: the family, and its kinds
│   │   ├── Annotation.ts   # The base class: identity, the stretch, and the geometry
│   │   ├── Arrow.ts        # The first kind: its two ends, its aiming, its hit test
│   │   ├── ImageAnnotation.ts # The second kind: a picture's rect, resized keeping proportions
│   │   ├── TextAnnotation.ts  # The third kind: a line's box, scaled from a corner
│   │   ├── AnnotationColour.ts # The colours an annotation may be drawn in, and how one is read back
│   │   ├── AnnotationSet.ts # The clip's annotations: identified, and free to overlap
│   │   └── kinds.ts        # The register: how a written-down annotation is read back
│   ├── domain/session/   # The sitting: the clip and the audio flag
│   │   └── Session.ts      # The sitting's one rule: ending it clears the clip and the audio
│   ├── domain/bluesky/   # Pure logic for publishing: what a Bluesky post may hold
│   │   ├── AspectRatio.ts  # width:height, whole numbers, reducible to smallest terms
│   │   ├── PublishableVideo.ts # the MP4 Bluesky takes, up to 300 MB
│   │   └── BlueskyPost.ts  # the app.bsky.feed.post record carrying the video embed
│   ├── domain/youtube/   # Pure logic for the YouTube destination
│   │   ├── Visibility.ts   # private, unlisted or public — and private where a video starts
│   │   ├── VideoDetails.ts # the title (defaulted when blank), the description, the visibility
│   │   └── UploadableVideo.ts # the MP4 YouTube takes, and the ceilings it enforces
│   ├── application/      # Use cases: the thinking, without a browser
│   │   ├── record-take.ts  # RecordTake: sources → mix → record → stop → take added
│   │   ├── import-take.ts  # ImportTake: a video file read, then appended as a take
│   │   ├── export-video.ts # ExportVideo: the plan encoded, or a refusal
│   │   ├── keep-clip.ts    # KeepClip: the clip written down as it changes
│   │   ├── restore-clip.ts # RestoreClip: a kept clip loaded without announcing a change
│   │   ├── export-clip.ts  # planExport(clip, settings) → an ExportPlan
│   │   ├── publish-to-bluesky.ts # publishToBluesky(clip, settings, deps) → a post
│   │   ├── bluesky-service.ts # the port the publish use case reaches Bluesky through
│   │   ├── publish-to-youtube.ts # publishToYouTube(clip, settings, deps) → a video
│   │   ├── youtube-service.ts # the port it reaches the YouTube destination through
│   │   └── ports/          # The capabilities a use case may ask for, named without a browser
│   ├── infra/            # Browser boundary adapters
│   │   ├── capture.ts      # Screen, webcam and microphone over getDisplayMedia/getUserMedia
│   │   ├── clock.ts        # performance.now + setTimeout, behind ClockPort
│   │   ├── compositor.ts   # The crop canvas and the audio mixer, behind CompositorPort
│   │   ├── take-recorder.ts # MediaRecorder, behind TakeRecorderPort
│   │   ├── take-probe.ts   # Measuring a take's duration, behind TakeProbePort
│   │   ├── take-file.ts    # Reading a chosen file's length and sound, behind TakeFilePort
│   │   ├── offline-encoder.ts # Decode, draw, encode, mux — behind EncoderPort
│   │   ├── takes.ts        # InMemoryTakeRepository — owns the takes' object URLs
│   │   ├── clip-store.ts   # IndexedDB — where a clip outlives the page, behind KeptClipPort
│   │   ├── codecs.ts       # WebM mime / codec selection
│   │   ├── export-target.ts # which container an export writes (WebM, MP4) and its codecs
│   │   ├── bluesky.ts      # the OAuth session + XRPC calls; loaded only when publishing
│   │   ├── youtube.ts      # the Google token and the resumable upload; loaded on demand
│   │   └── download.ts     # Blob download trigger, behind DownloadPort
│   └── ui/               # View layer (DOM) — one module per widget, grouped by domain concept
│       ├── dom.ts          # Central element registry + status/toast helpers
│       ├── shell/          # The frame around the app
│       │   ├── theme.ts      # Light / dark theme
│       │   ├── help.ts       # Instructions modal — the brief tutorial and the guide link
│       │   ├── help-steps.html # The brief tutorial the modal shows
│       │   └── version.ts    # The version badge, and the newer-build offer
│       ├── recording/      # Making a take
│       │   ├── preview.ts    # Preview canvas, seeking, live mirror
│       │   ├── region.ts     # Crop-region selection + overlay (CropDrag)
│       │   ├── webcam.ts     # The webcam source: a bubble, or the whole picture
│       │   ├── mic.ts        # Microphone capture + level meter (Meter)
│       │   ├── source-buttons.ts # The source buttons' enabled state
│       │   ├── record-flow.ts # The source buttons, Record and the preview — a sequence over RecordTake
│       │   ├── import-flow.ts # The Import button — a sequence over ImportTake
│       │   └── live-timeline.ts # The strip and the levels while a take records (LiveTimeline)
│       ├── clip/           # The clip and its review
│       │   ├── clip.ts       # The joined clip, played as one timeline (Player)
│       │   ├── properties-panel.ts # What the clip says about itself, shown and edited
│       │   ├── clip-properties.ts  # The register: which clip properties the app offers
│       │   ├── playback.ts   # Playback on the preview, skipping the cuts (Playback)
│       │   ├── timeline-ui.ts # Time labels, size estimate, the thumbnail strip (Strip)
│       │   ├── thumbnail.ts  # The shape of a strip cell: a frame at the picture's own aspect
│       │   ├── waveform.ts   # The audio track under the strip (Waveform)
│       │   ├── fade.ts       # Short fades at the joins between takes
│       │   ├── dissolve.ts   # Short dissolves at the joins between takes (Dissolve)
│       │   ├── size-estimate.ts # What the export will weigh
│       │   └── review-flow.ts # Opening the review after a take or a restore
│       ├── cutting/        # Choosing a stretch and cutting it
│       │   ├── selection.ts  # The stretch the user is pointing at (Selection)
│       │   └── marks.ts      # The marks, the section, and its actions (MarkDrag)
│       ├── annotating/     # Drawing on the clip: the plugin seam and the shared canvas
│       │   ├── annotation-plugin.ts   # What a kind is in the view: action, renderer, how one is made
│       │   ├── annotation-canvas.ts   # The shared editing surface: pick, move, resize, copy, delete
│       │   ├── annotation-layer.ts    # Painting a kind, and the grips on a picked one
│       │   ├── plugins.ts             # The view's register: one line per kind
│       │   ├── arrow-plugin.ts        # The arrow kind: its look and its drag-to-draw
│       │   ├── image-plugin.ts        # The image kind: choose a picture, place and draw it
│       │   ├── picture.ts             # Preparing and placing a picture, for the picker and the clipboard
│       │   ├── text-plugin.ts         # The text kind: type a line, place and scale it
│       │   ├── properties-inspector.ts # What a picked annotation's kind offers, shown and edited
│       │   ├── text-entry.ts          # The one dialog for typing a line, entering and editing
│       │   ├── annotation-lane.ts     # The timeline lane: where the annotations are
│       │   └── annotation-clipboard.ts # The annotation a copy put aside, for a paste (Clipboard)
│       ├── exporting/      # Writing the file
│       │   ├── export-flow.ts  # The Export button — a sequence over ExportVideo
│       │   ├── export-menu.ts  # The File/Bluesky/YouTube menu under the Export button (ExportMenu)
│       │   ├── intro.ts        # Whether the export gets a title card, and how long it is
│       │   ├── intro-text.ts   # The card's title and description as text annotations
│       │   └── frame-renderer.ts # The FrameRendererPort the encoder draws through
│       ├── publishing/     # Publishing to a video service
│       │   ├── publish-flow.ts # The Publish button — a sequence over publishToBluesky
│       │   ├── publish-dialog.ts # The post's settings and preview
│       │   ├── youtube-flow.ts # The Upload button — a sequence over publishToYouTube
│       │   └── youtube-dialog.ts # The video's title, description and visibility
│       ├── keeping/        # Keeping a clip and coming back to it
│       │   ├── keep.ts       # The KeepClip composition the app uses
│       │   └── resume-flow.ts # The startup restore — a sequence over RestoreClip
│       ├── lifecycle/      # Starting and ending a session
│       │   ├── new-session-flow.ts # The New button — end the session and go back for a source
│       │   └── view-lifetime.ts # The view's answer to clip.cleared: every view resets itself
│       └── agent/          # The automation surface an agent drives — published only when asked
│           ├── surface.ts    # The operations, the gate, and the clip as data
│           ├── describe.ts   # The clip described: length, takes, cuts, annotations, its properties
│           ├── edit.ts       # cut, annotate, set a property — on an annotation or the clip — remove, undo
│           ├── make.ts       # Making an annotation of a kind from data: an arrow, a text, an image's rect and picture
│           ├── view.ts       # The transport: seek, play, pause
│           ├── takes.ts      # The sources and the takes, through the app's own flow
│           └── out.ts        # The file, and the post
├── mcp/                  # The MCP server: a second artefact, released with the app
│   ├── package.json      # Its own dependencies (Playwright, the MCP SDK) and its version
│   ├── src/
│   │   ├── index.ts        # The entry: the server on stdio
│   │   ├── server.ts       # The tools, over the protocol
│   │   ├── session.ts      # One session: the build served, the browser, the version checked
│   │   ├── browser.ts      # Launching the browser, on a profile of its own
│   │   ├── serve.ts        # Serving the app's build on loopback
│   │   ├── tools.ts        # The tool list, in the app's own words
│   │   ├── clipboard.ts    # The picture on the person's clipboard, read from the host
│   │   ├── press.ts        # The one trusted press: turning the screen source on
│   │   ├── downloads.ts    # Taking the exported file from the browser
│   │   └── version.ts      # The version the server was built with, and the check
│   └── scripts/          # sync-version.mjs (keep the two versions equal), bundle-app.mjs
├── vite.config.ts        # Dev server + build config
├── tsconfig.json         # TypeScript config (type-check / editor)
├── eslint.config.js      # ESLint (flat config)
├── vitest.config.ts      # Test runner config
├── docs/                 # The written record: the feature list, the words, and the guides
│   ├── FEATURES.md       # Every feature in full — the README keeps the summary
│   ├── GLOSSARY.md       # The words this project uses — the ubiquitous language
│   ├── VERSIONING.md     # How the version is bumped, tagged and shown
│   ├── DEVELOPMENT.md    # Setting up, the commands and the tests
│   ├── DEPLOYMENT.md     # Serving your own build, and the YouTube setup
│   ├── AI.md             # Driving the app from an agent
│   └── FILES.md          # This file: where the code lives
├── specs/                # A feature's spec, plan, tasks and contracts — one directory per feature
├── THIRD-PARTY-NOTICES.template.txt  # Licences of what we bundle; the build fills in the versions
├── .agents/skills/       # How work is done here: verifying a change, the domain model, the workflow, branding
└── .husky/pre-commit     # Runs lint-staged on commit
```

The split is a hexagonal one: `domain/` is pure and `application/` holds the
use cases and the ports they reach the browser through (both run in node, with
tests beside them), `infra/` and `ui/` are the adapters that reach the browser and
the DOM, and the `ui/` flows — `record-flow.ts`, `export-flow.ts`,
`publish-flow.ts`, `resume-flow.ts`, `new-session-flow.ts` — are the sequences
`main.ts` composes. Each `ui/` module exports the object its state lives on; the
session owns the clip and names no view, and `view-lifetime.ts` is the view's
answer to the clip being cleared. The `agent/` group is the automation surface an
agent drives: the app's own operations in one object, published only when the page
asked (`?agent=1`), and adding no rule of its own. `mcp/` beside `src/` is the
server — a second artefact, in node, reaching the app only through the page and
released with the app's version. The vocabulary is in [GLOSSARY.md](GLOSSARY.md),
and where a rule belongs is in
[`.agents/skills/domain-model`](../.agents/skills/domain-model/SKILL.md). It is
written in TypeScript and served and bundled by [Vite](https://vite.dev/).
