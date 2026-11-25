# Contract: Sound Boost

The app is a browser application: its contracts are the **operations a person or an agent
performs**, the **files it writes**, and the **domain seams** the rest of the code asks. This
file names what those must accept for the feature; it does not restate the rules, which are in
[data-model.md](../data-model.md).

## The clip property — the settings row

**Boost the sound** is offered in the clip's settings panel, in the profile's definition
sheet, and to the automation surface, from the one register entry
(`src/ui/clip/clip-properties.ts`).

| surface | contract |
|---|---|
| the panel | a **switch**, **on** for a clip that never touched it; turning it off writes `'false'` and turning it on clears the value |
| the row when a profile fixes it | a value with the **lock** naming the profile and nothing to press — "On" or "Off" |
| the profile's sheet | **Free** / **On** / **Off**, told apart as for **Add to export**; **Off** declares an empty value, which applies `'false'` to the clip |
| the clip's snapshot | the value travels in `properties` as any other; absent means on, `'false'` means off |

The property is **seedable**: `seedableClipProperties()` includes it, so `applyActiveProfile`
fixes it on an empty clip and nothing else about the register changes.

## The export plan

`ExportPlan` carries **`soundBoost`**, set by `planExport` from `boostsSound(clip.properties)`.

| question | answer |
|---|---|
| is the clip's sound to be boosted? | `plan.soundBoost` — true for a clip that never set the switch, or set it on |
| is there sound to boost? | `plan.audio` — independent; a plan with no sound does nothing |

Every path that encodes builds its plan through `planExport` — the WebM download, the MP4 for
Bluesky, the YouTube upload — so all three inherit the boost with no caller threading it.

## The file

| property | contract |
|---|---|
| loudness | within ±1 LU of **−16 LUFS** integrated when the boost is on and the clip has sound |
| peak | no sample above **−1.5 dBFS** |
| channels, low end, dynamics | unchanged from the recording |
| picture | identical to the same export with the boost off |
| containers | as today: WebM/Opus and MP4/AAC, download and publish alike |
| a **sound-only** clip | boosted the same way; its file is the sound alone, as spec 011 defines |
| with the boost off | the recorded sound: the takes decoded and mixed exactly as before |

The boost is applied as one multiply over the mix `renderAudio` already produces, so nothing
about the container, the bitrate, the duration or the tracks moves.

## The review

| surface | contract |
|---|---|
| the sound heard while reviewing | the boosted sound — the same gain the file gets |
| the graph | `element → fade gain → boost gain → destination`; the join fades are the first node's, the boost the second's |
| when it is measured | when the review first needs the boost — on opening, the switch being on by default — and again when the clip's sound changes (a take, a cut); the switch alone does not re-measure, it applies or drops the cached gain |
| with the boost off, or no sound | the boost node sits at **1** — the recorded sound, unchanged |
| the waveform | **the level the sound is heard at**: the bars are scaled by the same gain the review plays and the file carries, so a quiet recording reads as the boosted one, and the shape is unchanged. The live timeline scales the bars it carries from the clip the same way |
| the size estimate | unchanged: the encoder's bitrate sets the size, not the boost |

The review's gain and the encoder's gain are the **same number**, from the same kept
stretches, measured by the same `boostGain`.

## The automation surface and the MCP server

| operation | contract |
|---|---|
| `describe()` | lists **Boost the sound** with the register's other clip properties: its label, its control (`toggle`), its value (`"true"`/`""`), and `readOnly` true when a profile fixes it |
| `edit.setClipProperty('soundBoost', value)` | `"true"` turns it on, anything else off; refused with the profile's name when a profile fixes it; a change the one undo takes back |
| MCP `set_clip_property` | `property` gains `"soundBoost"`; the description says the switch is on by default and that `"true"` turns it on and anything else off |
| MCP `describe_clip` | the property appears with the others; no change to the tool's shape |

## Refusals

None is new. The boost is never refused: a clip with no sound has nothing to boost and the
gain is 1, and a clip with no picture still has its sound boosted (a sound-only export is
boosted like any other).

## The recipe it replaces

The *improve the sound* recipe (`.agents/skills/recipes/improve-the-sound.md`) is updated in
this change: its loudness step is what the app now does itself, always. The recipe keeps the
steps the app still does not do — the measurement an agent reads, the presence lift, the
choice to work outside — and says that the loudness is no longer the reason to reach for
ffmpeg.
