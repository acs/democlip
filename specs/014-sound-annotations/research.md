# Research: Sound Annotations

Phase 0 decisions. Each is the rule the spec asks for, placed where the app's layers say it
belongs: the naming and the plan in `src/domain/`, the browser capability behind a port or in
`src/infra/`, and the view listening. The two facts the clarification settled are marked, and
several decisions below exist because of them.

## A kind is a class with no shape — a sound, not a drawing

**Decision**: `SoundAnnotation` (`src/domain/annotation/SoundAnnotation.ts`) is a fourth
subclass of `Annotation`, like `Arrow`, `ImageAnnotation` and `TextAnnotation`. It holds the
**span** every annotation holds and one fact of its own — the **name** of the stock sound it
plays — in its geometry (`{ sound: 'chime' }`). Its shape is deliberately empty:
`handles()` answers `[]`, `withHandle()` answers `null`, `hitTest()` answers `false`, and
`movedBy()` answers `this` (a move with nothing to move is a no-op, not a refusal, so a copy is
placed without a shift).

**Why**: a kind is a class under the shared canvas in this app's design
(`.agents/skills/domain-model`), so a sound annotation must be one to get the family's
behaviour — selection, copy, delete, undo, the lane, the snapshot, the sidecar and the
automation surface — without writing any of it again. But it draws nothing: the thing it does
is heard, and drawing is the view's in any case, so there is no geometry to hold. The empty
shape is how "it is a kind like the others" and "it is not on the picture" are both true; the
canvas already tolerates an annotation with no handles (it draws none) and the layer already
skips a kind with no renderer.

**Alternatives considered**: a clip-level list of "sound events" beside the annotations —
rejected: it would fork the family, and every family feature (copy, delete, undo, the lane, the
snapshot, the sidecar) would need a second implementation. A `SoundAnnotation` with a hidden
anchor point so the shared picture picking could reach it — rejected: it would be a thing drawn
or hidden on the picture that the clarification says there is not, and picking a sound by
clicking the picture would be a lie about where a sound is. A kind that stores an `AudioBuffer`
in the domain — rejected: `src/domain/` may not touch the browser, and the bytes are the app's
own file anyway, so the clip need not carry them.

## The stock list is the domain's; the bytes are the app's files behind a port

**Decision**: `src/domain/sound/StockSounds.ts` declares the app's sounds as data —
`{ name, label, file }` for the app's chosen set — a **chime**, a **gong**, a **pluck** and more — with `isStockSound(name)`,
`stockSound(name)`, `DEFAULT_STOCK_SOUND`, and `SOUND_LEVEL` (the one level an added sound is
mixed at). The **files** live under `web/public/sounds/` and are served **beside** the app, the
way `web/public/logos/` serves the marks, with the path written **relative** (`./sounds/…`) for
the same reason `src/ui/logos.ts` writes `./logos/…`. `src/infra/stock-sounds.ts` fetches a
sound's file from where the app is served, decodes it **once**, and caches the `AudioBuffer` by
name, behind a small **port** — the same shape `src/infra/images.ts` gives a picture.

**Why**: the domain must be able to answer "is this a sound the app has?" so the kind can refuse
an unknown one and a clip from a later build opens, and the list is data with no DOM in it —
exactly as the colour palette and the logo list are read in node today. The **bytes** are
megabytes the clip must not carry and the browser must decode, so they are the infra's, fetched
from the app's own folder: nothing is uploaded, nothing is loaded by the person, and no service
is involved. `SOUND_LEVEL` is in the domain because the export and the review must mix at the
**same** level, and one constant read by both is how "produced the same way" is true by
construction rather than by two numbers kept in step.

**Alternatives considered**: embed the sounds in the bundle (base64 or an import) — rejected:
an import of an audio file is a build asset the domain cannot read and a node test cannot open,
and the app's own files beside it are how its marks already work. A `fetch` inside the kind —
rejected: the domain may not touch the network. A sound the person loads — rejected by the spec
(no loading; the sounds are the app's). A per-sound level the person sets — rejected by the
clarification (one fixed level for the build); `SOUND_LEVEL` is the build's, and a **volume**
property is the later iteration the spec names.

## A sound annotation stores a name, never bytes

**Decision**: `stored()` writes `{ id, kind: 'sound', s, e, geometry: { sound: 'chime' } }`. The
sound's bytes are the app's and are never in the snapshot, the store or the sidecar.

**Why**: a clip is a recording, its cuts and its annotations, and the store writes them apart
from the megabytes on purpose ("the cuts are a few bytes and move on every cut"). A sound
annotation is the same few bytes; carrying a copy of a stock sound would make the small half
big and would duplicate a file the app already serves. It also makes the clip portable: the
same clip means the same sound wherever it is opened, as long as the build has it.

**Alternatives considered**: store the decoded or the file bytes with the annotation — rejected:
large, redundant, and it would reach into `src/infra/` from a shape the domain owns. Store a
path the person chose — rejected: the app serves the sounds; a path is not the design.

## The plan answers where a sound lands, in the file's own seconds

**Decision**: `ExportPlan` (`src/domain/clip/ExportPlan.ts`) gains **`soundings()`** — for each
sound annotation, one entry per **kept** stretch it covers, each with the **stock sound's
name**, the moment it lands in the file (`at`, in output seconds, past any title card) and how
long that stretch is — and derives **`audio`** true when there are any. The annotations come in
from `planExport` (`src/application/export-clip.ts`), which reads them from the clip.

**Why**: the plan is where the app's two timelines meet and its header is explicit that no
caller converts between them by hand. A sound annotation's stretch is a fraction of the
**recording**, and where it lands in the **file** is what the encoder and the review both need;
putting that conversion in the plan is the same decision spec 011 made for the takes' audio and
spec 012 made for `localPieces()`. A cut through a stretch is handled **here**, once, as the
intersection of the annotation's span with the kept pieces — the same rule `shownAt` applies to
the picture, so a cut takes its part of a sound exactly as it takes its part of an arrow. The
`audio` derivation lives here because a clip whose takes are silent but which holds a sound
annotation **has sound to write**, and the plan is the one place that decides whether the file
gets an audio track at all.

**Alternatives considered**: hand the encoder the clip's annotations and let it map them —
rejected: it is the second conversion the plan's header warns against, and the encoder has no
`TimelineMap`. A `Sounding` as a value on the plan computed by a caller — rejected: the review
and the encoder must agree, and one derivation is how. Leave `audio` as it is and let a silent
clip with a sound annotation write no audio — rejected: the sound would vanish, which is the
one thing a sound annotation must not do.

## The file mixes the sound **after** the boost (clarification)

**Decision**: in `renderAudio` (`src/infra/offline-encoder.ts`) the recording is mixed and, when
the boost is on, multiplied by the boost gain **first**; then each stock sound is decoded and
its samples are **added** into the rendered buffer at its `sounding`, scaled by `SOUND_LEVEL`.
The added sound is not measured and not lifted.

**Why**: the clarification chose it. It keeps the boost's own guarantee intact — SC-002, "a clip
recorded at the target stays put" — because placing a clap cannot move the loudness the boost is
measured from nor the gain it applies. It is also the only order that does not make a sound
annotation change the recording's loudness, which is what "the recording is always heard beneath
it" means. Mixing by **sample addition into the already-rendered buffer** rather than by
scheduling a node in the same graph is what keeps the two apart: a node in the same graph would
be inside the mix the gain is applied to.

**Alternatives considered**: measure and lift the whole mix (the added sounds included) —
rejected by the clarification, and it would make a clap quietly change the recording's level.
Schedule the stock sounds as nodes in the same `OfflineAudioContext` and apply the boost to the
rendered result — rejected: the boost is a multiply over **all** samples in that buffer, so it
would lift the added sounds too. Apply the gain to the recording and schedule the sounds as
nodes in a **second** render, then sum — workable, but two renders and a sum is more machinery
than adding decoded samples into the buffer already in hand.

## The review plays a sound as the playhead crosses it

**Decision**: `src/ui/clip/sounds.ts` holds no schedule of its own between frames. On each turn
of the playback loop the loop says where the playhead is **in kept time**; the module starts a
stock sound's buffer from the review's `AudioContext` when the playhead has **crossed** the
start of one of its kept stretches while moving forward, and stops it when the playhead reaches
the stretch's end. A pause, a seek or a cut jump **resets** the crossing, so a jump never fires
a sound the playhead skipped and a seek backwards never fires one twice. The sounds come from
the same `soundings()` the encoder reads, so the two agree.

**Why**: the review plays the recording through the media element and **jumps over cuts by
seeking**, so kept time is not linear and a sound pre-scheduled against the audio clock would be
wrong the moment a cut is jumped. Crossing, checked against the same kept time the picture is
drawn at, is correct through a cut and a seek by construction, and it is the least machinery: a
buffer and a comparison, not a scheduler kept in step with a seeking element. The buffer comes
from the app's own file (`src/infra/stock-sounds.ts`), already decoded, so starting one is
`AudioBufferSourceNode.start()` — no decode at the moment it matters.

**Alternatives considered**: pre-schedule every sound on the audio clock at play — rejected: a
cut jump moves kept time under the schedule and the sounds would drift or a skip would land
mid-sound. A second `<audio>` element per sound, `play()`ed on a timer — rejected: it duplicates
the transport and fights the cuts. Render the whole clip's mix offline and play that in the
review — rejected for now: it is a real change to the review's transport (the clip today is
played take by take from the element), and it is the natural later refinement the boost's
research already points at if the review and the file ever need to be built from one mix.

## The sound is chosen in the annotation's preferences (clarification)

**Decision**: the sound is a **property** of the kind — `{ id: 'sound', label: 'Sound',
control: 'sound' }` — so it is edited in the annotation's **preferences**, the one shared
inspector every kind's properties are edited in, and there is **no file dialog and no chooser at
the moment of adding**: adding a **Sound** places it in `DEFAULT_STOCK_SOUND` at once and opens
its preferences, so it plays immediately and the person changes it in the one place the spec
names. `PropertyControl` gains `'sound'`, and the inspector renders it as the app's **list of
stock sounds** (a row per sound, told apart and labelled), read from `StockSounds.ts`.

**Why**: the user's own words put the selection *in the preferences*, and the clarification
confirmed the sound is **per annotation** and changed in its preferences. The property seam is
exactly how this app lets a kind change something after it is placed (a colour, a text's words),
and it makes the sound reachable from every surface at once — the panel, the preferences the
canvas opens, the automation surface and the sidecar — from one declaration. Placing the default
and opening the preferences is how "it plays at once" (FR-003) and "in the preferences" are both
kept: the sound is there to hear, and the choice is one press away.

**Alternatives considered**: a chooser dialog before placing (as the image picker chooses a
picture at creation) — rejected: it would not play at once, it would add a dialog no other kind
here has, and the spec puts the choice in the preferences. A file input — rejected: the sounds
are the app's; there is nothing to load. A clip-wide default with a per-annotation override —
rejected by the clarification (each annotation names its own; no clip-wide sound).

## A boxless annotation is edited from the lane

**Decision**: since a sound annotation is never picked from the picture, `annotation-lane.ts`
is its editing home: the picked sound annotation draws its band as today, and beside it the lane
offers the controls a picked annotation gets wherever it lives — **remove** and
**settings** — as small buttons, so a touch screen (no Delete key, no ⌘C) can still edit it. The
**settings** button opens the shared inspector, and the inspector gains a **placement for an
annotation with no box**: when `handles()` is empty it anchors beside the lane's picked mark
(with the preview's lower area as the fallback) rather than beside a box there is not.

**Why**: the shared canvas hangs a picked annotation's controls and its settings control off the
annotation's **box** (`controlSpot` needs two ends), which a sound annotation has not; and the
inspector places itself beside that box too. Rather than invent a box, the lane — which is where
the annotation already lives and is already the mark a person clicks — carries the controls, and
the inspector learns one fallback anchor. It keeps the one inspector and the one set of
operations, adds no drawing to the picture (which the clarification forbids), and gives the
sound the same "pick it, change it, copy it, delete it" the other kinds have.

**Alternatives considered**: draw a small marker over the picture while picked, to hang the
controls off — rejected by the clarification ("nothing over the picture, ever"). Open the
preferences automatically the moment a sound is picked — rejected as the only way: it makes
picking and editing the same act and gives no way to just look at where a sound is; the lane's
settings button is the explicit one, and adding a sound opens the preferences as the exception.
Put the controls at a fixed spot on the picture — rejected: controls detached from any visible
thing read as belonging to nothing.

## A clip with no picture still offers the sound

**Decision**: `AnnotationPlugin` gains an optional **`needsPicture`** (default true), the
**sound** kind sets it false, and `annotate-options.ts` offers a picture-less kind even when the
clip has no picture — showing only the picture-less kinds then, and every kind when there is a
picture.

**Why**: `annotate-options.ts` today renders no rows when `!clip.hasPicture()`, which is right
for an arrow, an image or a text — there is no picture to draw on — and wrong for a sound, which
is heard and needs no picture. The spec's FR-019 asks for exactly this, and one flag on the
plugin is the least that says a kind's need of a picture is the kind's own fact rather than the
options row's. A sound-only clip is then a first-class home for the kind, as the spec's third
story asks.

**Alternatives considered**: special-case the sound kind by id in `annotate-options` — rejected:
the module "names no kind" by design, and a flag keeps that true. Offer every kind on a
picture-less clip — rejected: an arrow on a file with no picture is a lie.

## An unknown stock sound is left out, not a failure

**Decision**: `SoundAnnotation.create` refuses a name `isStockSound` does not know, and
`restore` answers `null` for one, exactly as `kinds.annotationFrom` answers `null` for a kind
this build does not know. A clip or a sidecar carrying a sound this build lacks opens with that
annotation left out and the rest intact.

**Why**: it is the rule the app already has for a kind and for a logo name ("a name the app
does not serve is refused rather than kept, so no export waits on a file that will not draw"),
and it is what the spec's FR-022 asks. It is also what keeps a clip written by a later build —
with a sound this one has not got — from failing to open.

**Alternatives considered**: keep an unknown name and draw/play nothing — rejected: it would
leave an annotation that can never be heard or changed sitting on the lane, and the app's own
rule is to refuse a name it cannot serve. Fail the open — rejected: one unknown sound must not
cost the clip.

## The sidecar and the automation surface carry it with no new shape

**Decision**: the sidecar writes every annotation generically (`annotation-sidecar.ts` already
serialises `StoredAnnotation`), so a sound annotation travels beside a file and comes back
through `annotationFrom`, an unknown sound left out. The automation surface's `describe()` lists
the kind's properties from the register, so **Sound** and **Duration** appear with no change,
and `edit.annotate` gains the kind: `make.ts` grows `makeSound(kind, params, span)` — a name
from `StockSounds`, refused when it is not one — and MCP's `annotate` gains `kind: "sound"` with
a `sound` name; `set_property` already edits any annotation's declared property, so the sound is
changed through it.

**Why**: a sound annotation is a kind like the others, so it should reach the agent the way they
do — through the same `annotate`/`set_property`/`describe` shape, not a new tool — and the
sidecar already exists for exactly this ("the annotations a file carries, written beside it").
The maker is **data alone** (a name), so it needs nothing from the browser, which is why step 4
can create one to prove the export before the view exists.

**Alternatives considered**: a separate `add_sound` tool (as `add_image` is separate because it
reads the clipboard) — rejected: a sound is a name in the data, like an arrow's points, so it
belongs in `annotate`. Write the sound's bytes into the sidecar — rejected: the bytes are the
app's, and the name is enough.

## No fade, and one level (clarifications)

**Decision**: a sound annotation plays its stock sound at full level for its whole stretch,
with **no fade** the app adds and at **one level for the build** (`SOUND_LEVEL`); there is no
volume property.

**Why**: both were chosen in the clarifications. A sound effect's attack is the point, and the
app's sounds carry their own shape, so a fade the app added would blunt the clap and the gong.
One level is the MVP's scope: the app's files are mastered to sit over a voice, and a **volume**
is a property a later iteration can add to the kind, as a kind declares its properties.

**Alternatives considered**: a fade at the ends (to match a visual annotation's dissolve) —
rejected by the clarification. A per-annotation volume — rejected by the clarification; it is
the named later iteration.

## Verification: the kind in node, the file in the browser, the ear in a session

**Decision**: the rules are unit-tested in node — `SoundAnnotation.test.ts` (a stock sound is
required, an unknown one refused, no handles, no pick, `withSound`/`duplicated`/`restore`),
`StockSounds.test.ts`, `kinds.test.ts` (the kind restores; an unknown one is left out),
`ExportPlan.test.ts` (the soundings, a cut through a stretch, a silent clip gaining `audio`) and
`export-clip.test.ts` (the plan carries the clip's sounds); the plugin's action and the `sound`
property join the plugin/property tests. One committed check in
`e2e/checks/annotations.spec.ts` places a sound annotation through the **data-only maker**,
exports the clip, and reads the file back to prove the stock sound's samples are in it at its
stretch and the recording is otherwise unchanged — and that a clip with no recorded sound
**gains** sound. A temporary `verify-*.html` harness proves the review's trigger, the lane's
boxless editing and the plugin's creation, which no suite can capture (the page's audio is not
observable from outside).

**Why**: the verification skill asks for a unit test per rule and a committed browser check for
what is heard or encoded, and it prefers a fixture take for an export check. The maker is
data-only, so the check does not need the view; the file is read back and its samples inspected
in the page, so the check proves the real rule rather than a stand-in. The review's mix is a
browser behaviour the suite cannot hear, so it is the harness and, finally, the person's own
ear — stated, not hidden.

**Alternatives considered**: a check per behaviour (place, change sound, change length, copy,
delete, undo, sound-only, cut) — rejected by the skill's one-or-two rule; the two checks walk
the file story and the review harness walks the editing story, and the shared operations are the
existing ones already checked. Capture the review's audio in the suite — rejected: Playwright
cannot record the page's sound, and a Web Audio graph is not observable without a hook the app
does not have.

## What is deliberately not changed

**Decision**: the **takes** are never re-encoded, the **sound boost** keeps treating the
recording alone, the **picture** of an export is untouched, and the **size estimate** is
unchanged.

**Why**: the non-destructiveness is what "removing the annotations gives the recording back
whole" rests on; the boost's separation is the clarification; and a sound changes sound only, so
the picture and the encoder's bitrate — and so the size at a given second — do not move.

## Where a later refinement would go

**Decision**: a **volume** on a sound annotation would be a further **property** of the kind
(`PropertyControl` `'level'`, a stored number beside the sound's name), read by both the
encoder's mix and the review's trigger from the one declaration — no new mechanism. A further
**stock sound** is a line in `StockSounds.ts` and a file under `web/public/sounds/`.

**Why**: the app's pattern is that a kind declares its properties and a list is declared in one
place, so both are additions and not changes — which is exactly what the register already
promises for the clip's own properties and the kind's.

**Alternatives considered**: bake a level into the file — rejected: it makes the app's one
level a per-file accident and forecloses the property the spec names as the later iteration.
