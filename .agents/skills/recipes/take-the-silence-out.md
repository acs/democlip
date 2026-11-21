---
name: take-the-silence-out
description: Drop the quiet stretches from a clip, keeping the edit non-destructive — ffmpeg finds them, the app's cut takes them out.
tools: [export_clip, describe_clip, cut]
outside: ffmpeg
proved: run
---

# Take the silence out

**Goal.** Drop the quiet stretches from a clip, keeping the edit non-destructive.

**Why not a feature.** The app decodes audio to draw its waveform and to build the
export's mix, but it has no silence detection: adding one would put a decode of every
take in the browser, and a threshold to tune, into the app.

**Steps.**
1. `export_clip` — mp4 or webm; the file is what the analysis reads.
2. Find the quiet stretches with ffmpeg, which prints a `silence_start` and
   `silence_end` line, in seconds, for each:
   `ffmpeg -i in.mp4 -af silencedetect=noise=-35dB:d=0.3 -f null -`
3. Turn each stretch into a fraction of the clip — `describe_clip` gives its length —
   and call `cut` once per stretch, **latest first**, so the earlier fractions stay
   valid as the clip shortens.
4. `export_clip` again and re-run the detector: it should find nothing.

**Run once.** A 9.735 s take with a 4.17 s leading silence and a 0.32 s pause
(−35 dB, 0.3 s minimum) cut to a kept length of **5.245 s**, and the detector found
no silence in the re-export. Each cut is one `undo`.

**Caveats.** The threshold is a judgement — a quiet voice loses word edges, so loosen
it (−45 dB) before blaming the cut. The fractions come from the clip's own length
while ffmpeg measures the exported file, so the two differ by the encoder's trim.
