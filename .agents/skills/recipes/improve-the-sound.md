---
name: improve-the-sound
description: Raise a voice past what the app's own sound boost does — mono, a low-end cut, a presence lift — measured first and in one pass, leaving the picture copied bit for bit.
tools: [export_clip, describe_clip, cut, import_take]
outside: ffmpeg
proved: run
---

# Improve the sound

**Goal.** Put the voice where players expect it, without touching the picture and
without a second generation of loss — and know which of the usual treatments this
recording does not need.

**Why not a feature — and what now is.** The **loudness** half is the app's own now: the
**sound boost** brings a clip to about −16 LUFS with peak safety, in the review and in every
file, on by default and fixable in a profile. What is still the app's not to do is everything
the measurement asks for *beyond* loudness — the mono fold-down, the low-end cut, the presence
lift — and the judgement of which of those a recording needs, which is an ear and an A/B. So
this recipe is now the **outside** half: reach for it when a voice needs more than being
brought to the target, and skip it when it only needs that.

**Steps.**

1. `export_clip` — MP4 or WebM. The audio in that file is what the analysis reads. The
   picture in it is a re-encode of the clip, which is why step 5 copies it rather than
   decoding it again.
2. **Measure before treating.** `ffmpeg -i in.mp4 -af ebur128=peak=true -f null -` for
   integrated loudness, true peak and loudness range; `astats=measure_overall=all` for
   the noise floor. Then check whether the two channels are one channel given twice:
   `-af "pan=mono|c0=c0-c1,astats"` — a difference 90 dB down is the same signal twice.
3. **Loudness in two passes** — the app's own **Boost the sound** already does this on the clip
   (about −16 LUFS with peak safety), so do it here only when the file that left had the boost
   off or a different target is wanted. `loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`
   measures; the second pass hands those numbers back (`measured_I`, `measured_TP`,
   `measured_LRA`, `measured_thresh`, `offset`) with `linear=true`. One pass rides the gain, and
   its first seconds never reach the target.
4. **Only the treatments the measurements ask for.** `-ac 1` where the channels are
   identical; `highpass=f=60` where the low end is room and handling rather than voice; a
   2 dB `equalizer=f=3000:t=q:w=1.2:g=2` where intelligibility needs it — and an A/B with
   and without before keeping either.
5. **Keep the picture, pin the length.** `-c:v copy` keeps the picture bit-identical;
   `-t <the clip's length>` stops the re-encoded audio drifting a frame long.
   `-c:a aac -b:a 64k` is plenty once it is mono.
6. `import_take` — or the app's **Import**. It appends, so either press **New** first or
   take the old take out with one `cut`, from 0 to the fraction where the file begins.

**Run once.** A 12.308 s webcam take, measured at **−23.2 LUFS**, true peak −5.8 dBFS,
loudness range **1.6 LU**, noise floor −65 dB, its two channels identical to −99.6 dB.
Two passes of `loudnorm` landed on **−16.0 LUFS**; `-ac 1` at 64 kb/s made the file
923,356 B against 971,226 B for the same treatment kept stereo. The picture's packet MD5
was identical to the take's in both. `highpass=f=90` was tried and measured: **2.2 dB**
out of a 25 Hz-wide band at 35 Hz, and 90 Hz sits on a male voice's fundamental — `f=60`
is the setting to start from.

**Caveats.**

- **The sound has already been encoded once**, by the app's own export. Every extra pass
  adds grain, so one ffmpeg run does all of it — not one file per experiment, stacked.
- **The targets are a judgement.** −16 LUFS for a page or a podcast, −14 for social, −19
  for something broadcast-adjacent; louder means the true-peak limiter works harder.
- **Compression and denoise are usually wrong, and the numbers say when.** A loudness
  range under 2 LU has nothing to even out, and a floor 40 dB under the voice is
  inaudible. Add either with a measurement, or not at all.
- **Nothing here fixes the recording.** Distance, an off-axis mic and the room are in the
  bytes; no chain gives them back.
- **It does not come back as an edit.** The file arrives as a new take, the old take's
  cuts and annotations baked into its picture with it, and the app's undo cannot reach
  anything that was done outside.