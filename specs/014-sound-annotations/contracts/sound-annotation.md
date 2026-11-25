# Contract: Sound Annotations

The app is a browser application: its contracts are the **operations a person or an agent
performs**, the **files it writes**, and the **domain seams** the rest of the code asks. This
file names what those must accept for the feature; it does not restate the rules, which are in
[data-model.md](../data-model.md).

## The kind — the annotate options and the lane

A **sound annotation** is a fourth kind, added in the one place every kind is added and found in
the one place every annotation is found. It is a kind like the others in every way that does not
require a shape.

| surface | contract |
|---|---|
| the **annotate options** | a **Sound** row, with the other kinds when there is a picture, and on its own when there is none (the kind says it needs no picture) |
| adding one | it is placed over the selected stretch (or the default stretch at the playhead) in the app's **default stock sound**, and it plays at once; its **preferences** open |
| the **timeline lane** | a mark for the kind at the start of its stretch, and the picked one's whole stretch as a band, exactly as for any annotation — clicking it picks the sound and brings the playhead to it |
| the picture | **nothing**: the kind draws nothing, is never picked from the picture, and has no handles |
| the picked sound's controls | **remove** and **settings**, offered beside its band on the lane (so a touch screen can edit it without keys); **settings** opens its preferences. There is no **copy** control: a sound has no place on the picture to shift a copy to, so a copy is made from the keyboard (**⌘/Ctrl+C**, **⌘/Ctrl+V** at the playhead) |

## The stock sounds

The app's own sounds, declared in one place and served beside it. Nothing is loaded, imported,
pasted or recorded.

| surface | contract |
|---|---|
| the list | the app's chosen set — **Chime**, **Gong**, **Pluck**, **Riser**, **Thud**, **Whoosh**, **Wow** — each a name, a label and a file under the app's own folder; the list is data the domain holds |
| where a sound comes from | the app's file, fetched from where the app is served (`./sounds/…`), decoded once and cached; never uploaded, never from a service |
| a new sound | a line in the list and a file; no mechanism changes |
| one level | the build's one level for an added sound; not the person's, and not a property |

## The annotation's preferences

The sound is a **property** of the kind, edited in the annotation's **preferences** — the one
shared inspector — as a colour and a text's words are.

| property | contract |
|---|---|
| **Sound** | chosen from a **drop-down** of the app's stock sounds; the change is one announcement, kept with the clip, and is what the one **undo** takes back. **One play button** beside the drop-down plays the chosen sound — the app's own file, at the level the review and the file mix it at — and playing it does not change the choice |
| **Duration** | the shared duration property every hand-placed annotation has: how long the sound plays, in seconds of the clip |

There is **no file dialog and no chooser at the moment of adding**: the annotation is placed in
the default sound and its preferences open, so it is heard at once and the choice is one press
away. The preferences for a kind with no picture box are opened from the **lane**, since the
on-picture settings control every other kind hangs off its own box is a place a boxless kind does
not have.

## The file

Every export that carries sound carries the sound annotations, mixed with the recorded sound.

| property | contract |
|---|---|
| what is in the file | the recording, with the stock sound added over its kept stretch at the build's level — the recording is always heard beneath it |
| when it is heard | only over the kept part of its stretch; a cut through the stretch is silent over the cut |
| the recording | unchanged: the takes are not re-encoded; with the annotations removed the file is the recording whole |
| the picture | identical to the same export without the sound annotations (a sound alone is audible) |
| the boost | the clip's **sound boost** treats the **recorded** sound alone; the added sound is mixed **after** the gain, so it is not measured and not lifted |
| a clip with no recorded sound | a sound annotation makes the file carry sound, where before it carried none |
| containers | as today — WebM/Opus and MP4/AAC, download and publish alike; a **sound-only** clip's sound file too |
| which exports | the WebM download, the MP4 for Bluesky, the YouTube upload, a **sound-only** file, and the export that carries its annotations beside it |

The plan answers **where** each sound lands (`soundings()`), in the file's seconds, with a cut
already taken out; the encoder mixes from that, so the file and the review cannot disagree.

## The review

| surface | contract |
|---|---|
| the sound heard while reviewing | the stock sound at its stretch, mixed with the recording, the same as the file |
| the graph | the sound plays from the review's own `AudioContext`, connected to the destination **directly** — not through the boost node, which treats the recording alone |
| when it plays | as the playhead **crosses** the start of a kept stretch while moving forward; a pause, a seek or a cut jump resets the crossing, so a jump fires nothing and a backward seek fires nothing twice |
| where it is silent | outside a stretch; over a cut through a stretch; with no sound annotations |
| no `AudioContext` | the review is silent of annotations and every file still carries them (a stated gap, as the ear is) |

## The sidecar and the store

| surface | contract |
|---|---|
| the clip's snapshot and the store | the sound's name travels in the annotation's geometry, as any annotation does; no schema change, no migration |
| the sidecar | a sound annotation is written beside a file and read back like any other; an unknown sound is left out |
| an imported file | the sound annotations a sidecar holds are taken on; an unknown sound is left out and the rest opens |

## The automation surface and the MCP server

| operation | contract |
|---|---|
| `describe()` | the sound annotation appears with its properties (**Sound**, **Duration**), read from the register |
| `edit.annotate('sound', { span, sound? })` | a sound annotation over the span, in `sound` or the default; refused when the name is not one the app serves |
| `edit.setProperty(id, 'sound', name)` | the sound changed; refused with a reason when the name is not one the app serves, or the annotation is not a sound |
| `edit.remove` / `edit.undo` | as for any annotation; the one undo covers placing, changing and removing a sound |
| MCP `annotate` | `kind` gains `"sound"` with a `sound` name; the description says the sounds are the app's own and there is no file to give |
| MCP `set_property` | its description names `"sound"` as a value of a sound annotation |

## Refusals

| refusal | when | answer |
|---|---|---|
| an unknown stock sound | creating, changing or restoring an annotation with a name the app does not serve | refused with a reason (making), or **left out** (restoring) — the rest of the clip opens |
| placing when there is no clip, or the clip is not in review, or the stretch is too short | the app's existing rules for adding any annotation | refused, as today |
| a sound the app cannot decode | fetching or decoding the file | the annotation is silent in the review and the file — never a failed clip or export |

None is new except the stock sound's: the rest are the rules the app already applies to adding
any kind and to a file that will not draw.
