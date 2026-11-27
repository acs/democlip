---
name: Domain model
description: How to work in DemoClip's domain — value objects, the Clip aggregate, ports, where a new rule belongs, and the rule that the view listens. Use when adding or changing a rule, a class or a module under src/.
---

# The domain model

## The shape

```
src/
  domain/      pure rules: no DOM, no browser API, no import from ui/ or infra/
    clip/      Span, SpanSet, TimelineMap, Take, TakeRepository (a port), Clip (the aggregate)
    annotation/ Annotation (the base class), its kinds (Arrow, ImageAnnotation,
                TextAnnotation), AnnotationSet, AnnotationColour, the register
    capture/   CropRegion and SourceSet — the crop and the three source toggles
    export/    ExportTarget — the container an export writes
    youtube/   the YouTube destination's rules: Visibility, VideoDetails,
               UploadableVideo
    session/   Session — the sitting: the clip and the capture latch
  application/ the use cases that run in node, and the ports they own
    ports/     CapturePort, WebcamPort, MicrophonePort, TakeRecorderPort,
               CompositorPort, TakeProbePort, ClockPort, EncoderPort,
               DownloadPort, FrameRendererPort, KeptClipPort, ImageStorePort
               (and, beside their use cases, bluesky-service.ts and
               youtube-service.ts for the two destinations)
  infra/       the browser boundary: capture, compositor, recorder, probe, clock,
               encoder, codecs, download, takes (the object URLs), the clip store,
               images (the picture store and its decoded cache), Bluesky, YouTube
  ui/          the DOM and the interaction: renders the model, owns no rules
    annotating/ the annotation plugin seam: the plugin registry, the plugin and the
                canvas every kind is edited through, the annotate options (the vertical
                column that offers every kind on the picture), the unit of an
                annotation's duration, the properties inspector and the text entry, and
                one file per kind
    agent/      the automation surface: the app's own operations in one object,
                published only when the page asks (`?agent=1`). It adds no rule — it
                calls the flows and the clip, exactly as a button does
    *-flow.ts  the view flows: record, review, export, publish, resume
  state.ts     the phase only — one owner and one change event
  session.ts   the composition: the single Session object
  main.ts      the composition root: the only module importing all four layers
mcp/           the MCP server — outside the app's four layers, in node, reaching
               the app only through the page. It owns no rule of the app either
```

A port lives beside the use case that needs it; an adapter lives in `infra/`; a
view flow lives in `ui/`. A module in `domain/` or `application/` imports neither
the view nor a browser adapter.

## Where a rule belongs

A concept that needs rules is a **class named after the word** — `Span`, `SpanSet`,
`Take`, `Clip`, an annotation kind like `Arrow`. A class is for a thing that decides
something. An **interface is for data with no rules** — `Segment`, `ExportPiece`,
`ClipSnapshot`, the geometry a kind is handed. Reaching for an interface because it
is quicker is how a rule ends up in a free function every caller has to remember.

A kind of thing that is drawn or played is **a class plus a plugin**: its rules in
`domain/` (how a shape is normalised, whether it is worth keeping, how it is moved,
resized and hit), and an `AnnotationPlugin` in `ui/` under the same id — its action,
its renderer, and how a new one is made — because `src/domain/` may not touch a canvas.
The id is the whole of the coupling; adding a kind is a class, a line in the register,
and a plugin. Picking, moving, resizing, copying, deleting and undoing a kind are the
**annotation canvas**'s, and a new kind gets them by existing.

A rule also lives in **one place**, and everything asks it. Two copies drift: the
export once drew annotations in a different order from the review, because it
re-implemented the clip's answer instead of asking for it.

Ask who owns the thing the rule is about:

- about a **range** — order it, merge it, clamp it, intersect it → the value object (`Span`)
- about a **set of ranges** — that they never overlap, how long they cover → `SpanSet`
- about **the clip as a whole** — its length, what approving a trim means, what an
  export is made of, what a new take does to the removed regions → the aggregate
- about **a take** — it has identity, and a length it cannot be built without → `Take`
- about **the browser** — object URLs, encoders, seeking → an adapter in `infra/` or
  a flow, never the domain

An invariant belongs in the type that can enforce it: "a `SpanSet` cannot overlap"
and "a `Take` cannot have length 0" are worth more than a rule someone is asked to
remember. Prefer *cannot be represented* to *must remember to check*.

## Collaborators are ports

The aggregate needs takes and must not know how they are held, so
`domain/clip/TakeRepository.ts` is an **interface** and `InMemoryTakeRepository` in
`infra/` implements it. That is what lets `Clip.test.ts` run in node against a fake,
and it is the seam persistence would go through.

## The view listens

`app.clip.onChange(...)` announces what changed — a take added, a region approved or
put back, the handles moved, the session dropped — and the modules that draw the clip
react to what concerns them. Do not:

- call another view module's re-render from a flow or from a model change
- re-render "because I was the caller"
- put the reaction in the caller *around* the call: it runs while the model is still
  announcing, and it renders a half-updated state. That bug has happened once.

What does stay with a flow is the sequencing that depends on the **browser** — such
as building the thumbnails, which needs the element to be holding the take first.
Events say what changed about the clip, not when the browser is ready.

## State has an owner, and a lifetime

Model state belongs to the clip. View state belongs to the view module that owns the
widget, and that module **exports the instance** its state lives on (`liveTimeline`,
`playback`). Nothing else is shared, and `state.ts` should keep shrinking.

So a view module's state is an **object with a lifetime**, not module-level `let`s: the
take in progress is a `LiveTimeline`, the transport is a `Playback`. The **session** is
what ends those lifetimes — `session.reset()` is the whole of "this session is over",
and the New button is only the flow around it. That is also what lets the app be
exercised twice in one page, which the browser harnesses now rely on.

## Tests come with the rule

Every rule above gets a unit test beside it, in node, with a fake behind any port.
`Clip.test.ts` is the pattern for an aggregate, `SpanSet.test.ts` for a value object.

## The words

Use the words in `docs/GLOSSARY.md` — in the code, the tests, the commits and the pull
request — and add a new concept there first. `part` was a second name for `take` for
a while, and undoing it touched nine modules.

## A message a person reads comes from the catalogue

The app speaks the person's language (see **overview**, and the language words in
`docs/GLOSSARY.md`), so **no message a person can see is written into the code**. A new
label, status line, toast, error, tooltip or accessible name is a **translation key** —
added to `src/ui/i18n/catalogs/en_UK.ts` (the source) **and** `es_ES.ts`, or the type
check and `catalogs.test.ts` fail — and resolved where it is drawn with `t('area.key')`.

- A message with a value in it carries `{name}` and is filled by `t(key, { name })`, so a
  language may move the value within the sentence. A count-bearing sentence is written to
  read correctly at any count — there are no plural forms.
- A static element in `web/` or `src/ui/shell/help-steps.html` names its key with
  `data-i18n` (or `data-i18n-html` where it carries first-party markup) instead of a
  literal, and the startup pass fills it.
- The app's own **declared** names — a clip property's, an annotation kind's, a colour's,
  a stock sound's — are resolved through `src/ui/i18n/labels.ts`, so the declaration keeps
  the stable English name an agent reads while a person reads their own language.
- The app's name, its **logo** names, and anything the person wrote themselves (a clip's
  title, a project's name) are marks or the person's words, and are never translated.

A new message with no key is the mistake this rule exists to prevent: it is invisible in
English and leaves a Spanish user reading a foreign word.
