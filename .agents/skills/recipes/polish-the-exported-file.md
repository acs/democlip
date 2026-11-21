---
name: polish-the-exported-file
description: Do to the exported file what the app should not — loudness normalisation, downscaling, a different container — as a one-way step that nothing comes back from.
tools: [export_clip]
outside: ffmpeg
proved: reasoned
---

# Polish the exported file

**Goal.** Do to the *file* what the app should not: loudness normalisation,
downscaling, a different container.

**Why not a feature.** It is a re-encode, so it is one-way — the result is a new file,
not a new clip — and the app's own export already covers the common case.

**Steps.** `export_clip`, then ffmpeg on the result: `loudnorm` for loudness,
`-vf scale` to resize, `-c copy` to re-container without re-encoding. Nothing comes
back: the file is the record, and the clip in the window is left as it was. When the
result is meant to be worked on *in DemoClip* instead, that is a different recipe —
[round-trip-through-ffmpeg](round-trip-through-ffmpeg.md) — which exports the picture
alone with the annotations beside it, and brings them back.

**Caveats.** Not run yet; the commands are standard, but the numbers (`loudnorm`'s
targets, the scale) are a judgement per clip. Because nothing returns to the app, the
edit is not undoable here — the file is the record.
