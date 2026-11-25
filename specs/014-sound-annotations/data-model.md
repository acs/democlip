# Data Model: Sound Annotations

The feature adds no aggregate and no stored record of its own, and no schema version. It grows
the shapes the app already has: a fourth **annotation kind** with no shape and a sound's name, a
declared **list of stock sounds**, an **export plan** that answers where a sound lands and
whether there is sound to write, and a small **store** at the browser's edge that turns a name
into a decoded buffer. Nothing about the takes, the cuts, the clip properties or the profiles
changes.

## `StockSounds` — `src/domain/sound/StockSounds.ts` (new)

The app's own sounds, as data. Pure: names, labels, files, one level. No bytes, no `fetch`, no
clock.

| member | value / rule |
|---|---|
| `StockSound` | `{ readonly name: string; readonly label: string; readonly file: string }` |
| `STOCK_SOUNDS` | the declared list — the app's chosen set: `chime`, `gong`, `pluck`, `riser`, `thud`, `whoosh`, `wow`, each `(Label, ./sounds/<name>.wav)` |
| `isStockSound(name): boolean` | true when the list holds the name |
| `stockSound(name): StockSound \| null` | the entry, or null for one this build does not serve |
| `DEFAULT_STOCK_SOUND` | the sound a new annotation is made in — `'chime'` |
| `SOUND_LEVEL` | the one level an added sound is mixed at, the same in the file and the review |

**Rules**

- The `file` is **relative** (`./sounds/…`), so it is fetched from wherever the app is served —
  the same rule `web/public/logos/` follows.
- `isStockSound` is the whole of "may this annotation exist": a name it does not know is refused.
- `SOUND_LEVEL` is one number for the build, read by both the export's mix and the review, so
  "produced the same way" is true by construction. It is not a property and is not the person's.

## `SoundAnnotation` — `src/domain/annotation/SoundAnnotation.ts` (new)

The fourth kind. An id, a `Span`, and one fact: the stock sound's name. No geometry, no handles,
no picture.

| member | rule |
|---|---|
| `static id` | `'sound'` — the id both registries key on |
| `geometry` | `{ readonly sound: string }` — the stock sound's name |
| `create(span, sound, id?): SoundAnnotation \| null` | null unless `isStockSound(sound)` |
| `restore(stored): SoundAnnotation \| null` | null for a name this build does not know (left out, like an unknown kind) |
| `isUsable` | `isStockSound(this.geometry.sound)` |
| `handles(): readonly AnnotationHandle[]` | **`[]`** — there is no shape to drag |
| `withHandle(end, to, options?)` | **`null`** — there is nothing to resize |
| `movedBy(dx, dy): SoundAnnotation` | **`this`** — a move with nothing to move is a no-op (so a copy is placed unshifted) |
| `withSpan(span): SoundAnnotation` | a new one over the given stretch |
| `withSound(sound): SoundAnnotation \| null` | the same annotation playing another stock sound; null when it is not one — the **property**'s `with` |
| `duplicated(span): SoundAnnotation` | a new id, the same sound — what copy/paste makes |
| `hitTest(x, y, w, h, tolerancePx)` | **`false`** — never picked from the picture |
| `stored()` | `{ id, kind: 'sound', s, e, geometry: { sound } }` |

**Rules**

- A sound annotation is **never drawn**: it registers no drawing, and the layer skips a kind with
  no renderer, so nothing appears on the picture — the clarification's "nothing over the picture,
  ever".
- It is **never picked from the picture** (`hitTest` false, no handles); it is picked on the
  **lane** and edited from its **preferences**.
- It carries no bytes and no `AudioBuffer`: only the sound's **name**. The bytes are the app's
  file, resolved at the browser's edge.
- It is found by the family automatically: `AnnotationSet` (identity, order, overlap, `shownAt`),
  the clip's snapshot, the sidecar, the undo and the lane all treat it as any annotation.

## `kinds` — `src/domain/annotation/kinds.ts`

| change | rule |
|---|---|
| `registerKind(SoundAnnotation)` | a line, after the text — so `annotationFrom` rebuilds a sound (and answers null for a name this build lacks) |

## `ExportPlan` — `src/domain/clip/ExportPlan.ts`

| member | type | rule |
|---|---|---|
| `sound` | `readonly SoundAnnotation[]` | **new**: the kept sound annotations, given by `planExport` from the clip |
| `soundings()` | `readonly Sounding[]` | **new**: where each sound lands in the file |
| `audio` | boolean | **now also true** when `soundings()` is not empty — a silent clip with a sound annotation writes an audio track |
| `pieces`, `steps`, `takes`, `total`, `soundOnly`, `intro`, `introSeconds`, `fadeSeconds`, `annotations`, `soundBoost` | as today | unchanged |
| `localPieces()`, `annotationsAt()`, `recordingLength` | as today | unchanged |

```ts
export interface Sounding {
  readonly sound: string;   // the stock sound's name
  readonly at: number;      // where it lands in the file, in output seconds (past any card)
  readonly length: number;  // how long the kept part of its stretch is, in seconds
}
```

**Rules**

- `soundings()` is the intersection of each sound annotation's stretch with the **kept**
  stretches: one entry per piece it covers, so a **cut takes its part** of a sound exactly as it
  takes its part of the picture. A sound whose whole stretch is cut away answers **nothing**.
- `at` is in the **file's** seconds: it follows the pieces (past any title card), so the encoder
  and the review place the sound at the same moment without converting by hand.
- `length` is the kept part's length; a sound is never longer than the moments it was placed
  over.
- The plan owns the recording-to-file conversion, as it does for `localPieces()`; a caller never
  maps a span itself.
- `soundings()` is derived on the plan from `sound`, `pieces` and the map, and is a value — it
  can be read and tested in node with no browser.

## `planExport` — `src/application/export-clip.ts`

`planExport(clip, settings)` passes the clip's sound annotations (`clip.annotations.all`
filtered to the kind) into `ExportPlan.of`, so the download, `publishToBluesky`,
`publishToYouTube` **and** the review's own plan builder (`ui/clip/boost.ts`) all inherit them
with no caller threading them.

## The stock sound at the edge — `src/infra/stock-sounds.ts` (new)

Behind a port (`StockSoundPort`: `buffer(name) → Promise<AudioBuffer | null>`, `ready()`), with
the adapter here.

| member | rule |
|---|---|
| `buffer(name): Promise<AudioBuffer \| null>` | fetch the app's file for the name once, decode it **once** into an `AudioBuffer` at the app's rate, cache it by name; null when the name is unknown, the fetch fails or the decode fails |
| `get(name): AudioBuffer \| null` | the decoded buffer if it is already there, else null (drawing/playing never waits) |
| `ready(): Promise<void>` | resolves when every sound asked for so far is decoded — the export awaits this |
| `clear()` | let the buffers go with the clip |

**Rules**

- The bytes are fetched from the app's own folder beside it (`./sounds/…`), never uploaded and
  never from a service.
- A sound is decoded **once** and held, so a frame or a play is not a decode; a decode that
  fails is cached as "none" and contributes **silence** rather than failing a clip or an export.
- The buffer's rate is the context's, which is the app's mixing rate, so the review and the
  export use the same samples.

## The file's mix — `src/infra/offline-encoder.ts`

`renderAudio(plan)` is unchanged up to the boost; then:

**Rule**: after the recording is mixed and, when the boost is on, multiplied by the boost gain,
for each `plan.soundings()` the stock sound's samples are **added** into the rendered buffer at
`at · SAMPLE_RATE`, scaled by `SOUND_LEVEL`, clamped to the buffer. The added sound is therefore
**after** the gain: not measured by the boost and not lifted by it. `renderAudio` already
returns the buffer the file is encoded from, so both the video export and a **sound-only** clip's
sound file get the same mix.

## The review's mix — `src/ui/clip/sounds.ts` (new) and `src/ui/clip/playback.ts`

| member | rule |
|---|---|
| `tick(keptSeconds)` | called from the playback loop with where the playhead is **in kept time**; starts a stock sound's buffer when the playhead has **crossed** the start of a `sounding` while moving forward, and stops it at its end |
| `reset()` | called on a pause, a seek and a cut jump: clears the crossings so a jump fires nothing and a backward seek fires nothing twice |
| the source node | one `AudioBufferSourceNode` per playing sound, from the review's `AudioContext` (`elementAudio()`), connected to the destination **directly** — not through the boost node, since the boost treats the recording alone |

**Rules**

- The sounds the review plays are the **same `soundings()`** the file writes, so the moment is
  the same moment.
- A sound plays once per crossing; a backward seek resets, so it can play again when the
  playhead crosses forward again.
- Nothing plays outside a stretch; a cut through a stretch is silent over the cut, because a
  crossing only fires where a `sounding` exists.
- With no `AudioContext` (the browser refused one) the review is silent of annotations and the
  file still carries them; the gap is stated.

## The kind in the view — `src/ui/annotating/sound-plugin.ts` (new)

A plugin like the arrow, the image and the text, under the same id.

| member | rule |
|---|---|
| `id` | `SoundAnnotation.id` (`'sound'`) |
| `action` | `label: 'Sound'`, a title, a speaker icon — the lane's mark for the kind |
| `needsPicture` | **false** — offered on a clip with no picture |
| `properties` | one: `{ id: 'sound', label: 'Sound', control: 'sound', value, with }` — the sound's name, read and written on the annotation; the shared **duration** is added by `propertiesFor` |
| `renderer` | a **no-op** — the kind draws nothing; the layer would skip it anyway |
| `begin(ctx)` | make one in `DEFAULT_STOCK_SOUND` over the selected span and `ctx.commit` it, then open its preferences, so it plays at once and the choice is one press away |

**Property control**: `AnnotationPlugin`'s `PropertyControl` gains **`'sound'`**, and
`properties-inspector.ts` renders it as a **list of the app's stock sounds** (a labelled row per
sound, the current one told apart), applied through `property.with` and `clip.changeAnnotation`,
exactly as a colour's swatches and a text's words are.

## The lane, and a kind with no box — `src/ui/annotating/annotation-lane.ts`, `properties-inspector.ts`

**Rule**: a **picked** sound annotation is edited from the lane, since it has no box on the
picture. The lane draws its band as it does for any picked annotation and offers its three
controls beside it — **remove** and **settings** — as small buttons, so a touch screen
(no keys) can edit it; **settings** opens the shared inspector. The inspector's `place()` gains
a **fallback** for an annotation whose `handles()` is empty: it anchors beside the lane's picked
mark (the preview's lower area as the fallback), because there is no box to sit beside.

## `annotate-options` — `src/ui/annotating/annotate-options.ts`

**Rule**: with a picture, every registered kind is offered as today; with **no** picture, only
the kinds that say they need none (`needsPicture === false` — the sound). One flag on the plugin,
and the module still names no kind.

## The sidecar and the store — no shape change

| surface | rule |
|---|---|
| `ClipSnapshot.annotations` | the stored annotation, generically — the sound's name travels in `geometry` |
| `clip-store.ts` (`Meta`) | unchanged: every annotation is written as it is, the sound's name included |
| `AnnotationSidecar` | unchanged: it serialises every `StoredAnnotation`, so a sound travels beside a file and comes back through `annotationFrom`; an unknown sound is left out |
| `PROFILES_FORMAT`, `Profile` | untouched: a sound annotation is not a clip property and no profile controls it |

## The automation surface — `src/ui/agent/make.ts`, `describe.ts`, `mcp/src/tools.ts`

| operation | contract |
|---|---|
| `describe()` | a sound annotation's properties (**Sound**, **Duration**) appear with the others, read from the register; no change to the shape |
| `edit.annotate('sound', { span, sound })` | a sound annotation over the span, in the named stock sound (the default when left out), refused when the name is not one the app serves |
| `edit.setProperty(id, 'sound', name)` | changes the sound; refused when the name is not one, or the annotation is not a sound |
| MCP `annotate` | `kind` gains `"sound"`, with a `sound` name; the description says the sound is one of the app's own and there is no file to give |
| MCP `set_property` | already generic; its description names `"sound"` as a value of a sound annotation |

## State transitions

| from | event | to |
|---|---|---|
| a clip in review, a stretch selected | the person adds a **Sound** | a sound annotation in `DEFAULT_STOCK_SOUND` over the stretch, on the lane, its preferences open |
| the preferences, the sound changed | `clip.changeAnnotation` | the same annotation in another stock sound; heard in the review and written in every file |
| the duration changed | the shared duration property | the sound plays for the new length, and no longer |
| a cut approved through a stretch | the clip announces | `soundings()` no longer covers the cut; the sound is silent there |
| the sound copied and pasted | the shared canvas | a new sound annotation, its own id, the same sound, at the playhead |
| the sound deleted | the shared canvas | gone from the picture's set, the lane and the file; the one **undo** brings it back |
| the clip exported | `planExport` | the plan carries the sounds; `renderAudio` mixes them after the boost; every target inherits them |
| a clip with no recorded sound, a sound added | the clip announces | `plan.audio` is true; the file carries the annotation's sound |
| the page reloaded | the store loads the annotations | the sound comes back by its name; the app's file is decoded again at the edge |
| a file imported with a sidecar | `carry` | the sound annotations it holds are taken on; an unknown sound is left out |
| a stock sound this build lacks | open or restore | that annotation is left out; the rest of the clip opens |

## Validation rules

| rule | where | test |
|---|---|---|
| a sound annotation must name a stock sound | `SoundAnnotation.create`, `isStockSound` | `SoundAnnotation.test.ts`, `StockSounds.test.ts` |
| an unknown sound is left out, not a failure | `SoundAnnotation.restore`, `annotationFrom` | `SoundAnnotation.test.ts`, `kinds.test.ts` |
| a sound annotation has no shape and is never picked from the picture | `handles`, `hitTest` | `SoundAnnotation.test.ts` |
| `withSound` changes the sound and keeps id, span and kind | `SoundAnnotation.withSound` | `SoundAnnotation.test.ts` |
| a copy is the same sound with a new id | `duplicated` | `SoundAnnotation.test.ts` |
| the sound's name round-trips through `stored`/`restore` | `stored`, `restore` | `SoundAnnotation.test.ts` |
| the plan answers where a sound lands, in the file's seconds | `ExportPlan.soundings` | `ExportPlan.test.ts` |
| a cut takes its part of a sound | `ExportPlan.soundings` | `ExportPlan.test.ts` |
| a silent clip with a sound annotation has sound | `ExportPlan.audio` | `ExportPlan.test.ts` |
| the plan carries the clip's sound annotations | `planExport` | `export-clip.test.ts` |
| the file carries the sound, and the recording is unchanged | `renderAudio` | the `annotations.spec.ts` check |
| the review plays a sound at its stretch and nowhere else | `ui/clip/sounds.ts`, the playback hook | the `verify-*.html` harness, and the person's session |
| the sound's property appears in the preferences and to an agent | the plugin's `properties`, `describe` | the plugin/property tests, the `describe` test |
| a clip with no picture still offers the sound | `needsPicture`, `annotate-options` | the `annotate-options`/plugin test |
| every existing kind and cut behaves as before | the registries and the shared canvas | the existing `Arrow`/`ImageAnnotation`/`TextAnnotation`/`Clip`/`AnnotationSet` tests, unmodified |
