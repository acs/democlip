# Contract: Magnifier Annotation

The app is a browser application: its contracts are the **operations a person or an agent
performs**, the **picture it draws**, and the **files it writes**. This file names what those
must accept for the feature; it does not restate the rules, which are in
[data-model.md](../data-model.md).

## The kind — the annotate options, the lane and the canvas

A **magnifier** is a fifth kind of annotation, added in the one place every kind is added and
found in the one place every annotation is found. It is a drawn kind, so it is offered where a
picture is.

| surface | contract |
|---|---|
| the **annotate options** | a **Magnifier** row beside **Arrow**, **Image**, **Text** and **Sound**, with a magnifying-glass mark. A **sound-only** clip does not offer it |
| adding one | it is placed over the selected stretch (or the default stretch at the playhead when none is selected). The person presses at the **centre of the detail** and drags outward; the draft shows the lens live and the release commits it. A stray click or a drag shorter than the smallest lens adds nothing and says the smallest size |
| the placed lens | a **circle**, wholly inside the picture, showing its own central `1 / zoom` enlarged and the rest of the picture dimmed, for the stretch and nowhere else |
| the picked state | two grips on the horizontal rim, and the family's **remove**, **copy** and **settings** controls. Dragging the body moves it; dragging a grip resizes it around the same centre; the lens stays round and inside, and never leaves the frame |
| the **timeline lane** | a mark for the kind at the start of its stretch, and the picked one's whole stretch as a band, exactly as for any annotation; clicking the mark picks it and brings the playhead to it |
| the shared operations | pick, move, resize, copy, paste, delete and undo are the canvas's and the clip's, the same gestures every kind has; the one undo covers placing, changing and removing a magnifier |
| the stretch | the selected stretch when one is chosen, the default at the playhead otherwise; changed afterwards by the shared **duration** |
| no picture, no clip, not in review | the kind cannot be added, and the person is told to open a clip in review and select a stretch |

## The picture

| part | contract |
|---|---|
| the lens | a true circle on screen, whatever the picture's shape, wholly inside the picture; no ellipse, no cropping by the frame |
| what it shows | the **central part of its own circle** — the region of radius `R / zoom` around the centre, enlarged to fill the lens; a 2× lens shows the middle half of its radius |
| the source | always inside the picture: the lens never samples off the frame, never invents content and never stretches the take; a take's own letterbox background around it is magnified as it is |
| the spotlight dim | the picture **outside** the circle is dimmed by one level the app chooses for the whole stretch; the app's own annotations stay bright and at their own size |
| the rim | a ring in the clip's **annotation colour** — or the colour the person chose for this magnifier — with a thin dark edge so it reads over light and dark pictures |
| the dissolve | the lens and the dim ease onto and off the picture at the edges of the stretch, as every annotation does, so neither pops |
| a still frame and playback | the same: a hold, a seek, the review and the export all draw the one lens from the one layer |
| the other annotations | never magnified and never dimmed; they are drawn over the lens at their own size and place |
| two lenses | each drawn and picked on its own, in the family's stable order; the later one is on top where they overlap |

## The preferences

The magnifier's **preferences** are the one shared inspector, opened from the settings control on
the picked lens, as for every drawn kind.

| property | contract |
|---|---|
| **Zoom** | a number from **1.5× to 8×**, in steps of 0.5, read as e.g. `2×`; a new magnifier starts at **2×**. The value applies to the lens alone: the circle's place and size do not move. A value outside the range is refused, the lens keeps its previous zoom, and the person is told |
| **Colour** | the rim's colour, from the app's palette; a change is one announcement, is kept with the clip and is what the one undo takes back |
| **Duration** | the shared duration every hand-placed annotation has: how long the lens and the dim are shown, in seconds of the clip |

## The file

Every output that carries drawn annotations carries the magnifier, and it is drawn by the same
layer that draws the review, so the file shows the same lens at the same moment.

| output | contract |
|---|---|
| the WebM and MP4 downloads, the YouTube upload and a published post | the same lens, rim and dim, over the kept part of the stretch, at the same place, size and zoom as the review |
| the export that carries its annotations **beside** it | the magnifier's numbers travel in the sidecar and come back on import, the way every kind's do; the file's picture carries no lens because the annotations are not drawn |
| a cut through the stretch | only the kept part shows the lens and the dim; the cut removes that moment from the picture for every kind alike |
| the recording | unchanged: the takes are not re-encoded, and with the annotations removed the clip is exactly the recording. A lens changes no recorded byte and no take's length |
| a sound-only clip | no magnifier is offered, and none is written: there is no picture to draw it on |
| a title card | no magnifier: the card draws only the clip's words and logo |

## Keeping it

| surface | contract |
|---|---|
| the clip's snapshot and the store | the magnifier's geometry travels as numbers, as any annotation's does; no schema change, no migration, no bytes |
| reload, or the publishing sign-in return | the magnifier comes back in place, at its size, zoom, colour and stretch |
| a file imported with a sidecar | the magnifiers it holds are taken on; a kind this build does not know is left out and the rest opens |
| a clip written by a later build | a magnifier shape this build does not know is left out; the rest of the clip opens and plays |

## The automation surface and the MCP server

| operation | contract |
|---|---|
| `describe()` | the magnifier appears with its **kind**, its **span** and its **geometry** (`x`, `y`, `radius`, `zoom`, `colour`) beside its **properties** (**Colour** and **Zoom**), read from the same annotation the view reads. `geometry` is reported for every annotation, so the shape of an arrow or a text is readable in the same place |
| `edit.annotate('magnifier', { span, x?, y?, radius?, zoom? })` | a magnifier over the span; `x`/`y` are the centre (centred when left out), `radius` is a fraction of the picture's **shorter side** (0.2 when left out), and `zoom` is 2 when left out. Refused with the kind's reason when the region is below the smallest lens, the centre cannot hold a lens, or the zoom is outside 1.5–8 |
| `edit.setProperty(id, 'zoom', '3')` | the zoom changed, as a person would in the preferences; refused with a reason when the value is outside the range or the annotation is not a magnifier |
| `edit.setProperty(id, 'colour', …)` / `'duration'` | the rim colour and the stretch, through the family's existing descriptors |
| `edit.remove` / `edit.undo` | as for any annotation; the one undo covers placing, changing and removing a magnifier |
| changing the **region** | by `remove` and a new `annotate` — the surface has no move or resize operation for any kind, and an arrow's points are changed the same way |
| MCP `annotate` | `kind` gains `"magnifier"`, with `x`, `y`, `radius` and `zoom` documented; the description says the centre, the shorter-side fraction and the zoom range |
| MCP `set_property` | its description names `"zoom"` beside `"colour"` and `"duration"` for a magnifier |
| MCP `describe_clip` | its description says each annotation carries its geometry |

## Refusals

| refusal | when | answer |
|---|---|---|
| a circle below the smallest lens | the drag is shorter than `MIN_RADIUS` of the shorter side, or an agent asks for one | refused with the smallest size; nothing is added |
| a zoom outside the range | a preference, an agent's `setProperty` or a restore | refused with the range; the magnifier keeps its zoom (a written-down one outside the range is left out on open) |
| a lens that would pass the picture's edge | placing, moving or resizing near an edge | pulled inside — the centre clamped or the radius capped — never lost and never made an ellipse |
| adding with no clip, outside review, or on a sound-only clip | the app's existing rule for a drawn kind | refused, and the person is told what is needed |
| a lens whose picture is not there at a moment | a cut took the stretch, or the frame is not drawn yet | nothing is drawn; when the frame and the stretch are back, the lens is back |
| a kind this build does not know | opening a clip or a sidecar | that annotation is left out; the rest opens and plays |

None is new except the lens's own smallest size and zoom range: the rest are the rules the app
already applies to every drawn kind and to a file that will not draw.

## What the person sees, in one line

A round window over the detail, the detail enlarged inside it and the rest of the picture darker
for as long as the annotation lasts — the same in the review and in every file the app writes.