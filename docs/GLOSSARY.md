# Glossary

The words this project uses, and what they mean. This is the base of the
*ubiquitous language*: the code, the commits, the pull requests and the interface
should all use these words, and use them for the same things.

If a concept is missing, name it here **first**. If a word in the code disagrees
with one here, one of the two is wrong — and it is worth fixing then rather than
later. (This file exists because "take" and "part" were both in the code for the
same thing, which cost a rename across nine modules to undo.)

A concept that needs rules is a **class named after the word**, and the third
column says which. The ones that hold rules and relate others are **aggregates** —
`Clip` is the one the app is built around — and every rule in `domain/` has a test
beside it.

## The recording

| word | what it is | in the code |
|---|---|---|
| **session** | one sitting of the app: the clip, and whether it has begun to capture. Over at **New**, when the clip is exported, or when the share ends | `Session` (`src/domain/session/Session.ts`, `session.end()`) |
| **take** | one arrival of a recording: a press of Record (one MediaRecorder WebM), or an **import**ed file. It has its own length, its picture and its sound, and the takes are played in order | `Take` — id, blob, url, duration, picture, hasAudio |
| **sound** | what a take carries beside its picture: the recorded audio track. A clip **has sound** when any of its takes does, and **keeps sound** when any kept stretch does; a picture take may be silent, and a **sound-only** take always has it | `Take.hasAudio`, `Clip.hasSound()`, `Clip.keepsSound()` |
| **sound boost** | the clip's sound brought to the app's one loudness target — about −16 LUFS for speech — with peak safety, so a recording plays where a player expects it. It is **on** unless the clip says otherwise, and it is a clip property a **profile** may fix. One measurement of the clip's kept sound decides one gain, and that gain is applied to the sound as it is heard and written; the recorded sound is never changed, so switching it off gives the take back whole | `SoundBoost` (`src/domain/sound/SoundBoost.ts`), `Loudness` (`src/domain/sound/Loudness.ts`), `ExportPlan.soundBoost` |
| **clip** | all the takes, in order, plus what was cut out. What everything else asks what to show and what to export | `Clip`, the aggregate |
| **take repository** | where a clip's takes come from, and the only owner of their object URLs | `TakeRepository` (the port), `InMemoryTakeRepository` |
| **record source** | what a take is made of: the shared **screen**, the **webcam** and the **microphone**. Three independent toggles, **all off at start** — nothing is captured until one is pressed. A take needs a source: a picture — the screen, or the webcam when the screen is off — or the microphone alone, which makes a **sound-only** take. With the screen off nothing reaches for a share | the source buttons (`#screen-btn`, `#webcam-btn`, `#mic-btn`) |
| **sound-only** | a take, or a whole clip, of sound and no picture: the microphone is the only source. Its review is the **waveform** where the strip would be; its export is a **sound file** (`audio/webm` or `audio/mp4`, with no video track); and a video service refuses it. A clip may hold sound-only takes and picture takes, with black over the sound-only stretches of a video file | `SourceSet.soundOnly`, `Clip.hasPicture()`, `Clip.keepsPicture()`, `ExportPlan.soundOnly` |
| **join** | the seam where one take ends and the next begins — where the sound fades and the picture dissolves | `FADE_S`, `DISSOLVE_S` |
| **import** | bringing a **take file** in as a take: its own bytes become a take, appended to the clip, and nothing is re-recorded | `ImportTake` (the use case), `ui/recording/import-flow.ts` (the flow) |
| **take file** | a media file chosen to import — a video, or a **sound-only** file — WebM or MP4, the two containers the export reads back, which is why they are the only two taken | `TakeFile` (`src/domain/clip/TakeFile.ts`) |

A clip's length is **the sum of its takes** — derived, never a field beside them.

A take arrives one of two ways: a press of Record (**record source**) makes one, or a
file is **imported**. An import is not a fourth source — a source is a live device, and
all the sources are off at start, while a file is already a finished recording — so
**Import** is an action beside the clip's other actions rather than a toggle in the
source row. Where it has arrived from, a take is a take: an imported one is cut,
annotated, exported, published and kept exactly as a recorded one is.

## Keeping the recording

A clip lives in the page. The one thing that takes it away is the walk out to
Bluesky to sign in, so the clip is written down before that trip and read back on
the way in — and, because the writing is not only for that trip, a reload or a new
version comes back to it too. The session is over, and the kept copy let go, at
**New** — or when the clip is exported: the file written, or the post published.

A take is megabytes and never changes; the cuts are a few bytes and move on every
cut. They are kept apart, so writing a cut never means writing the recording
again.

| word | what it is | in the code |
|---|---|---|
| **clip snapshot** | everything a clip is made of, written down: its takes (the recording bytes and their lengths) and its cuts | `ClipSnapshot`, `Clip.snapshot()` |
| **restore** | rebuilding a clip from a snapshot and opening the review on it. Nothing is announced: it is a load, not a change | `Clip.restore()`, `resumeClip()` |
| **clip store** | where a snapshot outlives the page: IndexedDB, the only store here that takes a Blob. A take is written once as it arrives; the cuts are written on their own. Read at startup, dropped when the session ends | `src/infra/clip-store.ts`, `src/resume.ts` |

## Cutting

| word | what it is | in the code |
|---|---|---|
| **mark** | a position on the clip placed by a click, as a fraction (0..1). Two marks bound a section. **View state, not the clip's** | `selection.marks`, read through `selection.section()` |
| **section** | what the two marks bound — the stretch the user is pointing at, about to be cut out or annotated. A proposal: nothing has left the clip yet | `selection.section()`, a `Span` |
| **selection** | the stretch the user is pointing at: the two marks and the section they bound. An action is chosen for it — cut it, or annotate it | `ui/cutting/selection.ts` |
| **cut** | a section that was **approved**: it has left the timeline, and playback and the export skip it | `Clip.cuts`, a `SpanSet` |
| **span** | a range, half-open: `[s, e)`. The smallest thing a timeline is made of | `Span` |
| **timeline** | the strip under the preview, drawn in **kept time** — a cut has no width on it | `ui/clip/timeline-ui.ts`, `ui/recording/live-timeline.ts` |
| **thumbnail** | one cell of the strip: a small picture of a frame, at the take's own shape. A crop's picture is not 16:9, and stretching it into a fixed cell would show a picture the clip does not hold | `thumbBox()`, `drawThumb()` in `ui/clip/thumbnail.ts` |
| **recording time** | where a moment is *in the recording* | `TimelineMap.sourceOf()` |
| **kept time** | where that moment *appears on the timeline* | `TimelineMap.keptOf()` |

`TimelineMap` is the only place that converts between recording time and kept
time. Passing one where the other was meant is the mistake it exists to prevent.

## Annotating

Something drawn over the picture, for a stretch of the clip's time. A kind is
described once — its shape in the domain, and a **plugin** in the view naming its
action, its renderer and how a new one is made — and every kind is edited the same
way, by the **annotation canvas**. A kind also says what can be **changed** about it
after it is placed — its **colour**, a text's **words** — and one **properties
inspector** edits them, whatever the kind. The stretch is chosen with the
**selection** — the same one a cut is approved from — so there is one way to point at
a stretch of the clip, whatever is then done with it.

| word | what it is | in the code |
|---|---|---|
| **annotation** | something drawn over the picture of a clip, for a stretch of its time. It has a **kind**, the **span** it is shown over, and a geometry its kind shapes | `Annotation`, `Clip.annotations` |
| **annotation kind** | what makes one annotation different from another — an arrow or an image. Its rules (how a geometry is normalised, whether it is worth keeping, how it resizes) live in the domain; how it is drawn and made lives in the view, under the same id | `AnnotationKind`, `kinds.ts`; the kind's `AnnotationPlugin` |
| **annotation plugin** | everything a kind is in the view: its action on a selected stretch, its renderer, and how a new one is made (`begin`). Added with the kind, under the kind's id; it never describes selecting, moving, resizing, copying, deleting, saving or exporting, because those are shared | `AnnotationPlugin`, `ui/annotating/annotation-plugin.ts`, `ui/annotating/<kind>-plugin.ts` |
| **annotation canvas** | the one shared editing surface every kind gets: pick, move, resize, copy, paste, delete and undo. It names no kind — it asks the annotation and the clip | `ui/annotating/annotation-canvas.ts` |
| **annotation property** | something about an annotation the user can change after it is placed — its colour, a text's words. Its kind declares it: a label, which shared control edits it, and how to read and write the value on the annotation. The value lives with the annotation | `AnnotationProperty`, `AnnotationPlugin.properties`, `propertiesOf()` |
| **properties inspector** | the one shared surface that shows and edits the picked annotation's properties, whatever its kind. Opened from a **settings control** on the picked annotation; it names no kind, it asks the plugin | `ui/annotating/properties-inspector.ts` |
| **arrow** | the first kind: a line with a head, given by where it starts (`from`) and what it points at (`to`), in fractions of the picture. Its ends are its resize | `Arrow`, `ArrowGeometry`, `ui/annotating/arrow-plugin.ts` |
| **image annotation** | the second kind: a chosen picture over the picture, a rect in fractions with the picture's own proportions kept on resize | `ImageAnnotation`, `ImageGeometry`, `ui/annotating/image-plugin.ts` |
| **text annotation** | the third kind: a line of text over the picture, a box in fractions that scales with its font, so the text grows and shrinks with the box | `TextAnnotation`, `TextGeometry`, `ui/annotating/text-plugin.ts` |
| **sound annotation** | the fourth kind: a **stock sound** shown over a stretch of the clip's time and **mixed with the recorded sound**, so the recording is heard beneath it. It draws nothing — it is heard, not drawn — so it has no shape on the picture: it is never picked there, and it is found and edited on the **annotation lane**. The sound it plays is its own fact, its **preferences**, and a new one is made in the app's **default stock sound** and plays at once. A **cut takes its part** of its stretch, exactly as it takes a picture's; the clip's **sound boost** treats the recorded sound alone, and an added sound sits over it | `SoundAnnotation`, `SoundGeometry`, `ui/annotating/sound-plugin.ts` |
| **magnifier** | the fifth kind: a round **lens** over a detail of the picture, which shows the **magnified region** enlarged and lays the **spotlight dim** over the rest, for the stretch of the annotation. It is the first kind whose renderer **reads the picture beneath it**: the layer takes one copy of the frame before any mark is drawn and hands it in, so the lens enlarges the recording and not the app's own annotations. It is made by dragging from the detail outward | `Magnifier`, `MagnifierGeometry`, `ui/annotating/magnifier-plugin.ts` |
| **lens** | the magnifier's circle, given by its centre and its radius as a fraction of the picture's shorter side, so it stays round on any picture shape. Its two grips sit on the rim and resize it about the same centre | `Magnifier.geometry`, `Magnifier.handles()` |
| **magnified region** | the part of the picture a lens shows enlarged: the central part of its own circle — the region of radius `R / zoom` around the centre — drawn to fill the lens. A 2× lens shows the middle half of its radius | `Magnifier.draw()` |
| **zoom level** | how much a lens enlarges its **magnified region**, from 1.5× to 8× and 2× unless chosen. A property of the lens, changed after it is placed; a 2× lens shows the middle half of its radius | `Magnifier.geometry.zoom`, `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM` |
| **rim** | the edge of a lens: a thin dark outline first, so the mark reads on light and dark pictures, then the annotation's own **colour**. The colour property paints the rim | `Magnifier.colour`, `MagnifierPlugin.draw()` |
| **spotlight dim** | the darkening of the picture outside the lens, one fixed level, so the eye goes to the detail. It covers the picture only — the app's own marks are drawn over it at full strength — and it is drawn for as long as the magnifier's stretch lasts | `DIM_ALPHA`, `MagnifierPlugin.draw()` |
| **stock sound** | one of the app's own sounds — a **chime**, a **gong**, a **pluck** and more — served with the build under `web/public/sounds/`, chosen from the list the app declares. The preferences choose it from a **drop-down**, with one **▶** to hear the chosen one. Not a file the person loads, records or pastes: a clip holds the sound's **name**, never its bytes, and a name the app does not serve is refused (or left out when a clip from a later build is opened) | `StockSounds.ts` (the app's own list), `src/infra/stock-sounds.ts` (the file, decoded once) |
| **colour** | one flat colour an annotation is drawn in, from the app's own palette; a **new** one is made in the clip's **annotation colour**, and the user may choose another after it is placed | `AnnotationColour`, `colourOf()`, `COLOURS` |
| **text entry** | the app's own dialog for typing a line — an input, Cancel and Add, Enter to confirm, Escape to cancel — used for entering a text and for editing its words | `ui/annotating/text-entry.ts` |
| **image store** | where an image annotation's picture is kept, written once apart from the recording, and the decoded copy drawn each frame | `ImageStorePort`, `src/infra/images.ts` |
| **annotation lane** | the row on the timeline marking each annotation at the start of its stretch, in kept time, so one can be found without playing the clip. The **picked** annotation's whole stretch is drawn on it as a band — the **active stretch** | `ui/annotating/annotation-lane.ts` |
| **annotation layer** | the one place an annotation is drawn, used by playback and by the export alike, so the file matches the review — and the one place a picked annotation's grips are drawn, for every kind | `ui/annotating/annotation-layer.ts` |
| **annotation duration** | how long an annotation is shown, held as a value of the annotation: its **span**. A new one takes the selected stretch's length, or a fixed default when nothing is selected, and it can be changed afterward from the annotation's **preferences** as a seconds value. Seconds of the recording, so a new take lengthens the clip without stretching it | `Annotation.withDuration()`, `DEFAULT_ANNOTATION_S`, `MIN_ANNOTATION_S`, `ui/annotating/duration-property.ts` |
| **annotate options** | the one control that offers every kind of annotation on the **picture** — a vertical row per kind, just below the clip's settings control — rather than on the selected stretch of the timeline: one place a kind is added, with no row able to crowd another | `ui/annotating/annotate-options.ts` |
| **active stretch** | the stretch of the timeline the person is working on: the **picked** annotation's, drawn as a band beside a selected cut section and told apart from it. The timeline shows more than one stretch at once, all in kept time | `ui/annotating/annotation-lane.ts`, `ui/cutting/marks.ts` |

An annotation's geometry is held in fractions of the picture, so it lands in the
same place on the preview, on the export canvas and after a reload. Every kind is
offered in one place — the **annotate options**, a vertical row per kind on the
picture below the clip's settings control — and how long one is shown is its
**annotation duration**, a value it holds and the person can change from its
preferences rather than a stretch fixed at the moment it was made. It **dissolves
onto the picture** over the first moments of its stretch and **off it** over the
last, as a take does at a join, so it never pops in or out. A **cut takes its part
of an annotation's stretch with it** — the moment is gone from the timeline, so
nothing is drawn there — and putting the cut back brings it back.

A **sound annotation** is the kind that is heard rather than drawn: it holds no
geometry, so it is never picked on the picture, and the **annotation lane** is where
it is found and edited. It is still an annotation in every other way — added in the
**annotate options** (it needs no picture, so a **sound-only** clip offers it too),
shown for its stretch, in the review and in every file, with a **cut** taking its part
and the one **undo** covering it — and its **preferences** are where its **stock sound**
and its **annotation duration** are changed.

A **magnifier** is the kind that reads the picture beneath it: a round **lens** over a
detail, which shows the **magnified region** enlarged and lays the **spotlight dim** over
the rest for the stretch of the annotation. It is added in the **annotate options** like
every other kind, but it needs a picture — a **sound-only** clip does not offer it. Its
**preferences** are its **rim**'s colour and its **zoom level**, plus the shared
**annotation duration**. The layer takes one copy of the frame before any mark is drawn
and hands it to the lens, so the magnified region is the recording and never the app's own
annotations; the same copy is taken in the review and in every file the app writes.

## What a clip says about itself

An **annotation**'s properties are declared by its **kind** and live with the annotation.
A clip's are declared by the app and live with the clip: its **title** and its
**description**, what it says about itself rather than what is drawn over its picture; its
**logo**, the mark it wears at the head of every export; its **annotation colour**, the
colour every new arrow and text is made in; and **add to export**, which asks the export
for a **title card** at the head of the file.
The title and description are what a **publish** fills its fields from — a YouTube
video's title and description, a Bluesky post's text and its alt — so a clip is branded
once and the branding goes out wherever it is published; either may still be changed in a
publish dialog, for that one publish. And **every export takes the card**, a publish
included, so a published video opens with the same words the file would. The switch asks
for a card, so it is offered only once there is something to put on one — a title, a
description or a logo — and says why underneath while there is not; a switch already on
stays the person's to turn off.

| word | what it is | in the code |
|---|---|---|
| **clip property** | something about the clip the user can change after it is made — its title, its description, its **logo**, its **annotation colour**, its **clip size**, its **export resolution**, or **add to export**. The app declares it: a label, which shared control edits it, and how to read and write the value on the clip. The value lives with the clip | `ClipProperty`, `registerClipProperty()` (`ui/clip/clip-properties.ts`); the value in `ClipProperties` (`src/domain/clip/ClipProperties.ts`) |
| **logo** | the mark the clip wears at the head of every export: **one of the marks the app serves itself**, from its own folder in the repository, chosen from the **list the app declares** — or nothing, which is the ordinary case. It is drawn **at its own proportions — scaled, never stretched** — as tall as the card's **logo row**, so marks of any shape are read at the same size. It is a **clip property**, a value rather than a switch, and a name the app does not serve is refused rather than kept, so no export waits on a file that will not draw. A clip that wears one opens with a **title card** carrying it, and wears it as a **watermark** over the whole clip | `ui/logos.ts` (the app's own list), the value in `ClipProperties` |
| **annotation colour** | the colour a **new** annotation is made in — one of the palette's colours, **red** unless the clip or a profile says otherwise. It is a **clip property**, chosen from the **list the app declares** and drawn as a swatch beside its name wherever it is chosen; a profile may fix it, so every arrow and text made under that profile starts in its colour. It colours what is made **next**: an annotation carries the colour it was made in, and its own **colour** property changes that one. The one exception is the **watermark**'s title line, which is placed in it and repainted by a change to it, because it is the clip's own branding rather than something placed by hand — the **title card**'s words keep the app's own | `annotationColour()` (`ui/clip/clip-properties.ts`); `COLOURS`, `COLOUR_LABELS`, `DEFAULT_ANNOTATION_COLOUR` (`domain/annotation/AnnotationColour.ts`) |
| **watermark** | the annotations the clip wears over the **whole** of its picture: its **logo** as an **image annotation** spanning the whole clip, and — when it has one — its **title** as a **line of text half the mark's height**, **in the clip's annotation colour**, under the mark, or on its own in the corner when the clip wears no mark. Both small in the top-right corner and **scaled, never stretched**, so the branding is on every frame and not only on the card at its head. They are ordinary annotations of the kinds the app already has — nothing inside a kind marks one as a watermark — and the **clip** keeps which ones they are, writing their ids down with itself. So they show on the **timeline lane**, can be picked, moved, resized and edited like anything else the person places, are kept with the clip and are drawn into every export. Each part follows its **own** property — setting the **logo** places the mark and clearing it takes the mark away, and the **title** the line — so a part the person takes away stays away until its own property moves | `Clip.watermarks()` and `Clip.setWatermarks()` — the ids, written down in `ClipSnapshot`; the reconciler in `ui/clip/watermark.ts`; the placement in `ui/annotating/picture.ts` |
| **clip size** | the picture the clip is worked in — the frame the **review** shows and every take is fitted into: a width and a height, both **even**. It is the takes' largest width and largest height, rounded up to even, and grows as a larger take arrives. It is derived from the takes and is **not the person's to set**; the size a **file** is written at is the **export resolution** | `ClipSize` (`src/domain/clip/ClipSize.ts`), `Clip.size()` |
| **export resolution** | the size the clip's **file** and a **publish** are finally written at — a width and a height, both **even** — as a **clip property** the person sets and a **profile** may fix. It is **optional**: with none, the file is the **clip size**, exactly as before it existed. It is the clip size **scaled** by one factor, so it keeps the clip size's **aspect ratio** — the file is the same picture as the review at fewer (or more) pixels, with nothing cropped, stretched or letterboxed — and the encoder's bitrate follows its picture, so it is what controls the **file's size**. The review and the clip size are not changed by it | `EXPORT_RESOLUTION_ID`, `ExportResolution`, `exportPicture()` (`src/domain/clip/ExportResolution.ts`) |
| **fit** | how a take whose picture is another shape is drawn into the **clip size**: scaled to sit wholly inside it and centred, with the clip's background around it — nothing is cropped and nothing is stretched. The review and the export draw through the same fit | `ClipSize.frameFor()` (`src/domain/clip/ClipSize.ts`) |
| **clip properties panel** | the one shared surface that shows and edits the clip's properties — a field per property, whatever it is. Opened from a **settings** control in the corner of the preview (the picture the clip is seen on, so it sits beside the clip as an annotation's settings control sits on it — the same pencil mark); it names no property, it asks the register. The clip's answer to the **properties inspector**, one level up | `ui/clip/properties-panel.ts` |
| **title card** | a head the export puts on a file: the clip's first frame held still for **two seconds**, with its **logo** above its **title** and **description** — the words drawn as **text annotations** — and, under them, the day the card was made and the app's name. It is what **add to export** asks for, and what a **logo** asks for on its own — a logo lives on the card, so a clip that wears one always opens with it — and **every export takes it — the WebM and MP4 downloads, the file for editing, and a publish**, so a published video opens with it too | `IntroCard` (`src/domain/clip/IntroCard.ts`); the words in `ui/exporting/intro-text.ts`; `introFor()` (`ui/exporting/intro.ts`) |

A clip property is **not a fraction of the clip and is not scaled when the clip grows**,
where a cut and an annotation are. It changes through the clip, is announced like every
other change, is what the one **undo** takes back, and is kept with the clip.

A **watermark** is the annotations that follow a **clip property**: each part follows its own —
the mark the **logo**, the line the **title** — so setting one places its part and clearing it
takes that part away, and a clip's branding is on every frame as well as on the card at its head.
They go in through a **load** — announced, so the lane and the picture follow — and not through
the person's edit, so the one **undo** still takes back the **logo** or the **title**, and the
watermark follows what it is left with. A part the person takes away is not put back by a change
to the other one, nor by the clip being opened again; it is placed again when its **own** property
moves. Which annotations are the watermark is the **clip's** own fact — it keeps their ids and
writes them down with itself — so nothing inside a kind has to carry a marker, and a picture or a
line the person places is just that.

## Profiles

A **profile** is a named set of the app's configuration a person works under — one for each
way of working, such as **DemoClipTV** or **GraditoneTV**. It represents a **consistent
production environment**: the configuration that way of working needs, applied every time a
clip is made under it, so none of it can be forgotten, missed or got wrong. It is kept
**outside any clip**, so it outlives the clip, the page and the session, and a clip that comes
back after a reload is still under it. Exactly one is **active**.

A profile does not hold *defaults*: it holds **declarations**. It says which items it
**controls**, and the value each of them is fixed at — and while that profile is active, an
item it controls is applied to the clip and **is not the person's to change**. The clip's
settings show it as a value with a **lock** beside it, whose tooltip names the profile,
the panel offers nothing to press, and the automation surface refuses it with the
profile named. An item no profile declares is the person's, exactly as it was before
there were profiles at all — so a profile that declares nothing is a **free** profile,
and the built-in **Empty** is that profile.

In its first iterations a profile controls four items: the clip properties **add to export**,
**logo**, **annotation colour** — the colour a new arrow or text is made in — and **sound
boost**, whether the clip's sound is brought to a competitive loudness. All are offered
by the same register the clip properties are declared in, so a later iteration carries another
one (a title, a text size) by declaring it, not by adding a second kind of configuration.

A profile is **defined in its own surface** — the dialog its pencil mark opens, where it is
**named** and where what it controls is decided — and never in the selector, which only lists,
selects, creates and removes. A declaration for an
item this build does not know is kept and never applied, so a profile written by a later
version still reads.

The choice belongs to the session. A profile may be chosen freely until the session **begins
to capture**, and from that moment it is **fixed** until the session ends: another cannot be
chosen, the messages say so, a profile created meanwhile joins the list without becoming
active, and the active profile's own declarations are frozen too, so nothing moves under a
clip already being made. A profile is held **beside**, not inside, the clip — the one **undo**
is the clip's, takes back the person's own last change, and never puts back a value a profile
is holding. A **project** names a default profile for its recordings, and the profile in force
for one is the clip's own **snapshot**, taken when it began to capture; a later edit to the
profile reaches only recordings made afterwards.

| word | what it is | in the code |
|---|---|---|
| **profile** | a named set of the app's configuration a person works under, kept outside any clip — a **consistent production environment** for a way of working. It holds the items it controls and the value each is fixed at, and outlives the clip, the page and the session | `Profile` (`src/domain/profile/Profile.ts`) |
| **active profile** | the one profile the app is working under. Exactly one at a time, and what it declares is in force while it is active. It may be chosen until the session **begins to capture**, and is fixed from then until the session ends | `Profiles.active()`, `Profiles.controlling()` (`src/domain/profile/Profiles.ts`) |
| **profile badge** | the pill of a profile's first letters on its row in the selector: a filled patch of the **annotation colour** the profile fixes, with the ink that reads on it, or of one of the app's own tones taken from its id so it never changes. The active profile's pill in the toolbar wears the same colour, as **ink and border on the button's own surface** rather than as a fill, so a way of working is recognised at a glance without the toolbar gaining a second kind of button | `profileRows()` / `profileColour()` / `badgeInk()` (`src/ui/profile/profile-rows.ts`); `paintPill()` (`src/ui/shell/pill.ts`); the toolbar pill in `src/ui/profile/profile-flow.ts` |
| **controlled item** | an item the active profile declares: applied to the clip, shown as a value with a **lock** naming the profile, and not the person's to change. An item no profile declares is the person's, as always | `Profiles.controlling()`, the `Controlling` seam (`src/ui/profile/control.ts`) |
| **declaration** | what a profile says about one item — that it controls it, and the value it is fixed at. An item may legitimately be declared fixed at an empty value (a switch fixed **off**), which is why *declared* and *empty* are told apart here and not in the clip's own properties | `Profile.declare()`, `Profile.free()` (`src/domain/profile/Profile.ts`) |
| **built-in default profile** | the profile the app always has and falls back to, so an app with nothing set up behaves as it always did. It is named **Empty**, declares nothing — it is the app's free profile — and is never renamed, removed or defined | `Profiles.DEFAULT_ID` (`src/domain/profile/Profiles.ts`) |

## Projects

A **project** is the container for a body of work and the reason for it: a name, a
**description** — its motivation and its objectives, in the person's own words — and the
**profile** its recordings start under. It holds no recordings itself: a recording says
which project it belongs to, so the two can never disagree. The app is always in exactly
one **current project**, the built-in **Default** until the person selects another, and
the Default project cannot be renamed or removed.

Every clip made while a project is current is kept as a **recording** of it: the clip's
takes, cuts, annotations and properties, plus the project it belongs to and the profile it
was made under. A recording is **in progress** while its clip session is open and
**finished** once that session ends — at New, on an export or a publish — so every
recording but the open one is finished, and the state is derived rather than stored.
Removing a recording from a project moves it to Default; deleting one for good is a
separate, confirmed act.

The **recording store** is where recordings outlive the page: IndexedDB, keyed by
recording, with the **open pointer** naming the one the sitting is on. The **project book**
is the small set of projects, kept in localStorage beside the profile book. The previous
version's one clip is adopted by the Default project, once, in one transaction.

| word | what it is | in the code |
|---|---|---|
| **project** | a body of work and its reason: a name, a description and a default profile. Kept in the project book, never inside a clip | `Project` (`src/domain/project/Project.ts`) |
| **description** | a project's motivation and objectives, in the person's own words. It stands in for the **recording plan** until a structured one exists | `Project.description()`, `Project.described()` |
| **current project** | the one project the app is in. Exactly one at a time; the Default until the person selects another, and fixed once the session has begun to capture | `Projects.currentId`, `Recordings.selectProject()` |
| **default project** | the project the app always has and falls back to, so an app with nothing set up — and an update from a version without projects — has somewhere to record. Never renamed or removed | `Projects.DEFAULT_ID` (`src/domain/project/Projects.ts`) |
| **project book** | where the projects outlive the page: localStorage, one key holding the set and the current one | `src/infra/project-store.ts` |
| **recording** | a clip that belongs to a project, with the profile it was made under. The same clip in every other way — the takes, the cuts, the annotations, what it says about itself | `src/application/recordings.ts`; the stored shape in `RecordingStorePort` |
| **in progress** | a recording whose clip session is still open. At most one at a time, and never stored as a flag: it is the recording the open pointer names | `Recordings.list()`, the open pointer |
| **finished** | a recording whose clip session has ended — at New, on export or publish. Derived, so an overview cannot disagree with the session | `Recordings.list()` |
| **recording store** | where recordings outlive the page: IndexedDB, keyed by recording, with the takes and pictures kept apart from the small half | `src/infra/recording-store.ts` |
| **open pointer** | the app's record of which recording the sitting is on, written with a recording's first meta so a take can never exist without it | `app.current`; `RecordingStorePort.open()` |
| **project default profile** | the profile a project names as the one its recordings start under. A **default**, not a lock: a recording may use another profile, chosen before it captures | `Project.defaultProfileId`, `defaultProfileFor()` |
| **clip profile** | the profile a recording is made under — the project's default or one chosen for that clip — snapshotted with its declarations when the recording begins to capture. The lock reads the snapshot, so editing or removing the profile later never reaches a recording already made | `ClipProfile` (`src/domain/clip/ClipProfile.ts`), `Clip.profile` |

## Exporting

| word | what it is | in the code |
|---|---|---|
| **segment** | a kept stretch of **one take**, in seconds: `{ takeIndex, from, to }`. What an export is made of | `Clip.segmentsIn()` |
| **export plan** | the kept stretches placed on the output timeline, with the joins marked where they fall — decided before a frame is encoded, so it can be read and tested without a browser | `ExportPlan`, with `ExportPiece` and `ExportStep` |
| **export** | writing the kept clip as a single file — WebM for the download, MP4 (H.264/AAC) for Bluesky — with the joins faded and dissolved. A clip whose kept stretches have no picture writes the **sound alone**, in the same two containers, with no video track | `planExport()` (use case), `exportOffline()` (adapter), driven by `doExport()` (flow) |
| **export target** | which container an export writes — `webm` for the download, `mp4` for Bluesky — the codecs that follow from it, and **the picture** the encoder is given, which is the crop's own except that H.264 refuses an odd edge and is taken down to even | `ExportTarget`, `specFor()`, `evenPicture()` |
| **fade** | the sound going down over the last 80 ms of a take and back up as the next begins | `FADE_S` |
| **dissolve** | the picture blending from the last frame of a take into the first frames of the next, over the same 80 ms — and, the same way, an annotation blending onto the picture over the first and last moments of its stretch | `DISSOLVE_S`, `Span.fadeAt()` |
| **crop region** | the rectangle of the screen being recorded — the red box — as fractions of the capture. A region stays inside the picture and is never empty | `CropRegion` (`src/domain/capture/CropRegion.ts`) |
| **webcam bubble** | the camera drawn as a **circle** over the recorded picture when the screen is shared — or the whole picture on its own, with no bubble, when the screen is off. It is always round: a resize changes its **diameter** only | the drawing in `drawWebcamOverlay()` (`src/ui/recording/webcam.ts`) |
| **placement** | where and how big a **webcam bubble** sits — a centre and a diameter in fractions of the recorded region, so the live preview and the recording agree. **Per sitting**: it lasts across takes, and is gone at New and at a reload. Never kept with the clip | `WebcamBubble` (`src/domain/capture/WebcamBubble.ts`) |

## A clip that leaves and comes back

A clip can go out as a file, be worked on by whatever the machine has — ffmpeg, an
editor, anything that writes a WebM or an MP4 — and be brought back in as a take, with
its annotations. This is the **round trip**, and these are its words:

| word | what it is | in the code |
|---|---|---|
| **sidecar** | the annotations written **beside** a file rather than drawn into it, so that a clip which leaves can come back whole. Named after the video with `.democlip.json` in place of the video's extension — `democlip-1755021992.webm` beside `democlip-1755021992.democlip.json`, one name and one timestamp — written by the export and read back beside it | `AnnotationSidecar` (`src/domain/clip/AnnotationSidecar.ts`); the file itself in `src/infra/annotation-sidecar.ts` |
| **drawn** / **carried** | the two ways a clip's annotations can leave: **drawn** into the picture, for a file to watch, or **carried** in a sidecar, for a file to work on and bring back. Drawing them in *and* carrying them would put each of them in the picture twice over | `AnnotationExport` (`src/domain/clip/ExportPlan.ts`); *Export ▾ → WebM for editing* |

The steps, and what each one is:

1. **Export for editing** — *Export ▾ → WebM for editing* in the app, or `export_clip`
   with `annotations: "carried"`. The file holds the cuts applied, joined, and the
   picture **alone**: the annotations are carried, not drawn.
2. **The sidecar is written beside it** — the clip's annotations as the *file* holds them:
   each stretch moved into the file's own time, since the cuts are applied there, with the
   length they are fractions of. A picture an image annotation draws travels in it too,
   because a picture is bytes where an arrow is numbers.
3. **The file is worked on.** The sidecar is not touched: it belongs to the file, and the
   file keeps its name — that is how it is found again.
4. **Import** — the app's **Import** (choose the video and the `.json` together, since a
   page cannot look in a folder), or `import_take` with the video's path, which reads the
   sidecar beside it. The take is appended, holding its own length and sound, exactly as a
   press of Record appends one.
5. **The annotations come back** — as annotations **of their own**, over the stretch the
   file was given: fractions of the file, placed where the file landed. Their own, because
   the clip may still hold the ones that left — appending is what an import does — and
   those stay over the take they were drawn on.

What it does not do: the cuts were applied, so none of them come back, and the app's undo
reaches its own edits and not across a round trip. A sidecar is taken only while the
lengths agree — a file of quite another length is another clip, where the same fractions
would point at other moments.

## Publishing to Bluesky

Publishing takes the export one step further: the kept clip is written as **MP4**,
handed to Bluesky's video service, and a post is written that carries the finished
video. Bluesky takes `video/mp4` and nothing else, so this path does not reuse the
WebM download — it encodes its own MP4. A **sound-only** clip has no picture to
write one from, so it is refused before a frame is encoded: its sound is a file,
not a post. Everything that needs the network or an
access token sits behind a port, so the sequencing is tested in node. The client
that holds the session is loaded only when a sign-in comes back or a clip is
published, so a normal load carries none of it.

Bluesky's own limits — ten minutes and 300 MB — are **Bluesky's**, and only this
path knows them: nothing limits a recording, the timeline, or an export to a file.
A clip too long to publish is refused here before anything is encoded, and the
export's bitrate gives way to the size limit rather than the file growing past it.

| word | what it is | in the code |
|---|---|---|
| **publication** | the clip going to Bluesky: writing the MP4, uploading it, waiting for the video service, and posting | `publishToBluesky()` (use case), `Publication` |
| **publishable video** | the MP4 to upload, with its name and the ratio the post shows it at. Bluesky takes `video/mp4` up to 300 MB | `PublishableVideo` |
| **Bluesky post** | the `app.bsky.feed.post` record that carries the video as an `app.bsky.embed.video` | `BlueskyPost` |
| **video job** | Bluesky's processing of an uploaded video, watched until it hands back the blob | `VideoJob`, `BlueskyService` (the port) |
| **Bluesky client** | where publishing's network lives: the OAuth session, and the XRPC calls the use case needs | `XrpcBlueskyService`, `initBluesky()` |
| **aspect ratio** | the whole-number width:height a post shows its media at | `AspectRatio` |

## Publishing to YouTube

The second destination, and the Bluesky one's shape a second time: write the kept clip, hand
it on, wait for the service to finish with it. A **sound-only** clip is refused here too, for
the same reason: YouTube takes a video. Almost nothing else is shared. The sign-in is
Google's **token model** — a popup consent that needs a press, with a token that is
short-lived and never written down, where Bluesky's is a trip to a server and back. The video
travels as a **resumable session**, watched by the byte. And the app is allowed **one call**:
it asks for the *upload* scope and nothing that reads the person's account, so `videos.insert`
is the whole of an upload, and what YouTube does with the video afterwards is **said rather
than watched** — the video is on the channel as soon as it is up, and YouTube finishes
processing it just after.

**Publish** stays the app's word for the act, whichever destination a clip goes to;
**upload** is the destination's own word for the transfer of the bytes, and so the name of
that step. A clip is not *exported* to a service — an export writes a file.

| word | what it is | in the code |
|---|---|---|
| **YouTube video** | the MP4 the app sends YouTube, carrying the destination's own ceilings: `video/mp4`, at most 256 GB, and — for a default account — at most fifteen minutes | `UploadableVideo` (`src/domain/youtube/UploadableVideo.ts`) |
| **video details** | what the video says: its title, its description, who may see it, and the category the app sends. A title left blank is **defaulted**, never uploaded empty | `VideoDetails` (`src/domain/youtube/VideoDetails.ts`) |
| **visibility** | who may see the finished video — private, unlisted or public. **Private** is where it starts, and it is sent **explicitly**, because an unset one means *public* to YouTube | `Visibility` (`src/domain/youtube/Visibility.ts`) |
| **upload** | the transfer of the video's bytes to YouTube: a resumable session whose chunks are sent in turn, and resumed from the range the service answers when one is interrupted. Nothing is read back — the scope allows the insert and no more | `YouTubeService.uploadVideo` (the port); the session and its chunks in `src/infra/youtube.ts` |
| **YouTube account** | the person's own Google account, and the channel a clip goes to. Signed in with a popup that needs a press, remembered for the page, and **never written down** — the token model keeps no refresh token. The sign-in shows Google's **own account and channel chooser** on every press — the person picks their account, then their own channel or a brand account — so which channel a clip reaches is chosen there, and the app models no channel of its own. The channel is named **when YouTube will say**: the upload scope does not authorize reading it, so the app names the account instead and leaves the upload to decide | `signIn()`, `youTubeChannel()` in `src/infra/youtube.ts` |
| **client registration** | the app's own Google OAuth client ID: public, not a secret, served beside the app so a fork sets its own | `web/public/youtube-client.json` |

What it does not do: nothing is uploaded before a person has signed in **and** pressed Upload;
no token is kept anywhere; **nothing about the person's account is read** — the app asks for
the upload scope alone, so no claim is made about the video that it cannot see; YouTube's own
length ceiling is refused **before** anything is encoded, rather than after minutes of work;
and the app never makes a video more visible than the person chose.

## The view, and what has a lifetime

Everything else is state that exists for a while and then does not: the strip
while a take records, a gesture in flight, the take the video is holding. Each of
these is an **object rather than a module variable**, so the thing it belongs to
can end it:

| object | what it holds | its lifetime |
|---|---|---|
| `LiveTimeline` | the strip and the levels heard while a take records | a take |
| `Strip` | the thumbnails, taken by seeking the element through the clip | one build — an older one is abandoned rather than left seeking |
| `Player` | which take the video element is showing | the clip being played |
| `Playback` *(the **transport**)* | the seek in flight, the stall watchdog, the fade at a join | the playhead |
| `Waveform` | the bars decoded from the clip's sound | the clip |
| `Dissolve` | the frame held at a join, spent on it | one join |
| `Meter` | the microphone's level graph and its frame loop | the microphone toggle, not the session |
| `ExportMenu` | the File/Bluesky menu under the Export button, and the listeners that end it | one opening |
| `MarkDrag`, `CropDrag` | a gesture in flight | the gesture |
| `Clipboard` | the annotation a copy put aside, for a paste | the session |
| the decoded image cache | a picture, decoded once and drawn each frame | the session |
| `Output`, `Mixer` | the canvas a take is drawn on, and the graph that mixes system audio with the microphone | a take |

`Session` is what ends them: `session.end()` is the whole of "this session is
over", and the New button is only the flow around it.

A few spots keep module-level state, all deliberately. The toast timer in
`ui/dom.ts` lasts a single toast. The Bluesky client in `infra/bluesky.ts` — the
OAuth client, the session, and the signed-in handle — lasts the page, because
signing in has to outlive a session reset and be there again on the way back from
the authorization server. The clip store in `infra/clip-store.ts` — its IndexedDB
connection, and the writes queued one behind another — lasts the page too, because
what it holds is the one thing that has to outlive it.

## The architecture

Four layers, and the dependency arrow points inward: `domain/` knows nothing,
`application/` knows the domain, `infra/` and `ui/` know both, and `main.ts`
knows all four. A rule lives in `domain/`; a use case lives in `application/`; a
browser capability sits behind a port; the adapter that implements it lives in
`infra/`; the view that sequences it lives in `ui/`.

| word | what it is | in the code |
|---|---|---|
| **port** | a named browser capability a use case needs, described without the browser. An interface the use case owns | `src/application/ports/` |
| **adapter** | the implementation of a port in the browser boundary. It owns the browser resource it acquires and releases it | `src/infra/` |
| **use case** | a sequence that delivers an outcome — record a take, export a clip, publish a clip, keep a clip, restore a clip. It runs in node with fakes behind its ports | `src/application/` |
| **view flow** | the composition of a use case with the view and the browser: the button, the status line, the phase and the sequencing. It sequences and reports; it holds no rule | `src/ui/*/*-flow.ts` |
| **phase** | the session's state — idle, starting, live, recording, review, encoding. The one piece of genuinely shared state: one owner and one change event | `src/state.ts` |
| **source set** | which of the three record sources are on: screen, webcam, microphone. A take needs a source: a picture (screen or webcam), or the microphone alone for a **sound-only** take | `SourceSet` (`src/domain/capture/SourceSet.ts`) |
| **session** | one sitting of the app: the clip, and whether it has begun to capture. It ends on one event — New, an export, a publish, or a share that went away | `Session` (`src/domain/session/Session.ts`) |

`ui/` is grouped by the concept it serves: `shell/` the frame, `recording/` a
take, `clip/` the clip and its review, `cutting/` a stretch and its cut,
`annotating/` the drawing, `exporting/` the file, `publishing/` the post and the video,
`keeping/` a kept clip and its restore, `lifecycle/` the start and end of a
session, and `agent/` the surface an agent drives. `dom.ts` stays at the root as
the one registry every group reaches.

## Speaking the person's language

The app speaks the person's own language. It reads the language their browser or operating
system declares when it loads and shows every word in it; there is no chooser in the app —
changing the browser's language and reloading changes the app. English is the source: every
sentence is written there first, and it is what a person sees when their language is not one
the app speaks. Two languages ship in this first version, English and Spanish.

A sentence is not written into the markup or the code: it is a **translation key** in a
**catalogue**, and the view asks the catalogue for it. The catalogues are held in step — the
same keys in every language — so a language cannot ship half-written, and adding one is a new
catalogue and nothing else.

| word | what it is | in the code |
|---|---|---|
| **locale** | one of the languages the app speaks — **English** (`en_UK`, the default and the source) and **Spanish** (`es_ES`) in this version. The set is open | `LocaleCode` (`src/ui/i18n/locale.ts`) |
| **active language** | the locale the page is using. Chosen once, at load, from the person's preferred language, and fixed for the life of the page | `setLocale()`, `currentLocale()` (`src/ui/i18n/index.ts`) |
| **translation key** | the stable, language-independent name of one sentence (`record.button.start`), flat and dot-notation. Written once; only its text differs per language | `TranslationKey` (`src/ui/i18n/index.ts`) |
| **catalogue** | the sentences for one language, as keys mapped to text. One per language, travelling with the app; the English one is the source the others are written from | `catalogs/en_UK.ts`, `catalogs/es_ES.ts` |
| **fallback** | what is shown when the active language has no entry for a key: the English sentence, never a key or a blank | `t()` (`src/ui/i18n/index.ts`) |

A label the app declares — a clip property's name, an annotation kind's, a colour's, a stock
sound's — is a **translation key** too, resolved where it is drawn. The app's own name and its
**logo** names are marks, not words, and are never translated; nor is anything the person wrote
themselves — a clip's title, a project's name.

## Being driven by an agent

A person asks their agent to start a session. An **MCP server** — a local program
the person's **agent harness** starts — opens a browser on DemoClip, on a profile
of its own, and offers the agent the app's own **operations** as tools: cut,
annotate, place the picture on the clipboard, change a property, undo, seek, record a
take, import a video file as a take, export, publish. The agent
calls them, and the person watches each change land in that window and can take
any of it back with the app's own undo.

One operation names a file on the machine rather than a moment of the clip, and only
one: **import**. It is the app's own Import, which a person reaches with a picker, so
what an agent may bring in is what the app's own rule would have taken from a hand —
and the file is the only **path** any tool is given.

What the agent may drive is the **automation surface**: one object the app
publishes **only when the page asks for it**, holding the app's own operations and
nothing else — no way to run code, to script the page, or to reach outside the
clip. The recording itself stays the person's in the one place the browser will
not give it away: what is *shared* is chosen in the picker, by a hand.

The page says so as well. A page that asked to be driven wears the **agent badge**
in the header, which is the visible half of the same gate — so what the page offers
and what it says cannot disagree, because one flag decides both.

| word | what it is | in the code |
|---|---|---|
| **agent session** | one sitting driven by an agent: the browser the server opened, the clip in it, and the person watching. One at a time | `mcp/src/server.ts`; the browser `mcp/src/browser.ts` |
| **agent harness** | the chat that starts the server and offers its tools to the model — OpenCode first | the person's own tool, configured with `mcp` |
| **operation** | one thing an agent may do, named in the app's vocabulary: cut, annotate, place the clipboard's picture, set a property, remove, undo, seek, record a take, import a file as a take, export, publish — the import being the one the server hands to the app's own file input rather than calls on the surface, because a page cannot read a disk | `AgentSurface` (`src/ui/agent/surface.ts`); the delivery in `mcp/src/import.ts` |
| **clipboard picture** | the picture the person put on their own clipboard, read by the server from the host's clipboard and placed as an image annotation. The one picture source an agent has for now — a file and a drag come later — and read in the server, not the page, because a browser gives a picture only to a focused window a hand has just touched | `mcp/src/clipboard.ts`; placed through `edit.annotate('image', …)` |
| **automation surface** | what the app offers to be driven, deliberately bounded to its own operations. Published on the page only when the page asks (`?agent=1`); a page that did not ask carries nothing | `src/ui/agent/`, published by `src/main.ts` |
| **agent badge** | the chip reading **Agent**, in the header, worn only by a page that asked to be driven — the visible half of the same gate as the surface. Explained by its own tooltip: the help is for a person's first use, and this is not that | `#agent-chip` (`web/index.html`, `web/styles.css`), revealed by `src/main.ts` |
| **MCP server** | the local program that launches the browser, serves the app's own build on loopback, and offers the surface as tools over stdio. In this repository, released with the app | `mcp/` |

The surface is not a sandbox: the server is the person's own program and can reach
the page. What is bounded is what the server **offers** — the tool list — not what
the page could be made to do.

## Testing

The end-to-end layer drives the real app in a real browser. It lives in `e2e/`,
outside `src/`, and changes no application code.

| word | what it is | in the code |
|---|---|---|
| **suite** | every end-to-end check, run in a real browser on every pull request | `e2e/checks/` |
| **check** | one end-to-end case: a given, a real interaction, and what a person would see. Named `*.spec.ts`, never run by `npm test` | `e2e/checks/*.spec.ts` |
| **fixture take** | a real, decodable take built inside a check from a description — never recorded in real time, never committed as a binary | `e2e/fixtures/takes.ts` |
| **boot helper** | the shared setup that loads the app, waits for it to be ready, and seeds a clip through the app's own modules | `e2e/helpers/app.ts` |
| **stand-in share** | a canvas stream that takes the place of the share picker, so the app's handling of a share that is handed back is covered | `e2e/helpers/stand-ins.ts` |
| **regression check** | a check that pins a behaviour that broke before: it fails on the commit before the fix and passes after | `e2e/checks/*.spec.ts` |
| **suite run** | one execution of every check on a pull request, with its pass, fail and skipped outcomes | the `e2e` CI job |
| **evidence artifact** | what a failed run leaves behind — a trace, a screenshot, a video — for a reader to diagnose it | `test-results/` |

The share picker itself is not driven: `getDisplayMedia` needs a gesture and a
browser pane, so it stays a **real session** the user runs.

## Words we do not use

- **part** — an old name for a **take**. Gone from the code except one comment
  that records why the take repository exists.
- **region** for a removed area — a region is the **crop**. A removed area is a
  **cut**.
- **trim** — what the UI used to call a **cut**: the label, the chip, the events
  `trim-approved` / `trim-undone`. The domain always said `Clip.cuts`, and the
  words are one again: a **cut** is the stretch removed and the act of removing it.
- **keep range**, **trim handles**, **IN/OUT** — the range a clip kept, dragged
  with two sliders. The **cut** does the same job, so it was removed with
  `Trim.ts` and the two range inputs.
- **real-time export** — the path that played the clip and recorded the canvas.
  Removed; the export is encoded offline (`git show f73a121`).
- **a flag kept beside the thing it describes** — `wasCut` beside what the chip
  already said, a `cropRaf` in app state beside the loop that owns it. Ask the
  object.
- **harness** — the throwaway `verify-*.html` page, written for one change and
  deleted before the commit. A **check** in the suite replaces it, and the word
  goes with the file.
- **file source**, **video source** — an imported file is not a **record source**:
  a source is a live device, and a file is already a finished recording. A file is
  **imported** and becomes a **take**.
- **export to YouTube** — a clip is not *exported* to a service: it is **published** to one,
  and the transfer of its bytes is an **upload**. An export writes a file, and nothing else.

## Keeping it alive

- A new concept starts here, in a sentence, before it starts in the code.
- Changed meaning: change the code and the words **together**, in one rename
  commit. A word that lingers is worse than a wrong one, because it hides that
  two names mean the same thing.
- A concept that becomes a class is named after its word; a class that holds rules
  is an aggregate, and its rules are tested beside it.
- The interface is bound by this too: the README, the help panel and the status
  messages use these words, and the help panel is written for the person using the
  app rather than for us.
