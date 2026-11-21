---
name: round-trip-through-ffmpeg
description: Improve the picture outside the app and carry on editing — the clip leaves as a file with its annotations beside it, anything you have works on the video, and the file comes back with the annotations whole.
tools: [export_clip, import_take]
outside: ffmpeg
proved: reasoned
---

# Round trip through ffmpeg

**Goal.** Do to the *picture* what the app does not — denoise it, scale it, run a filter,
write another container — and keep working in DemoClip afterwards: cut the result, point
an arrow at it, export it again, with the annotations you already had still there and
still yours to move.

**Why not a feature.** Everything outside the app is a re-encode of the whole thing, so
nothing of the edit model survives it: the cuts are applied, and what comes back is a new
take rather than the old clip improved. The app's own export already covers the common
case of a file to watch or send. This recipe is for the file that is going to come back.

**Steps.**

1. **Export for editing** — *Export ▾ → WebM for editing* in the window, or `export_clip`
   with `annotations: "carried"`. Two things arrive: the video, holding the cuts applied
   and the picture **alone** (the annotations are deliberately *not* drawn into it), and
   the **sidecar** beside it (`democlip-1755021992.democlip.json` — the video's name with
   `.democlip.json` where its extension was) holding them as data. The tool answers with
   both paths; the app downloads both.
2. **Work on the video.** `ffmpeg -i clip.webm -vf scale=1280:-2 -c:v libvpx-vp9 -crf 32
   -b:v 0 out.webm` — anything that writes a WebM or an MP4, since those are the two
   containers the import reads back. Leave the sidecar alone, and **keep the video's
   name**: the sidecar is found by looking beside the file it belongs to.
3. **Bring it back in** — `import_take` with the video's path (it reads the sidecar beside
   it), or the app's **Import**, choosing the video and the `.json` together. A page cannot
   look in a folder, which is why the app's own import is handed both files.
4. **Carry on.** The take is appended, holding its own length and sound, and the sidecar's
   annotations become the clip's over the stretch the file was given. Cut, annotate and
   export as usual.

**Bringing it back into a clip of its own.** An import appends, so the clip then holds
what it held before *and* the file. To keep only the result, press **New** before importing
— ending a session is the person's, and there is no tool for it — or take the originals out
with the app's own `cut`: `describe_clip` gives each take's length, so one cut from 0 to the
fraction where the file begins does it, and that cut is undoable like any other. Note that
the annotations that left are still over the take they were drawn on: importing into the
same clip leaves them there, and the file's copies are annotations of their own over the
new stretch.

**Caveats.**

- **The sidecar is taken only while the lengths agree.** Its annotations are fractions of
  the file they were written for, so a file of quite another length is refused as another
  clip's — with the reason in the app's own words. A frame or two of drift is nothing, and
  is what a re-encode costs.
- **The picture a clip's annotations are drawn over keeps them out.** An export that
  carries the annotations does not draw them, so the file an editor or a person sees has no
  arrows in it until it is imported again. That is the point of it, and the reason the plain
  export is a separate choice: *WebM file* still holds exactly what the person watched.
- **The cuts do not come back.** They were applied when the file was written, so the clip
  that returns is the clip as the file holds it, with nothing to undo across the trip.
- **A picture an image annotation draws travels in the sidecar** — as bytes, in base64,
  which makes the sidecar large if the clip drew big pictures.
- **Not run end to end with ffmpeg.** Both halves are: `mcp/src/integration.test.ts` records
  a take, annotates it, exports it carried, and imports the file it wrote, and the
  annotations come back. The ffmpeg step between them has not been run here, so the command
  above is a shape rather than a tested line.
