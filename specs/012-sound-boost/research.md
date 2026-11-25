# Research: Sound Boost

Phase 0 decisions. Each is the rule the spec asks for, placed where the app's layers say it
belongs: the arithmetic in `src/domain/`, the browser capability behind a port or in
`src/infra/`, and the view listening.

## The boost is a clip property, declared like the others

**Decision**: **Boost the sound** is a further entry in the clip-property register
(`src/ui/clip/clip-properties.ts`), with `id: 'soundBoost'`, `control: 'toggle'` and
`seedable: true` — so the panel, a profile's sheet and the automation surface all learn it
from the one declaration, exactly as **Add to export**, **logo** and **annotation colour**
are offered. It is the first property whose **default is on**.

**Why**: the spec puts the option *in the profile*, and in this app a profile controls items
that are **clip properties** (`docs/GLOSSARY.md`, "Profiles"; spec 009 FR-015). Making the
boost a clip property is therefore the whole of "it is defined in the Profile": a profile
fixes it like the others, and the register already promises a later item is added by
declaring it, not by adding a second kind of configuration. No new surface, no new item kind.

**Alternatives considered**: a profile-only setting, kept outside the clip — rejected: a
profile's items are clip properties by construction, the export must read one value, and a
clip made under the app's free **Default** must still be boosted (which a profile-only
setting could not express). A setting on the session — rejected: it would not survive a
reload, would not be a profile's to fix, and would be a second place for the value.

## A default-on switch, and how "off" is kept

**Decision**: the stored value is **unset for on** and the string `'false'` for **off**. The
property's `value` reads `boostsSound(properties)` (true unless the clip says `'false'`) as
`'true'` or `''`; its `with` maps `'true'` to *unset* and anything else to `'false'`.

**Why**: `ClipProperties.with(id, '')` **deletes** a key, so for a default-off switch
(like **Add to export**) off and unset are the same thing and no one needs to tell them
apart. A default-**on** switch cannot work that way: if off were also "unset", a profile
fixing it **off** would read back as the default **on**. Storing off as `'false'` — a named,
non-empty value — keeps the three states the app already distinguishes: *unset* (the
property's own default, on), *fixed off* (`'false'`), and *fixed on* (unset again). It is
one string and one rule, and nothing else in the register changes: the panel's toggle and the
profile sheet's three-way control already write `'true'` (On) and `''` (Off), and `with`
turns that `''` into `'false'` on the clip.

**Alternatives considered**: a sentinel or a second stored field for "explicitly off" —
rejected: the value is a named string already, and `'false'` names it. A new descriptor
field (`offValue`) — rejected: it is not needed once `with` owns the mapping, and every
existing toggle would carry a field that means the same as before. Changing `ClipProperties`
to keep empty values — rejected: `''` means "unset" everywhere else, and telling empty from
present there would reach every property.

## One rule for "is the sound boosted", in the domain

**Decision**: a new domain module `src/domain/sound/SoundBoost.ts` owns the id, the target,
the ceiling, `boostsSound(properties)` and the gain rule. The clip-property descriptor
imports the id and `boostsSound` from it; so does the export use case. There is no second
copy of "on unless it says `'false'`".

**Why**: the export plan is built in `src/application/`, which may not import the view, and
the plan must carry the fact so every encoder — the download, Bluesky, YouTube, the
sound-only file — reads it from one place. Putting the rule in the domain, next to the
arithmetic it feeds, is what makes that possible without a caller passing a boolean that
could disagree with the clip. It is the same shape as the takes deciding `audio`/`soundOnly`
in spec 011: the plan derives the fact from the clip, and no caller is asked.

**Alternatives considered**: reading the property only in the view and passing it as an
export setting (as `intro` is) — rejected: the three encode paths would each have to thread
it, and a caller could then disagree with the clip. A method on `Clip` — considered; the
rule needs only `ClipProperties`, so a small function over properties is the narrower seam
and keeps the aggregate free of a new member.

## Loudness measured as EBU R128, in the domain

**Decision**: `src/domain/sound/Loudness.ts` implements **EBU R128 integrated loudness** and
a **peak**, over `Float32Array` channels and a sample rate: the K-weighting filter, 400 ms
blocks at 75 % overlap, the absolute gate at −70 LUFS, the relative gate 10 LU below the
gated mean, and `loudness = −0.691 + 10·log₁₀(mean gated power)`.

**Why**: the recipe measured with `ffmpeg -af ebur128` and the person asked for the same
result inside the app; the app's target and success criterion are stated in LUFS, so the
measurement has to be the standard's, not an approximation in another unit. It is arithmetic
over samples with no browser in it, so it is the domain's and it is tested in node against
the standard's own vectors — a full-scale 1 kHz sine is **−3.01 LUFS**, the same sine 20 dB
down is **−23.01 LUFS**.

**Alternatives considered**: RMS as a stand-in — rejected: it is not LUFS, the target and the
check are stated in LUFS, and an unweighted level mis-measures speech badly. A Web Audio
`DynamicsCompressor` or a browser loudness API — rejected: the browser has no loudness meter,
and a dynamics processor is exactly the compression the recipe warns against. A dependency
(`ebur128`, `loudness`) — rejected: the rule is small and pure, and the app carries few
dependencies on purpose.

## The peak: sample peak, not oversampled true peak

**Decision**: the peak is the largest absolute sample. The ceiling is stated at **−1.5
dBFS**, the margin the recipe used for a true peak, so an inter-sample peak has a decibel of
room above the sample the app measured.

**Why**: a true peak needs the signal oversampled (4×) with a proper interpolation filter;
that is a heavier, easily-wrong thing than the half-decibel it buys, and the app's own
verification cannot hear the difference. Measuring the sample peak and keeping the recipe's
−1.5 dBFS margin is honest and safe; the spec's criterion is worded as "no sample exceeds the
ceiling", which is exactly what this measures.

**Alternatives considered**: a 4× oversampled true peak — rejected for now as cost without a
verifier; it is the natural later refinement if a real session ever hears a clip clip. A
lower ceiling to be safe — rejected: it would cost loudness on every clip for a rare case.

## One target, and both directions

**Decision**: the target is a single **−16 LUFS** with a **−1.5 dBFS** ceiling, fixed for the
build. The gain brings the sound **to** the target: a quiet recording is lifted, a loud one
is brought down, and the ceiling always holds.

**Why**: the clarification chose one speech target, and −16 LUFS is the web/podcast one the
recipe starts from, which is what most DemoClip recordings are for. "Bring to the target"
rather than "only ever lift" is what the recipe's `loudnorm` does and what makes a set of
clips sit at the same loudness; a clip that must keep its own level is what the switch being
off is for.

**Alternatives considered**: lift only, never attenuate — rejected: two clips then sit at
different loudnesses, which is the problem the boost exists to fix. A choice of targets
(web/social/broadcast) — rejected by the clarification; it is a later iteration if it is
wanted, and the register already allows another item.

## The gain rule, and silence

**Decision**: `gainFor(lufs, peakDb)` returns the linear gain
`10^(min(target − lufs, ceiling − peakDb) / 20)`; when the sound is **silence** (nothing
above the absolute gate) it returns **1** — nothing to boost — and when the clip has no kept
sound at all the plan carries no sound and the gain is 1 as well.

**Why**: `min` is what keeps a lift from clipping: a recording whose peak is already near the
ceiling is lifted only until its peak reaches the ceiling, and one with a normal peak is
lifted all the way to the target. Silence has no loudness to measure, and a gain over zero
samples is still zero — but returning 1 makes "no sound, no boost" a value rather than an
accident. There is no separate maximum lift: the peak ceiling is the bound, and a recording
so quiet that lifting it makes its own floor audible is the recording's, exactly as the
recipe's own caveat says ("Nothing here fixes the recording"). It is **one gain for the whole
clip**, applied to every sample alike — **not a curve over time**: a correction that moved
moment to moment would be the compression the recipe warns against and the clarification
excludes, and one constant gain is exactly what makes the boost reversible and instant.

**Alternatives considered**: a maximum-lift cap in decibels — rejected: the ceiling already
bounds a normal recording, and an arbitrary cap would make a genuinely quiet recording miss
the target for no rule the spec states. A relative gate turned into a "quiet floor" rule —
rejected: R128's gating already decides what is measured; a second rule would be a stand-in
for the compression the recipe warns against. A curve over time (per-block gain) — rejected:
that *is* compression, and the clarification asked for loudness with peak safety alone.

## The number is measured once, from the kept sound, for both the review and the file

**Decision**: `src/infra/sound-boost.ts` decodes a clip's **kept** sound (the stretches the
file holds, from `plan.pieces` and `plan.takes`), concatenates it, measures it with the
domain `Loudness`, and returns the gain from the domain rule. The **encoder** calls it and
multiplies the rendered mix by the gain; the **review** calls it and sets a gain node to it.
Both measure the *same samples*, so the two numbers are the same number. The measurement is
**cached** per clip against the **sound** — a take added or a cut approved invalidates it —
and the **switch does not** change it: switching the boost off, or on again, reuses the
measurement and only changes which gain is applied. Turning the switch on in the review
therefore applies the gain at once whenever the sound has already been measured, which — the
switch being on by default — is the ordinary case; only a clip whose sound has never been
measured starts a measurement the moment the switch is turned on.

**Why**: the spec's FR-008 is stronger than a tolerance — the review and the file are to be
"produced the same way". Measuring the kept stretches (not each take whole, not the rendered
mix with its fades) gives both the identical input, so both compute the identical gain, and
the review is not a preview of anything else. Measuring the *rendered mix* in the encoder
and the takes in the review would have been two sources that agree only by luck. Caching
keeps the review from re-measuring a decode it has already paid for on every play.

**Alternatives considered**: measure the rendered mix in the encoder — rejected: the review
cannot easily build the same mix, so the two would drift by the fades. Measure each take
whole, ignoring the cuts — rejected: a clip whose loud part is cut away would be boosted to
the wrong level. Compute the gain in the view and pass it to the encoder — rejected: the
publish paths encode too, and a value threaded through every caller can disagree.

## The cost of the measurement

**Decision**: the measurement is one pass over the clip's kept sound. In the **export** it
costs almost nothing new: `renderAudio` has already decoded every take for the mix, and the
measurement is arithmetic over those same samples. In the **review** it costs one full-rate
decode — the app already decodes the clip's sound for the **waveform**, but at 8 kHz, which
cannot measure R128 (the weighting reaches above that band, and speech carries energy up to
it), so the measurement decodes again at the file's own rate. The measurement keeps **per-block
statistics and the peak**, not the samples, and decodes **one take at a time**, dropping each
before the next, so the memory is one take rather than the whole clip.

**Why**: the decode is the cost, not the arithmetic — the K-weighting is a few multiply-adds
per sample and the block table is one power per 100 ms, which is nothing beside a decoded
buffer. Decoding one take at a time is the discipline the waveform already uses, and it keeps
a long clip from holding its whole decoded sound in memory at once. The export's near-zero cost
is exactly why the boost is not a second pass over the media: the plan's one audio render pays
for it.

**Alternatives considered**: measure the waveform's 8 kHz decode — rejected: it is missing the
band R128 weights, so it would under-read speech and disagree with a full-band measurement, and
the export would then not reach the target the check measures. Raise the waveform's decode rate
— rejected: it would multiply the memory the waveform holds for its bars. A lower measurement
rate (16 kHz) in both places — a possible later refinement: it would cut the review's decode,
at the cost of leaving the standard's own rate. Persisting the measurement with the clip —
considered: it would spare a reload a re-measure, and it is a later iteration, since the clip
store would carry a derived value that a change to the target or to the measurement itself
would silently invalidate. Measuring on demand (the first play, the first export)
rather than when the review opens — considered: it saves the work for a clip that is never
played or exported, and it makes the first play wait; the plan measures in the background as
the review opens, and can move to on-demand if it ever shows.

## The review hears it through a second gain node

**Decision**: `src/ui/clip/fade.ts` keeps owning the element's audio graph and gains a second
gain node after the fade node — `element → fade gain → boost gain → destination`. A new
`src/ui/clip/boost.ts` computes the gain (through `src/infra/sound-boost.ts`) when the review
opens and when the clip's sound or the switch changes, and sets the node; the join fades go
on riding the first node, so the two never fight.

**Why**: the element's sound is already routed through one gain node for the fades, and the
fades set that node to 0 and back to 1 — a boost folded into the same node would be undone at
every join. A second node in series is the least thing that composes correctly, and it keeps
`fade.ts`'s rule (a fade is 0…1) intact. The refresh follows the clip's own events, as every
other view does.

**Alternatives considered**: reuse the fade node and make `1` mean the boost gain — rejected:
the fades ramp to a constant `1`, and changing what `1` means would touch every fade in the
app. A second `<audio>` element or a decoded playback buffer — rejected: it would duplicate
the transport, the cuts and the joins for one multiply.

## What is deliberately not changed

**Decision**: the **waveform** and the **size estimate** are unchanged, and the takes are
never re-encoded. The bars are the recording's shape — a constant gain scales every bar
alike, and the drawing already normalises to the tallest — and the file's size is set by the
encoder's bitrate, which the boost does not touch.

**Why**: drawing a boosted waveform would tell the person the recording had changed when it
had not, and the recording is exactly what the switch-off case returns. The file's size does
not move: the same second at the same bitrate.

**Alternatives considered**: redraw the bars at the boosted level — rejected: it is the same
shape, and it would say the recording changed. Re-encode the takes with the boost baked in —
rejected: it would break the non-destructive promise the switch rests on.

## Where a later treatment would go

**Decision**: a later sound treatment — the high-pass, a presence lift, a gate — is expected to
be added as the same two things this one is: a rule in `src/domain/sound/` (its parameters, and
any measurement it needs) and **one implementation applied at both sites** — the review's Web
Audio graph and the export's offline render. The recommendation this plan leaves behind is to
build such a treatment as a **Web Audio node graph**, so that one description serves the
review's realtime graph and the export's `OfflineAudioContext`, and "the review is what the file
carries" holds by construction rather than by two ports kept in step.

**Why**: the boost is a single multiply, so its two sites agree by being trivial — luck that
does not scale. Anything with state (a filter is small state; a compressor, a limiter or a gate
is look-ahead and memory) needs the *same* DSP in the review and in the export, or the promise
breaks quietly. A treatment expressed as nodes is the same description offline and live, so a
new algorithm costs the algorithm and not a second implementation of it. The measurement shape
is reusable but not universal: a filter needs no measurement, and a compressor needs an envelope
rather than a single number, so `boostGain`'s analyse-then-apply is the pattern for level-like
treatments, not a general frame.

**What it would still cost**: the review's **decode** remains its floor whatever the algorithm;
a treatment with look-ahead or a noise profile costs more than a biquad; and every new treatment
is a **product decision** before a technical one — a further profile item, or a change to what
the boost means — and the current scope deliberately stops at loudness with peak safety.

**Alternatives considered**: write each treatment twice, as nodes for playback and as a sample
loop for the export — rejected: two implementations of one sound drift, which is the failure the
review-and-file promise exists to prevent. Bake treatments into the takes — rejected: it would
end the non-destructiveness the switch rests on, for a speed this feature does not need.

## The property reaches every export through the plan

**Decision**: `ExportPlan` gains **`soundBoost: boolean`**, derived in `planExport` from
`boostsSound(clip.properties)`, and the encoder applies it in `renderAudio` — the one place
the video export, the sound-only export and both publish paths already share.

**Why**: `planExport` is what the download, Bluesky and YouTube all call, so a fact on the
plan reaches every encode with no caller threading it, and the encoder has one place to read
it. `renderAudio` is the one audio path for a video and for a sound-only file, so a single
multiply covers both. This is the same decision shape as spec 011's `audio`/`soundOnly`.

**Alternatives considered**: an `EncodeOptions` field — rejected: options are the caller's,
and a caller must not be able to disagree with the clip. A second audio renderer for the
boost — rejected: one path cannot drift from itself.

## The agent and the MCP server

**Decision**: `describe_clip` already lists every clip property from the register, so the
boost appears to an agent with no change. The MCP `set_clip_property` gains `"soundBoost"` in
its `property` enum and says in its description what it does and that `"true"` turns it on
and anything else off — the same shape as `"addToExport"`.

**Why**: the surface is the app's own operations, and a rule the app has but the tool
description does not would have an agent blind to a setting the person can move. The
description is the tool's documentation and must say what the app does.

**Alternatives considered**: a boost-only tool — rejected: the surface adds no operation the
person does not have; this is the existing `set_clip_property` with one more property.

## Verification: R128 vectors in node, and the file's loudness in the browser

**Decision**: the rules are unit-tested in node — `Loudness.test.ts` against the standard
R128 signals (a full-scale 1 kHz sine is −3.01 LUFS, 20 dB down is −23.01 LUFS, digital
silence gates to nothing), `SoundBoost.test.ts` (a lift, an attenuation, the peak cap, and
silence → 1), `Clip.test.ts` and `clip-properties.test.ts` (on by default, the off
round-trip, a profile's `'false'`), `ExportPlan.test.ts`/`export-clip.test.ts` (the plan
follows the clip). The browser behaviour is one committed check in `e2e/checks/export.spec.ts`
that seeds a **quiet** fixture take, exports with the boost on and then off, and measures each
file's loudness in the page with the app's own `Loudness` module — so the check proves the
file, not a stand-in for it. A fold in `e2e/checks/profiles.spec.ts` proves the profile story:
a profile fixing the boost off makes a clip whose export is un-boosted and whose row reads as
fixed by the profile.

**Why**: the verification skill asks for a unit test per rule and a committed browser check
for what is heard or encoded, and it prefers fixture takes to recordings for an export check.
The fixture gains a **level** so a take can be quiet on purpose, and the loudness helper
decodes the file in the page with the app's own module rather than a second implementation in
the suite. The profile check is the second, independent story the skill allows — the
guardrail beside the person's own switch — not a second behaviour of the first.

**Alternatives considered**: a check per behaviour (default on, off, profile on, profile
off, sound-only) — rejected by the skill's one-or-two rule; the two checks walk the two
stories, and the sound-only path shares the one `renderAudio` the export check already drives.
Asserting the loudness in the runner instead of the page — rejected: decoding WebM/MP4 audio
is the browser's job, and the page already has the app's module. A recorded take — rejected:
a fixture is deterministic and a real microphone is the person's own session.

## The real session is the ear

**Decision**: whether the boost makes a person's own voice sound right, and whether the
review plays the boosted sound they then get in the file, is a **real session** with the
person's own microphone and ears — the check measures numbers, not what they hear.

**Why**: the numbers prove the loudness, not the judgement; the recipe's own note is that the
targets are a judgement and that distance, an off-axis mic and the room are in the bytes.
Saying so is the honest gap the verification skill asks for.

**Alternatives considered**: capture the review's output audio in the suite and compare it —
rejected: Playwright cannot record the page's audio, and a Web Audio graph is not observable
from outside without a hook the app does not have.
