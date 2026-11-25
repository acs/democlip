// The sound: the fourth kind — a stock sound shown over a stretch of the clip, mixed with the
// recorded sound.
//
// It is a kind like the others — an id, a span, and one fact of its own — and it behaves like
// the others in every way that does not need a shape: it is kept with the clip, marked on the
// **annotation lane**, copied, deleted and undone through the shared canvas, and written down
// and read back with the clip. What it does is **heard**, not drawn.
//
// So its shape is deliberately empty. `handles()` answers nothing — there is no box to drag —
// and `hitTest` answers false, so it is never picked from the picture; the lane is its finder
// and its editing home. Its one fact is the **name** of the stock sound it plays, held in its
// geometry; the bytes are the app's own file (`src/infra/stock-sounds.ts`), never here, for the
// same reason an image annotation holds an id and not a picture.
//
// A name this build does not serve is refused — on the way in (`create`) and on the way back
// (`restore`) — exactly as a kind this build does not know is left out, so a clip or a sidecar
// written by a later version still opens with the rest intact.

import { Span } from '../clip/Span.js';
import { isStockSound } from '../sound/StockSounds.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type StoredAnnotation,
} from './Annotation.js';

export interface SoundGeometry {
  /** Which stock sound this is — the app's own file, resolved in `infra/`, never here. */
  readonly sound: string;
}

const name = (v: unknown): string => (typeof v === 'string' ? v : '');

export class SoundAnnotation extends Annotation {
  static readonly id = 'sound';

  private constructor(id: string, span: Span, readonly geometry: SoundGeometry) {
    super(id, span, SoundAnnotation.id);
  }

  /**
   * A new sound, over a span. Null unless it names a stock sound the app serves — a stray
   * name is not a sound.
   */
  static create(span: Span, sound: unknown, id: string = newAnnotationId()): SoundAnnotation | null {
    const wanted = name(sound);
    if (!isStockSound(wanted)) return null;
    return new SoundAnnotation(id, span, { sound: wanted });
  }

  /** Rebuild one from what was written down. Null for a name this build does not serve. */
  static restore(stored: StoredAnnotation): SoundAnnotation | null {
    const g = stored.geometry as Partial<SoundGeometry> | null | undefined;
    if (!g) return null;
    return SoundAnnotation.create(Span.of(stored.s, stored.e), g.sound, stored.id);
  }

  /** Is this worth keeping? A sound the app serves always is. */
  get isUsable(): boolean {
    return isStockSound(this.geometry.sound);
  }

  /** Nothing to drag: a sound is not drawn, so it has no shape on the picture. */
  handles(): readonly AnnotationHandle[] {
    return [];
  }

  /** Nothing to resize. */
  withHandle(): SoundAnnotation | null {
    return null;
  }

  /**
   * A move with nothing to move. It answers itself rather than refusing, so the shared
   * canvas's copy (which shifts a copy away from its original) places a sound unshifted
   * instead of losing it.
   */
  movedBy(): SoundAnnotation {
    return this;
  }

  withSpan(span: Span): SoundAnnotation {
    return new SoundAnnotation(this.id, span, this.geometry);
  }

  /** The same annotation playing another stock sound — what the preferences' `with` calls. */
  withSound(sound: unknown): SoundAnnotation | null {
    const wanted = name(sound);
    if (!isStockSound(wanted)) return null;
    return new SoundAnnotation(this.id, this.span, { sound: wanted });
  }

  /** A new sound, of the same sound, with its own identity — what a paste makes. */
  duplicated(span: Span): SoundAnnotation {
    return new SoundAnnotation(newAnnotationId(), span, this.geometry);
  }

  /** Never picked from the picture: a sound is heard, not pointed at. */
  hitTest(): boolean {
    return false;
  }

  stored(): StoredAnnotation {
    return {
      id: this.id,
      kind: this.kind,
      s: this.span.s,
      e: this.span.e,
      geometry: this.geometry,
    };
  }
}
