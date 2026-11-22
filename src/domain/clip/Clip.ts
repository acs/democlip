// The clip: the takes and what was cut away. The aggregate.
//
// Everything else in the app asks this object what the clip is. It owns the three
// things that have to agree with each other —
//
//   * the takes, in order, and so the clip's length (the sum of them, derived, so
//     it cannot drift from the takes it is made of);
//   * the cuts — the stretches approved out of it — as a set that cannot overlap;
//   * the annotations — what is drawn over the picture — as a set that can;
//   * what the clip says about itself — its title, its description — which nothing
//     else is a fraction of and nothing is scaled when the clip grows.
//
// — and it owns the rules that relate them, which used to be spread between the
// marks module, the exporter and a couple of fields on the app: a cut that is
// approved leaves the timeline, the cuts and the annotations are fractions of a clip
// that grows when a new take arrives, and the kept stretches of the clip are what an
// export is made of.
//
// It also owns the one undo the user has. It takes back the last change of any kind
// — a cut approved, an annotation added, changed or removed — because that is what a
// person means by "undo", whichever they last did.
//
// It takes its takes from a `TakeRepository` (the port), so nothing here touches
// the browser and the whole thing can be tested with a fake collection.

import { Span } from './Span.js';
import { SpanSet } from './SpanSet.js';
import { TimelineMap } from './TimelineMap.js';
import { ClipProperties } from './ClipProperties.js';
import { AnnotationSet } from '../annotation/AnnotationSet.js';
import { annotationFrom } from '../annotation/kinds.js';
import type { Annotation, StoredAnnotation } from '../annotation/Annotation.js';
import type { Take } from './Take.js';
import type { TakeRepository } from './TakeRepository.js';

/** A stretch of one take that survives the cuts, in seconds of the recording. */
export type Segment = { takeIndex: number; from: number; to: number };

/**
 * A clip written down: the takes it is made of (the recording bytes and the
 * length each one has), its cuts, its annotations and what it says about itself.
 * `snapshot()` gives one and `restore()` takes one back, and it is the shape a store
 * persists — the blobs are the recordings themselves. `annotations` and `properties`
 * are optional so a clip written down before either existed still reads back.
 */
export interface ClipSnapshot {
  takes: ReadonlyArray<{ blob: Blob; duration: number }>;
  cuts: ReadonlyArray<{ s: number; e: number }>;
  annotations?: ReadonlyArray<StoredAnnotation>;
  properties?: Readonly<Record<string, string>>;
}

/**
 * What just happened to the clip. The view listens for these instead of
 * re-rendering because it happened to be the caller: the model says what changed,
 * and everything that shows the clip decides what to do about it.
 *
 * Each event carries what a listener needs to react without asking more questions
 * — `previousTotal` is there so a view holding positions as fractions of the clip
 * can re-base them itself, which is what the marks do.
 */
export type ClipEvent =
  | { type: 'take-added'; take: Take; index: number; previousTotal: number }
  | { type: 'cut-approved'; cut: Span; removed: number }
  | { type: 'cut-undone'; cut: Span }
  | { type: 'annotation-added'; annotation: Annotation }
  | { type: 'annotation-changed'; annotation: Annotation; previous: Annotation }
  | { type: 'annotation-removed'; annotation: Annotation }
  | { type: 'property-changed'; id: string; value: string; previous: string }
  | { type: 'cleared' };

/**
 * The last change to the clip, and so what the one undo would take back. A cut
 * carries the set it replaced, so putting it back needs nothing else remembered.
 */
export type ClipChange =
  | { type: 'cut-approved'; cut: Span; removed: number; before: SpanSet }
  | { type: 'annotation-added'; annotation: Annotation }
  | { type: 'annotation-changed'; annotation: Annotation; previous: Annotation }
  | { type: 'annotation-removed'; annotation: Annotation }
  | { type: 'property-changed'; id: string; value: string; previous: string };

export type ClipListener = (event: ClipEvent) => void;

export class Clip {
  private lastChange: ClipChange | null = null;
  private readonly listeners = new Set<ClipListener>();

  private constructor(
    private readonly repo: TakeRepository,
    private removed: SpanSet,
    private notes: AnnotationSet,
    private props: ClipProperties,
  ) {}

  /** A clip with nothing in it yet. */
  static empty(takes: TakeRepository): Clip {
    return new Clip(takes, SpanSet.EMPTY, AnnotationSet.EMPTY, ClipProperties.EMPTY);
  }

  /** Listen for what happens to the clip. Call the returned function to stop. */
  onChange(listener: ClipListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get takes(): TakeRepository {
    return this.repo;
  }

  /** What was cut away, as fractions of the clip, in one non-overlapping set. */
  get cuts(): SpanSet {
    return this.removed;
  }

  /** What is drawn over the picture, as fractions of the clip. May overlap. */
  get annotations(): AnnotationSet {
    return this.notes;
  }

  /** What the clip says about itself — its title, its description. */
  get properties(): ClipProperties {
    return this.props;
  }

  /** How long the clip is: the sum of its takes, never a field beside them. */
  total(): number {
    return this.repo.totalDuration();
  }

  /** The recording and the timeline, mapped both ways. */
  timeline(): TimelineMap {
    return TimelineMap.forClip(this.removed.spans, this.total());
  }

  /** How long the clip is once the cuts are gone: what an export holds. */
  keptLength(): number {
    return this.timeline().kept;
  }

  /**
   * A new recording at the end. The clip is longer, and the cuts and the
   * annotations are fractions of it, so they are re-based to stay over the same
   * moments — and the last change cannot be undone across a join it was never
   * measured against.
   */
  addTake(blob: Blob, duration: number): Take {
    const before = this.total();
    const take = this.repo.add(blob, duration);
    const now = this.total();
    if (before > 0 && now > before) {
      const k = before / now;
      this.removed = this.removed.scaled(k);
      this.notes = this.notes.rebase(k);
    }
    this.lastChange = null;
    this.announce({ type: 'take-added', take, index: this.repo.count() - 1, previousTotal: before });
    return take;
  }

  /**
   * Approve a cut: it leaves the timeline, and how much that was worth comes
   * back. The cut is held so it can be put back.
   */
  approve(cut: Span): number {
    const before = this.keptLength();
    const previous = this.removed;
    this.removed = this.removed.add(cut);
    const removed = before - this.keptLength();
    this.lastChange = { type: 'cut-approved', cut, removed, before: previous };
    this.announce({ type: 'cut-approved', cut, removed });
    return removed;
  }

  // ── Annotations ────────────────────────────────────────────────────────────

  /** A new annotation, at the end of the order. */
  addAnnotation(annotation: Annotation): void {
    this.notes = this.notes.add(annotation);
    this.lastChange = { type: 'annotation-added', annotation };
    this.announce({ type: 'annotation-added', annotation });
  }

  /** Replace one, keeping its id. Says whether it was there to replace. */
  changeAnnotation(id: string, next: Annotation): boolean {
    const previous = this.notes.byId(id);
    if (!previous) return false;
    this.notes = this.notes.change(id, next);
    this.lastChange = { type: 'annotation-changed', annotation: next, previous };
    this.announce({ type: 'annotation-changed', annotation: next, previous });
    return true;
  }

  /** Take one out. Returns what was removed, or null when there was none. */
  removeAnnotation(id: string): Annotation | null {
    const annotation = this.notes.byId(id);
    if (!annotation) return null;
    this.notes = this.notes.remove(id);
    this.lastChange = { type: 'annotation-removed', annotation };
    this.announce({ type: 'annotation-removed', annotation });
    return annotation;
  }

  /**
   * The annotations shown at a moment of the recording, in draw order. A moment
   * inside a cut shows nothing — the annotation is still the clip's, it is only
   * that the picture under it is gone — which is how a cut takes its part of an
   * annotation's stretch with it, with no rule of its own.
   */
  annotationsAt(source: number): readonly Annotation[] {
    return this.notes.shownAt(source, this.timeline());
  }

  /**
   * The annotations as a file of the kept stretches holds them: every stretch moved
   * into the file's own time — the cuts applied there, and a title card at the head
   * pushing them along by `introSeconds` — and any annotation the cuts took entirely
   * dropped. This is what an export writes beside a file rather than into it, so that
   * what comes back is what the file holds.
   */
  annotationsAsExported(introSeconds = 0): StoredAnnotation[] {
    const total = this.total();
    const kept = this.keptLength();
    if (!(total > 0) || !(kept > 0)) return [];
    const length = kept + introSeconds;         // the file's own length, card and all
    const map = this.timeline();
    const out: StoredAnnotation[] = [];
    for (const annotation of this.notes.all) {
      const stored = annotation.stored();
      const s = (introSeconds + map.keptOf(stored.s * total)) / length;
      const e = (introSeconds + map.keptOf(stored.e * total)) / length;
      if (!(e - s > 0.0005)) continue;               // the cuts took the whole of it
      out.push({ ...stored, s, e });
    }
    return out;
  }

  /**
   * The annotations a file carried, taken on as the clip's own — what an import does with
   * a **sidecar**. A load rather than an edit, like `restore`: the flow that brings a file
   * in opens the review itself, and there is nothing of the clip's to take back, because
   * they arrived with the take. Answers how many were taken on.
   */
  carry(annotations: AnnotationSet): number {
    let taken = 0;
    for (const annotation of annotations.all) {
      const was = this.notes.count;
      this.notes = this.notes.add(annotation);
      if (this.notes.count > was) taken++;
    }
    this.lastChange = null;
    return taken;
  }

  // ── What the clip says about itself ─────────────────────────────────────────

  /**
   * Set one of the clip's own properties — its title, its description. Says whether
   * anything changed: setting a property to what it already holds is not a change, so
   * it is announced to nobody and is not what the undo would take back.
   */
  setProperty(id: string, value: string): boolean {
    const previous = this.props.get(id);
    if (previous === value) return false;
    this.props = this.props.with(id, value);
    this.lastChange = { type: 'property-changed', id, value, previous };
    this.announce({ type: 'property-changed', id, value, previous });
    return true;
  }

  // ── Undo ───────────────────────────────────────────────────────────────────

  /** Is there a change to take back? */
  canUndo(): boolean {
    return this.lastChange !== null;
  }

  /** What the one undo would take back, or null. */
  pendingUndo(): ClipChange | null {
    return this.lastChange;
  }

  /** How many seconds the last approved cut took off the timeline, or 0. */
  lastRemoved(): number {
    return this.lastChange?.type === 'cut-approved' ? this.lastChange.removed : 0;
  }

  /**
   * Put the last change back — a cut, or an annotation added, changed or removed —
   * and say what it was, so the view can follow. One action, whatever kind it was.
   */
  undo(): ClipChange | null {
    const last = this.lastChange;
    if (!last) return null;
    this.lastChange = null;
    switch (last.type) {
      case 'cut-approved':
        this.removed = last.before;
        this.announce({ type: 'cut-undone', cut: last.cut });
        break;
      case 'annotation-added':
        this.notes = this.notes.remove(last.annotation.id);
        this.announce({ type: 'annotation-removed', annotation: last.annotation });
        break;
      case 'annotation-removed':
        this.notes = this.notes.add(last.annotation);
        this.announce({ type: 'annotation-added', annotation: last.annotation });
        break;
      case 'annotation-changed':
        this.notes = this.notes.change(last.annotation.id, last.previous);
        this.announce({ type: 'annotation-changed', annotation: last.previous, previous: last.annotation });
        break;
      case 'property-changed':
        this.props = this.props.with(last.id, last.previous);
        this.announce({ type: 'property-changed', id: last.id, value: last.previous, previous: last.value });
        break;
    }
    return last;
  }

  /**
   * The kept stretches of a range of the recording, in seconds, each saying which
   * take it belongs to. This is what an export is made of, and it is the clip's
   * answer rather than the exporter's loop.
   */
  segmentsIn(from: number, to: number): Segment[] {
    const takes = this.repo.all();
    const gone = this.removed.scaled(this.total());     // the cuts, in seconds
    const out: Segment[] = [];
    let at = from;
    while (at < to - 0.001) {
      const cutEnd = gone.endAt(at);
      if (cutEnd !== null) { at = Math.min(cutEnd, to); continue; }
      const index = this.repo.indexAt(at);
      let end = Math.min(to, takes[index] ? this.repo.startOf(index) + takes[index].duration : to);
      for (const cut of gone.spans) if (cut.s > at + 0.001 && cut.s < end) end = cut.s;
      if (end <= at + 0.001) break;
      out.push({ takeIndex: index, from: at, to: end });
      at = end;
    }
    return out;
  }

  /**
   * Everything this clip is made of, so it can be written down and read back:
   * its takes, its cuts, its annotations and what it says about itself.
   */
  snapshot(): ClipSnapshot {
    return {
      takes: this.repo.all().map(take => ({ blob: take.blob, duration: take.duration })),
      cuts: this.removed.spans.map(span => ({ s: span.s, e: span.e })),
      annotations: this.notes.all.map(annotation => annotation.stored()),
      properties: this.props.toRecord(),
    };
  }

  /**
   * Rebuild this clip from a snapshot — the takes, the cuts and the annotations.
   * Nothing is announced: a restore is a load rather than a change to a clip
   * already on screen, and the flow that restores sets the view up itself. The
   * takes already in the repository are dropped, object URLs and all.
   *
   * An annotation of a kind this version does not know is dropped rather than
   * throwing, so a clip written by a later version still opens.
   */
  restore(snapshot: ClipSnapshot): void {
    this.repo.clear();
    for (const take of snapshot.takes) this.repo.add(take.blob, take.duration);
    this.removed = SpanSet.of(snapshot.cuts);
    this.notes = AnnotationSet.of(
      (snapshot.annotations ?? [])
        .map(stored => annotationFrom(stored))
        .filter((annotation): annotation is Annotation => annotation !== null),
    );
    this.props = ClipProperties.of(snapshot.properties);
    this.lastChange = null;
  }

  /** The session is over. */
  clear(): void {
    this.repo.clear();
    this.removed = SpanSet.EMPTY;
    this.notes = AnnotationSet.EMPTY;
    this.props = ClipProperties.EMPTY;
    this.lastChange = null;
    this.announce({ type: 'cleared' });
  }

  /** Tell the listeners, on a copy of the set so one may unsubscribe while it runs. */
  private announce(event: ClipEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
