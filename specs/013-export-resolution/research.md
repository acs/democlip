# Phase 0 — Research: Export Resolution

Every decision below is settled; there are no open `NEEDS CLARIFICATION` items. Each one names
what was chosen, why, and what else was considered. The three open choices the spec left were
settled with the user (the aspect kept; every export and publish; enlarge to the chosen size).

## R1 — The export resolution is a second size, the clip size is left alone

**Decision**: the **clip size** (the frame the review shows, derived from the takes) is **not
changed** and is **not made settable**. The feature adds a second, **optional** size — the **export
resolution** — that decides the picture the **file** is written at, defaulting to the clip size.
The review, the takes' fit, the cuts and the annotations are untouched; only the picture the
encoder is handed moves.

**Rationale**: the user's own correction — *"the Clip size in which you are working with all your
takes. And other resolution is what you finally export … This new resolution must be optional. By
default, the Clip size must be used."* It also keeps `008-clip-size`'s decision (the size is
derived, "so a person cannot hold a clip to a shape its own takes do not have") intact, which
making the clip size settable again would have reversed. Two sizes, one job each: the clip size is
what the person works in, the export resolution is what the file is written at.

**Alternatives considered**:
- *Make the clip size settable again.* Rejected: it re-opens `008-clip-size` (the person holding a
  clip to a shape its takes do not have), and it makes the review show a frame the person did not
  record. A second size does the one job — the file — with no such cost.
- *A single "quality" or "bitrate" control.* Rejected: the resolution is the lever the encoder
  already reads (its bitrate is per pixel), and it is the word a person uses; a bitrate control
  would be a second, lower-level knob beside it.
- *Show the export resolution only in the Export menu.* Rejected: it is a clip property like the
  others (**Add to export**, **Logo**), and a profile must be able to fix it and the clip must keep
  it, which the clip's own settings is where that lives.

## R2 — The rule lives in the domain, named after the word

**Decision**: a new class `ExportResolution` in `src/domain/clip/ExportResolution.ts`, holding the
property **id**, the **levels** the app offers, the **parse/refuse** rule, and the **picture** rule:

```ts
export const EXPORT_RESOLUTION_ID = 'exportResolution';
export class ExportResolution {
  static readonly LEVELS = [2160, 1440, 1080, 720, 480] as const;   // the shorter edge, in pixels
  static of(value: string): ExportResolution | null;                  // '' is the clip size, else a level
  readonly value: string;                                             // '' or '1080'
  /** The clip size, or the clip size scaled so its shorter edge is this level. Null past ClipSize.MAX_EDGE. */
  picture(clipSize: ClipSize): ClipSize | null;
  label(): string;                                                    // 'Clip size' | '1080p'
}
```

with one free function the write paths call, mirroring `boostsSound`:

```ts
export function exportPicture(properties: ClipProperties, clipSize: ClipSize | null): ClipSize | null;
```

**Rationale**: `.agents/skills/domain-model` — a concept that needs rules is a class named after
the word, and this one has rules (a value is one of the app's levels or the clip size; the picture
keeps the clip size's aspect; both edges are even; a level past the app's ceiling is refused). It
is exactly the shape `src/domain/sound/SoundBoost.ts` already uses — the id and the rule in the
domain, read by the descriptor in `ui/clip/clip-properties.ts` and by the write paths — so there is
no new pattern, and the rule is proved in node with no browser.

**Alternatives considered**:
- *A plain function in `ui/clip/clip-properties.ts`.* Rejected: a rule in the view, where it cannot
  be proved in node and where the encoder (which imports no view) could not reach it.
- *Add `picture(level)` to `ClipSize`.* Rejected: `ClipSize` is one take's or the clip's own size
  and knows nothing of levels; the scale-to-a-level rule belongs to the thing that is a level.
- *A method `Clip.exportSize()`.* Tempting (the aggregate answers about itself), but it would put
  the property **id** inside `Clip`, which today knows no property id — `SoundBoost`'s
  `boostsSound(clip.properties)` is the precedent that keeps the id out. Kept as the free function.

## R3 — The picture keeps the clip size's aspect — and why that is also what makes it cheap

**Decision**: the export resolution is the clip size **scaled by one factor, both edges made even**,
so it keeps the clip size's **aspect ratio**. `picture(clipSize)` scales so the clip's **shorter
edge** is the level (1080p ⇒ 1920×1080 for a 16:9 clip; 1080×1920 for a portrait one; 1440×1080
for a 4:3 one), rounding each edge **up to even** through `ClipSize.of`.

**Rationale**: the user asked for exactly this — *"you can scale down the resolution, but with the
same aspect than in the clip review"* — and it keeps the app's promise that the review shows what
the export writes: the file is the same picture, at a different number of pixels, with **no bars,
no crop and no stretch**. Naming the level by the **shorter** edge is the one convention that reads
right in every orientation ("1080p" is the height of a landscape clip and the width of a portrait
one) and matches how people say resolutions.

**Why it is also the cheap design**: the encoder already draws each take into a canvas of the
picture it is handed — `fitIn(canvas.width, canvas.height, take)` in `src/infra/offline-encoder.ts`
— and draws the annotations and the card from `context.canvas.width/height` in **fractions**. So
handing it the export resolution rather than the clip size fits every take into the smaller canvas
and draws everything else to scale, with **no new drawing code**. Fitting a take straight into the
export canvas equals fitting it into the clip size and then scaling, precisely because the two
share an aspect ratio (to the nearest whole pixel).

**Alternatives considered**:
- *A frame whose shape may differ (letterboxing).* Rejected by the user: it would put bars in the
  file the review did not show.
- *A free width×height the person types.* Rejected: FR-003 and the app's own habit — the app knows
  its levels, so it offers them as a **list** rather than a field a typo can break.
- *Naming the level by the longer edge (1080p ⇒ 1920 on the long edge).* Rejected: it reads wrong
  ("1080p" is not 1080 on the long edge), and it is the same set of pictures the shorter-edge naming
  has, said less clearly.
- *Only ever scale down (clamp a level above the clip size).* Rejected by the user: a production
  fixing 1080p should get 1080p whatever the source, so a smaller clip is **enlarged** to the level.

## R4 — One clip property, in the app's own register

**Decision**: one descriptor in `src/ui/clip/clip-properties.ts`:

```ts
registerClipProperty({
  id: EXPORT_RESOLUTION_ID,
  label: 'Export resolution',
  control: 'choice',
  seedable: true,
  choices: [{ value: '', label: 'Clip size' }, ...levels.map(l => ({ value: `${l}`, label: `${l}p` }))],
  value: properties => properties.get(EXPORT_RESOLUTION_ID),
  with: (properties, value) => (isExportResolution(value) ? properties.with(EXPORT_RESOLUTION_ID, value) : null),
  blocked: (properties, clip) => clip && clip.takes.count() > 0 && !clip.hasPicture()
    ? 'A sound-only clip has no picture to write — record a take with a picture'
    : null,
});
```

`''` **is** the clip size — `ClipProperties.with(id, '')` drops the value, so "unset" has one
representation, which is the default the spec asks for.

**Rationale**: the register is the app's one place that says what can be changed about a clip and
how to read and write each value, and `control: 'choice'` already exists (the **logo**). Declaring
it here means the **properties panel**, a **profile's sheet** (`profile-def.ts`, through
`seedableClipProperties()`) and the **automation surface** (`describe.ts`) all offer it with **no
change to any of those three** — the same reason `addToExport` and `logo` are declared here.

**The `blocked` line**: a **sound-only** clip has no picture a file can be written at a resolution,
so the control is shown disabled with the reason (the shape `addToExport` already uses), rather than
accepting a choice that would be quietly ignored. An **empty** clip is not blocked — a person or a
profile may set it before the first take, and it applies when a picture arrives.

**Alternatives considered**:
- *Reuse the existing read-only `size` property.* Rejected: the clip size stays what the review
  works in and is not the person's to set; the export resolution is a second, editable row.
- *A second register.* Rejected: the failure the clip-property register exists to prevent.
- *Put the levels in the property rather than the domain.* Rejected: the write paths need the rule,
  and they import no view.

## R5 — The picture reaches the encoder through the call sites that already compute one

**Decision**: the three places that hand a picture to the file-writing code take the **export
resolution** instead of `clip.size()`:

| Where | Now | Becomes |
|---|---|---|
| `src/ui/exporting/export-flow.ts` | `picture: () => clip.size() ?? preview` | `exportPicture(clip.properties, clip.size())` |
| `src/ui/publishing/publish-flow.ts` | `const picture = clip.size() ?? …` | the same, once |
| `src/ui/publishing/youtube-flow.ts` | `const picture = clip.size() ?? …` | the same, once |

Everything downstream follows with no change: `ExportVideo.run` uses that picture for `fitsBudget`
and hands its width/height to `encode`; the encoder's canvas is that size; each take is fitted into
it; the annotations, the card and the watermark are drawn by fractions; and the publish's
**aspect ratio** (`AspectRatio.of(picture.width, picture.height)`) is derived from it, as FR-021 asks.

**Rationale**: the picture is already a dependency these flows supply (`ExportVideo.deps.picture`,
`EncodeOptions.width/height`), so the change is the *value* handed in, not a new seam. It keeps the
encoder and the plan untouched, and it puts the one rule in one function. The comment already in
`publish-flow.ts` — "the post's aspect ratio and the encoded video's own size are the same two
numbers, read once, so the two cannot disagree" — is exactly the guarantee FR-021 wants, kept.

**Alternatives considered**:
- *Carry the picture on the `ExportPlan`.* Considered: the plan is "decided before a frame is
  encoded", which fits, and it would put the one answer where `soundBoost` already is. Rejected for
  this iteration as the larger change — it touches `ExportPlan`, `export-clip`, `export-video`, the
  encoder port and all three flows, and removes `deps.picture` — where handing the value in reaches
  the same result. Noted as the tidier shape if a fourth write path ever appears.
- *A DOM-free view helper `clipPicture(clip)`.* Considered: it would name the id once for the three
  flows. Rejected in favour of the domain's `exportPicture(properties, size)`, matching
  `boostsSound(clip.properties)` and keeping the id out of the view.

## R6 — The levels the app offers

**Decision**: five levels, by shorter edge: **2160, 1440, 1080, 720, 480**, labelled *2160p, 1440p,
1080p, 720p, 480p*, with **Clip size** first as the default (`''`). A level larger than the clip
size is offered like any other and **enlarges** the picture.

**Rationale**: a small, familiar ladder that covers a phone recording (720p/480p) through a 4K
screen (2160p), in the numbers platforms and people both use. It is the app's own list, declared in
one place, so adding a rung later is one line. The ladder is deliberately not filtered by the clip
size, because a production's config must be uniform whatever the source (R3).

**Alternatives considered**:
- *A single "half / quarter" scale.* Rejected: it cannot express "always 1080p", which is what a
  production config is for.
- *Every resolution from 360p to 4320p.* Rejected: a longer list for no use the five do not cover,
  and it invites levels no target can encode.
- *Filter the list to the clip size.* Rejected: it would leave the common 16:9 levels off a portrait
  clip and break the "one resolution across the production" goal.

## R7 — The words come first, and one of them is wrong today

**Decision**: `GLOSSARY.md` gains **export resolution** — the size the clip's file and publish are
finally written at, a width and a height both even, the clip size scaled so its aspect is kept —
and its existing **clip size** row is **corrected**: it
still says *"once the person sets it in the clip properties panel it is kept"*, which `008-clip-size`
removed. Corrected, it says the size is derived from the takes and is **not the person's to set**.

**Rationale**: constitution V ("the words come first") and the glossary's own rule ("Changed
meaning: change the code and the words together"). The stale sentence is not caused by this feature,
but it now sits next to a new row that *is* settable, so leaving it would read as a lie about which
of the two the person sets. Fixing it is one sentence in the same change.

**Alternatives considered**: *leave the clip size row and only add the new one.* Rejected: two rows
side by side, one wrongly saying the person sets the clip size and one saying the person sets the
export resolution, is exactly the drift the glossary exists to stop.

## R8 — Scope left out, deliberately

**Decision**: no change to the **review** or the **clip size**; no separate **quality/bitrate**
control; the export resolution is **not** offered as a new MCP tool (the existing
`setClipProperty`/`describeClip` carry it, as they do every clip property); and no change to the
recorder, the timeline, the annotations or the card beyond their being drawn at the new picture.

**Rationale**: the spec's scope is the size the file is written at, and nothing else needs to move
for that. The automation surface carries clip properties already (`describeClip` lists them,
`setClipProperty` sets them, and a profile-fixed one is reported `readOnly`), so the feature is
reachable by an agent with **no new operation** — and a controlled one is refused with the profile
named, which the existing `Controlling` seam already does.

**Alternatives considered**:
- *An export-resolution field in the Export menu.* Rejected: it is clip state a profile fixes and a
  reload keeps, which the clip's properties own.
- *A new MCP tool.* Rejected: a second way to do what `setClipProperty` does, and a contract and a
  release check for nothing.

## R9 — The bitrate floor had to give way, or the control controls nothing *(2026-11-25, from the user's own export)*

**Decision**: `videoBitrate` (`src/infra/export-target.ts`) no longer clamps the rate **up** to a
flat 4 Mbps. The least it writes is a **share** — a quarter — of what the picture asks, with a small
sanity bound under it; the 24 Mbps ceiling is unchanged. With no byte budget the rate is simply what
the picture asks, so the file shrinks with the resolution.

**Rationale**: the user exported one 10s clip at 1641×1410 (4.7 MB) and at 560×480 (4.8 MB) and got
a *larger* file from the smaller picture. The flat floor sat above the app's own bits-per-pixel rule
for every picture under about 1.1 megapixels, so 720p, 480p and 360p were all written at 4 Mbps —
about four times the bits a 480p picture can use — and the export resolution could not shrink a
file, which is the one thing it exists to do. A share leaves the picture's own rule in charge at
every size.

**What it changes beyond the download**: `fitsBudget` reads the same function, so a publish may now
fit a destination's byte budget by writing lower rather than being refused. That is a deliberate
change to shared policy and is stated as one; every refusal the app tests stays a refusal, and the
budget-squeezed rate is unchanged for the 1440p picture the tests use.

**Alternatives considered**:
- *Keep the flat floor and offer only levels above it (1080p and up).* Rejected: there is then no
  really small file to choose, and a 4K clip could come down to 1080p only.
- *Lower the flat floor.* Rejected: still flat, so it still over-provisions the smallest pictures —
  the same fault, just further down.
- *A separate quality or target-size control.* Rejected: a second knob for what the resolution is
  supposed to do, and one no profile could fix as naturally as it fixes the resolution.

