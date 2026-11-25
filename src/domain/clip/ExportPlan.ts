// What an export is made of, decided before anything is encoded.
//
// The exporter used to work this out as it went: a running offset, the take each
// kept stretch belongs to and where it first lands, the window of each take to
// decode, the joins to fade and dissolve — all interleaved with the encoding, in
// a file that also owns a canvas, a demuxer and a WebCodecs encoder. That is a
// plan, and a plan is a value: it is decided once, from the clip, and it can be
// read and tested without a browser in sight.
//
// Both units live here together, as they do in TimelineMap: a piece holds seconds
// of the recording and seconds of the output file, and no caller has to convert
// between them by hand.

import type { Segment } from './Clip.js';
import type { Take } from './Take.js';
import { AnnotationSet } from '../annotation/AnnotationSet.js';
import type { Annotation } from '../annotation/Annotation.js';
import type { SoundAnnotation } from '../annotation/SoundAnnotation.js';
import { TimelineMap } from './TimelineMap.js';
import type { IntroCard } from './IntroCard.js';

/** One kept stretch of one take, placed in the file the export will write. */
export interface ExportPiece {
  takeIndex: number;
  from: number;   // seconds of the recording, inclusive
  to: number;     // seconds of the recording, exclusive
  at: number;     // seconds into the output file
}

/**
 * One kept stretch in the seconds of **the take it belongs to**: what a decoder that opens one
 * take at a time indexes by. It is the same stretch as the `ExportPiece` it came from — `at` is
 * unchanged — with the two units the plan holds told apart, so no adapter has to remember which
 * one a number is in.
 */
export interface LocalPiece {
  takeIndex: number;
  from: number;   // seconds of that take, inclusive
  to: number;     // seconds of that take, exclusive
  at: number;     // seconds into the output file
}

/** One take that survives the cuts: how far into it to decode, and where it lands. */
export interface ExportStep {
  takeIndex: number;
  localTo: number;                       // the take's own seconds to decode up to
  at: number;                            // where it begins in the output file
  joinAt: number | null;                 // where the join to dissolve from begins, or null
}

/** Where an export puts a clip's annotations: drawn into the picture, or carried beside it. */
export type AnnotationExport = 'drawn' | 'carried';

/**
 * One kept part of one sound annotation, where the file will hold it: the stock sound to play,
 * where it lands in the file (`at`), how far into that sound this part begins (`from`), and how
 * long it lasts (`length`). A sound whose stretch a cut runs through becomes two of these — one
 * per kept part — so the cut takes its part of a sound exactly as it takes its part of a picture,
 * and the part after the cut resumes the sound where it had got to.
 */
export interface Sounding {
  readonly sound: string;
  readonly at: number;      // output seconds, past any title card
  readonly from: number;    // seconds into the stock sound
  readonly length: number;  // seconds
}

/**
 * The kept parts of the sound annotations, in the file's own seconds. A sound annotation's
 * stretch is a fraction of the **recording**; each kept piece it covers becomes a `Sounding`,
 * so a cut leaves a gap the sound does not play over. The two units are the plan's business, as
 * `localPieces()` is — a caller never maps a span itself.
 */
function soundingsFor(
  sound: readonly SoundAnnotation[],
  pieces: readonly ExportPiece[],
  offset: number,
  recordingLength: number,
  map: TimelineMap,
): Sounding[] {
  if (!(recordingLength > 0)) return [];
  const out: Sounding[] = [];
  for (const annotation of sound) {
    const s = annotation.span.s * recordingLength;
    const e = annotation.span.e * recordingLength;
    for (const piece of pieces) {
      const from = Math.max(s, piece.from);
      const to = Math.min(e, piece.to);
      if (!(to > from)) continue;
      out.push({
        sound: annotation.geometry.sound,
        at: offset + map.keptOf(from),
        from: from - s,
        length: to - from,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.sound < b.sound ? -1 : a.sound > b.sound ? 1 : 0));
}

/** What an export needs that is not the clip: how a join fades and where annotations go. */
export interface ExportSettings {
  fadeSeconds: number;
  /** Drawn in for a file to watch, carried in a **sidecar** for a file to work on. */
  annotations: AnnotationExport;
  /** A title card at the head of the file, or null for none. */
  intro?: IntroCard | null;
}

export class ExportPlan {
  private constructor(
    readonly pieces: readonly ExportPiece[],
    readonly steps: readonly ExportStep[],
    readonly takes: readonly Take[],
    readonly to: number,            // where the export ends, in seconds of the recording
    readonly total: number,         // seconds the file will hold
    readonly audio: boolean,
    readonly fadeSeconds: number,
    readonly annotations: AnnotationSet,   // what is drawn over the picture
    private readonly map: TimelineMap,
    private readonly starts: readonly number[],
    /** The card at the head of the file, or null. */
    readonly intro: IntroCard | null,
    /** How long that card is, which is how far the clip's own frames are pushed along. */
    readonly introSeconds: number,
    /**
     * No kept take carries a picture: the file the export writes holds the sound and
     * no picture at all. The clip's own fact — a **sound-only** file — and what tells the
     * encoder to write an audio track without a video one, and a video service to refuse it.
     */
    readonly soundOnly: boolean,
    /**
     * The clip's sound is to be **boosted**: brought to the app's target loudness with peak
     * safety, as the sound is heard and written. The clip's own setting — a clip property a
     * **profile** may fix — so every encoder reads it here and no caller can disagree. It is
     * independent of `audio`: a plan with no sound has the flag and nothing to do with it.
     */
    readonly soundBoost: boolean,
    /**
     * The clip's **sound annotations**, kept ones or not; `soundings()` narrows them to the
     * kept parts. Independent of `annotations`, which is what is **drawn** — a carried export
     * draws none and still carries the sounds, because a sound has nothing to draw.
     */
    readonly sound: readonly SoundAnnotation[] = [],
  ) {}

  /**
   * Place the kept stretches end to end on the output timeline. `segments` is
   * what the clip says survives the cuts; `to` is where the export stops, in
   * seconds of the recording; `map` is the recording and the timeline mapped both
   * ways, which is where a frame's position comes from; `annotations` is what the
   * clip says is drawn over the picture. `intro` is a card at the head of the file,
   * if the export has one: it takes the first seconds, and every kept stretch lands
   * that much later. `soundBoost` is whether the clip's sound is to be brought to the
   * app's target loudness — the clip's own setting, handed in by `planExport`.
   */
  static of(
    segments: readonly Segment[],
    takes: readonly Take[],
    to: number,
    map: TimelineMap,
    settings: ExportSettings,
    annotations: AnnotationSet = AnnotationSet.EMPTY,
    intro: IntroCard | null = null,
    soundBoost = false,
    sound: readonly SoundAnnotation[] = [],
  ): ExportPlan {
    // The kept takes' own facts decide what the file holds: a picture from any take that
    // has one, and sound from any take that carries an audio track. A sound-only file has
    // no picture for a **title card** to be drawn on, so the card is not part of the plan.
    const soundOnly = !segments.some(seg => !!takes[seg.takeIndex]?.picture);
    const card = soundOnly ? null : intro;
    const offset = card?.seconds ?? 0;
    const starts: number[] = [];
    let running = 0;
    for (const take of takes) { starts.push(running); running += take.duration; }

    const pieces: ExportPiece[] = [];
    let total = 0;
    for (const seg of segments) {
      pieces.push({ takeIndex: seg.takeIndex, from: seg.from, to: seg.to, at: offset + total });
      total += seg.to - seg.from;
    }

    // A clip whose takes are silent still has sound to write if it holds a sound
    // annotation: the added sound is the file's audio.
    const audio = segments.some(seg => !!takes[seg.takeIndex]?.hasAudio)
      || soundingsFor(sound, pieces, offset, map.length, map).length > 0;

    // Where each take first lands on the output timeline: that is where a join
    // is, and so where a dissolve has to start.
    const firstAt = new Map<number, number>();
    for (const piece of pieces) if (!firstAt.has(piece.takeIndex)) firstAt.set(piece.takeIndex, piece.at);

    const steps: ExportStep[] = [...firstAt.keys()].map((takeIndex, i) => {
      const at = firstAt.get(takeIndex) ?? 0;
      const start = starts[takeIndex] ?? 0;
      return {
        takeIndex,
        at,
        joinAt: i === 0 ? null : at,          // the first take has nothing to join to
        // How far into this take the export reaches, in the take's own seconds.
        localTo: Math.min(to, start + (takes[takeIndex]?.duration ?? 0)) - start,
      };
    });

    return new ExportPlan(
      pieces, steps, takes, to, offset + total, audio, settings.fadeSeconds,
      annotations, map, starts, card, offset, soundOnly, soundBoost, sound,
    );
  }

  /**
   * Where the sound annotations land in the file, in its own seconds — one entry per kept
   * part of each. A cut through a stretch leaves a gap the sound does not play over, so the
   * file and the review place a sound at the same moment. The plan owns the recording-to-file
   * conversion, as `localPieces()` does; a caller never maps a span itself.
   */
  soundings(): readonly Sounding[] {
    return soundingsFor(this.sound, this.pieces, this.introSeconds, this.map.length, this.map);
  }

  /**
   * The annotations shown at a moment of the recording, in draw order. This is the
   * clip's own answer, through the same set and the same mapping the review uses —
   * so the file cannot disagree with what was seen.
   */
  annotationsAt(source: number): readonly Annotation[] {
    return this.annotations.shownAt(source, this.map);
  }

  /**
   * The recording's own length — what the annotations' stretches are fractions of,
   * and so what a frame needs to work out how far into a stretch it is.
   */
  get recordingLength(): number {
    return this.map.length;
  }

  /** Where a take begins on the recording's own timeline. */
  startOf(takeIndex: number): number {
    return this.starts[takeIndex] ?? 0;
  }

  /**
   * The kept stretches in each take's own seconds. A piece's `from` and `to` are the
   * **recording's** — the clip's timeline, where the cuts and the annotations live — while
   * anything that opens one take at a time indexes by that take's own; the two are one
   * subtraction apart, and this is the one place it is made, so a decoder cannot read a piece's
   * times as its own by mistake.
   */
  localPieces(): readonly LocalPiece[] {
    return this.pieces.map(piece => {
      const start = this.startOf(piece.takeIndex);
      return {
        takeIndex: piece.takeIndex,
        from: Math.max(0, piece.from - start),
        to: Math.max(0, piece.to - start),
        at: piece.at,
      };
    });
  }

  /**
   * Where a moment of the recording lands in the output file — the kept time, pushed
   * along by the card at the head if the export has one. This is the expression the
   * exporter reached for by hand, in one place, so the frame loop has no units to mix up.
   */
  outputTimeOf(source: number): number {
    return this.introSeconds + this.map.keptOf(source);
  }

  /** Is a different take on the other side of this piece? Then a join is there. */
  joinsPrev(piece: number): boolean {
    return piece > 0 && this.pieces[piece].takeIndex !== this.pieces[piece - 1].takeIndex;
  }

  joinsNext(piece: number): boolean {
    return piece + 1 < this.pieces.length && this.pieces[piece].takeIndex !== this.pieces[piece + 1].takeIndex;
  }
}
