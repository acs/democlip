# Data Model: Sound Boost

The feature adds no aggregate, no stored record and no schema version. It grows the shapes
the app already has: a **clip property** whose default is on, an **export plan** that carries
whether the sound is boosted, and two small value modules in the domain — the **measurement**
and the **gain rule** — that the export and the review both ask.

## `SoundBoost` — `src/domain/sound/SoundBoost.ts` (new)

The rule and its constants, pure. No browser, no clock, no clip.

| member | value / rule |
|---|---|
| `BOOST_ID` | `'soundBoost'` — the clip property's id, in one place, imported by the descriptor and the export |
| `TARGET_LUFS` | `-16` — the app's one target, a speech target |
| `PEAK_CEILING_DBFS` | `-1.5` — the ceiling no boosted sample passes |
| `OFF` | `'false'` — the stored value that means the switch is off |
| `boostsSound(properties: ClipProperties): boolean` | `properties.get(BOOST_ID) !== OFF` — **true when unset**, so the switch is on by default |
| `gainFor(lufs: number, peakDb: number): number` | the linear gain: silence → `1`; else `10^(min(TARGET_LUFS − lufs, PEAK_CEILING_DBFS − peakDb) / 20)` |

**Rules**

- `boostsSound(ClipProperties.EMPTY)` is **true**: a clip that never set the property is boosted.
- `gainFor` is ≥ 0 and finite for any finite measurement; it may be **below 1** (an attenuation) when the sound is louder than the target.
- `gainFor` answers **one gain for the whole clip**, applied to every sample alike — it is **not a curve over time**. A correction that moved moment to moment would be compression, which this feature does not do.
- Applying the gain is **one multiply**, so once the measurement is known, switching the boost on or off is instant: the clip is either heard and written at `gain`, or at `1`. The raw samples are never changed — only scaled as they are played or encoded.
- `gainFor` never lets the peak pass the ceiling: `peakDb + 20·log₁₀(gain) ≤ PEAK_CEILING_DBFS`.
- Silence (the `Loudness` measurement's "nothing above the gate") is passed as `lufs = -Infinity` and answers `1`.

## `Loudness` — `src/domain/sound/Loudness.ts` (new)

The measurement, pure, over samples.

| member | rule |
|---|---|
| `measure(channels: readonly Float32Array[], sampleRate: number): { lufs: number; peakDb: number }` | EBU R128 integrated loudness and the peak |

**Rules**

- K-weighting (a high-shelf and a high-pass, the standard's coefficients for the rate), 400 ms blocks with 75 % overlap, an absolute gate at −70 LUFS and a relative gate 10 LU below the gated mean; `lufs = −0.691 + 10·log₁₀(mean gated power)`.
- `peakDb = 20·log₁₀(max |sample|)` (the **sample** peak; see research.md).
- A sound with no block above the absolute gate (silence, or only near-silence) has no gated blocks: `lufs = -Infinity` and `peakDb` as measured. It is the caller's "silence" answer, and `gainFor` turns it into gain `1`.
- An empty input is silence.
- The result depends on the samples and the rate alone — no browser, no global.

## `ClipProperty` — the `soundBoost` descriptor

A further entry in the register (`src/ui/clip/clip-properties.ts`), built the same way as
**Add to export**.

| field | value | note |
|---|---|---|
| `id` | `BOOST_ID` (`'soundBoost'`) | from the domain module, so the id is one string |
| `label` | `'Boost the sound'` | what the panel and the profile's sheet draw |
| `control` | `'toggle'` | the shared switch |
| `seedable` | `true` | a **profile** may fix it, like `addToExport` |
| `value(properties)` | `boostsSound(properties) ? 'true' : ''` | reads the domain rule |
| `with(properties, value)` | `properties.with(BOOST_ID, value === 'true' ? '' : 'false')` | `'true'` → unset (the default, on); anything else → `'false'` (off) |

There is **no** `readOnly`, no `blocked` and no `choices`. The register's other members and
`seedableClipProperties()` are unchanged; the boost joins the seedable list in registration
order.

**When the value lands**: `applyActiveProfile` fixes what the active profile declares onto an
**empty** clip — it returns at once for a clip that has a take — and it runs at start-up, at
**New**, and when a profile is chosen (which is possible until capture begins). The switch
therefore has its value **before the first take**: a recording starts already boosted, or
already un-boosted under a profile that fixes it off. The row itself is drawn in the clip's
settings, which the view shows in the **review**; a person pre-decides with a profile, and
while the item is free moves it in the review. Nothing about the capture changes — the take
is raw, and the gain is applied after it is recorded.

**Why `with` maps to *unset* for on**: `ClipProperties.with(id, '')` deletes the key, so "on"
is the property's default state and an on-clip stores nothing — which is what makes a profile
fixing it **on** and a clip that never touched it the same value.

## `ClipProperties` — the stored value

Unchanged shape. A clip holds, for `'soundBoost'`:

| stored | means | survives a reload |
|---|---|---|
| **absent** | the default: **on** | yes — omitted from the record, read back as on |
| `'false'` | fixed **off** on the clip | yes — a named string, kept by `ClipProperties.of` |

The property travels in `ClipSnapshot.properties` as it is; no store change.

## `Profile` and a declaration — no shape change

A profile fixes the boost with the machinery it already has (`Profile.declare`, `Profiles`,
the profile store). The three-way control writes:

| the profile sheet says | the declaration stores | applied to the clip |
|---|---|---|
| **Free** | the item is not declared (`null`) | nothing — the person's, default on |
| **On** | `'true'` | `with('true')` → *unset* → on |
| **Off** | `''` (an empty declaration, as for any toggle fixed off) | `with('')` → `'false'` → off |

`PROFILES_FORMAT` and the profile store are untouched; an empty declaration is already stored
and read back, as spec 009's `Profile` tests hold. A declaration for `'soundBoost'` written by
this build is a named string and reads back in an older build too (`applyActiveProfile` walks
the register and ignores an item it does not know).

## `ExportPlan` — `src/domain/clip/ExportPlan.ts`

| field | type | rule |
|---|---|---|
| `soundBoost` | boolean | **new**: is the clip's sound to be boosted? Given by `planExport` from `boostsSound(clip.properties)` |
| `localPieces()` | `readonly LocalPiece[]` | **new**: the kept stretches in each **take's own** seconds — `from`/`to` minus `startOf(takeIndex)` — since a piece's own times are the recording's and a decoder that opens one take indexes by that take's. `at` is unchanged |
| `pieces`, `steps`, `takes`, `total`, `audio`, `soundOnly`, `intro`, `introSeconds`, `fadeSeconds`, `annotations` | as today | unchanged |

**Rule**: `soundBoost` is a value the plan carries, not a property of the takes — it is the
clip's own setting, and every encoder that asks the plan gets the one answer. It is
**independent of `audio`**: a clip with no kept sound has `audio === false` and the boost does
nothing, whatever the switch says.

**Rule (the two units)**: the plan holds the recording's seconds and the take's, and already
says so of itself ("no caller has to convert between them by hand"). `localPieces()` is that
conversion in one place, and nothing that opens a single take may do it by hand: a piece of the
**second** take runs 5s…10s of the recording and 0s…5s of that take, so reading its times
against that take's buffer lands past its end and silently measures nothing of it.

## `planExport` — `src/application/export-clip.ts`

`planExport(clip, settings)` passes `boostsSound(clip.properties)` into `ExportPlan.of`, so the
download, `publishToBluesky` and `publishToYouTube` — which all build the plan here — inherit
the boost with no caller threading it.

## The measurement and the gain at the edge — `src/infra/sound-boost.ts` (new)

| member | rule |
|---|---|
| `boostGain(plan: ExportPlan, boost: boolean): Promise<number>` | decode the **kept** stretches of the plan's takes, one at a time, `Loudness.measure`, `SoundBoost.gainFor`; `1` when off, when there is no sound, or when the decode fails |
| `measureKept(decoded, pieces: readonly LocalPiece[]): Measurement` | the measurement of already-decoded takes, over `plan.localPieces()` — the stretches in their **own take's** seconds, which is what a single-take decoder indexes by |

**Rules**

- It decodes only the pieces' `from`…`to` ranges of each take, in order, so the samples it
  measures are exactly the ones the file holds — and in each take's **own** seconds, from
  `localPieces()`, never the recording's.
- In the **export** it adds no decode: `renderAudio` has already decoded the takes for the mix,
  and the measurement is arithmetic over those same samples. In the **review** it is one
  full-rate decode of the clip's sound, which is the cost the feature adds.
- It decodes **one take at a time** and keeps only the per-block statistics and the peak, so the
  memory it holds is one take's samples, not the whole clip's.
- It caches the **measurement** per clip against the **sound** — a take added or a cut approved
  invalidates it, and the switch does not. The gain is `boostsSound(...) ? gainFor(measured) : 1`,
  so flipping the switch applies or drops the cached gain at once; only a clip whose sound has
  never been measured starts a measurement when the switch is turned on.
- It is **derived, never persisted**: the cache lives with the page, and the store keeps the
  takes, the cuts and the switch, not the number. A clip restored from the store is measured
  once when the review opens, exactly as a fresh one is.
- It is measured lazily: the measurement is made when the review first needs the boost — which,
  the switch being on by default, is when the review opens — and not for a clip whose boost is
  off and stays off.
- A decode that fails for one take contributes silence rather than failing the clip — the
  same rule the export's own `decodeOrNull` uses.
- It returns a **linear gain**, ready for a `GainNode`'s `.value` or a multiply.

## `renderAudio` — `src/infra/offline-encoder.ts`

Unchanged in what it renders; one step added at its end.

**Rule**: after the mix is rendered and `plan.soundBoost && plan.audio`, the encoder asks
`gainOf(measureKept(decoded, plan.localPieces()))` — the gain from the buffers it mixed from, in
their own takes' seconds — and multiplies every sample of the rendered `AudioBuffer` by it
before handing it to the encoder. The video export and the sound-only export both come
through `renderAudio`, so both are covered by the one step, and the takes are already decoded
for the mix — so the measurement adds no decode to an export.

## The review's gain — `src/ui/clip/fade.ts` and `src/ui/clip/boost.ts`

| member | rule |
|---|---|
| the element's graph | `element → fade gain → boost gain → destination` — a second node, so a fade (0…1) and the boost do not fight |
| `boost.ts` `refresh()` | if the clip has no kept sound or `!boostsSound(...)`, set the boost gain to `1`; else `boostGain(...)` and set it; called when the review opens and when the clip's sound or property changes |
| `boost.ts` `clear()` | set the gain to `1` as the clip is let go |

**Rule**: the review's gain and the encoder's gain come from the **same** `boostGain` over the
**same** kept stretches, so the number is the same number (spec FR-008, SC-003).

## The exported file

| property | value |
|---|---|
| loudness | within ±1 LU of **−16 LUFS** integrated, when the boost is on and the clip has sound |
| peak | no sample above **−1.5 dBFS** |
| channels | unchanged: mono stays mono, stereo stays stereo |
| low end, dynamics | unchanged: no high-pass, no compression, no noise removal |
| picture | identical to the same export with the boost off (the gain touches sound only) |
| containers | WebM and MP4, download and publish alike; a **sound-only** clip's sound file too |
| with the boost off | the recorded sound: the takes' own bytes, decoded and mixed as today |

## State transitions

| from | event | to |
|---|---|---|
| the app starts, or **New** | `applyActiveProfile` on the empty clip, and the profile's choice until capture begins | the profile's value (or the property default) is on the clip **before the first take** |
| a clip made, nothing set | — | `boostsSound` true; the sound is boosted |
| the clip's switch turned off | the person's `setProperty` | `'soundBoost' = 'false'`; review and file carry the recorded sound |
| the clip's switch turned on | the person's `setProperty` | unset; the cached boost gain is applied at once, or a measurement runs first when the sound was never measured; takes never changed |
| a profile that fixes it off, chosen | `applyActiveProfile` on an empty clip | the clip holds `'false'`; the row reads as fixed by the profile |
| a profile that fixes it on, chosen | `applyActiveProfile` | unset; the row reads as fixed on |
| the profile removed | the value stays on the clip | the switch becomes the person's, at the value it held |
| a take is added, or a cut approved | the clip announces | the cached gain is invalidated; the review measures again |
| the clip is exported | `planExport` | the plan carries `soundBoost`; every target inherits it |
| a clip with no sound is exported | `soundBoost` true, `audio` false | nothing to boost; the file has no sound, as today |
| the page is reloaded | the store loads the properties and the takes | the switch comes back as it was; the measurement is derived and is taken again when the review opens |

## Validation rules

| rule | where | test |
|---|---|---|
| the switch is on for a clip that never set it | `SoundBoost.boostsSound` | `SoundBoost.test.ts`, `clip-properties.test.ts` |
| off is stored and read back | the descriptor's `with`/`value`, `ClipProperties` | `clip-properties.test.ts`, `Clip.test.ts` |
| a profile may fix it on, off or free, told apart | the register's `seedable`, `Profile.declare` | `clip-properties.test.ts`, `profile-rows`/`apply` tests |
| the gain lifts a quiet sound toward the target | `SoundBoost.gainFor` | `SoundBoost.test.ts` |
| the gain brings a loud sound down, and never clips | `SoundBoost.gainFor` | `SoundBoost.test.ts` |
| silence measures as silence and gains nothing | `Loudness.measure`, `SoundBoost.gainFor` | `Loudness.test.ts`, `SoundBoost.test.ts` |
| the measurement is EBU R128 (the standard's vectors) | `Loudness.measure` | `Loudness.test.ts` |
| the plan carries the clip's boost | `planExport`, `ExportPlan.of` | `export-clip.test.ts`, `ExportPlan.test.ts` |
| a kept stretch is in its own take's seconds | `ExportPlan.localPieces` | `ExportPlan.test.ts` |
| the encoded sound is boosted, and the picture is not | `renderAudio` | the `export.spec.ts` check |
| the review and the file get the same gain | one `boostGain`, two callers | the check's numbers, and the shared-rule unit tests |
| a profile fixing the boost off yields an un-boosted clip | the profile seam | the `profiles.spec.ts` check |
| the agent sees and may set the property | `describeClip`, `set_clip_property` | `describe`/`agent` tests |
