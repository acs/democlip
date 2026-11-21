// The annotations a file carries, written beside it.
//
// A clip can leave the app as a file, be worked on outside it, and come back — and the
// annotations are the one part of the clip a video file can hold only as pixels. So an
// export can write them down beside the file instead of drawing them in, and an import
// reads them back and takes them on.
//
// They are fractions of a clip, so the sidecar names the length they are fractions of.
// A re-encode drifts by a frame and the fractions still land; a file of quite another
// length is another clip, where the same fractions would point at other moments — so a
// sidecar is taken only while the lengths agree. A kind this version does not know is
// left out, as it is when a clip is read back from the store, so a sidecar written by a
// later version still opens.
//
// An image annotation draws a picture, and a picture is bytes rather than numbers, so a
// sidecar carries those too — under the id the annotation names, ready for the image
// store to take back. How any of this is written as a file (`src/infra`) is the file
// format's business; what is here is what a sidecar is.

import { AnnotationSet } from '../annotation/AnnotationSet.js';
import { annotationFrom } from '../annotation/kinds.js';
import type { Annotation, StoredAnnotation } from '../annotation/Annotation.js';

/** A picture an annotation draws, as it is kept: the bytes, under the id the annotation names. */
export interface SidecarPicture {
  readonly id: string;
  readonly blob: Blob;
}

export class AnnotationSidecar {
  /**
   * How far a file's length may drift from the one written down and the fractions still
   * mean the same moments: a frame or two, and the export's own margin off the end. The
   * floor keeps a very short clip from being refused over a single frame.
   */
  private static readonly DRIFT = 0.02;
  private static readonly DRIFT_FLOOR_S = 0.25;

  private constructor(
    readonly length: number,
    readonly stored: readonly StoredAnnotation[],
    readonly pictures: readonly SidecarPicture[],
  ) {}

  /** A clip's annotations, and the pictures they draw, written down for a file of this length. */
  static of(
    length: number,
    stored: readonly StoredAnnotation[],
    pictures: readonly SidecarPicture[] = [],
  ): AnnotationSidecar {
    return new AnnotationSidecar(length, stored, pictures);
  }

  /**
   * The annotations as they apply to a file of this length, or null while they cannot:
   * a sidecar written for a file of another length belongs to another clip.
   */
  forLength(seconds: number): AnnotationSet | null {
    const drift = Math.max(AnnotationSidecar.DRIFT_FLOOR_S, this.length * AnnotationSidecar.DRIFT);
    if (!(seconds > 0) || Math.abs(seconds - this.length) > drift) return null;
    return AnnotationSet.of(
      this.stored
        .map(stored => annotationFrom(stored))
        .filter((annotation): annotation is Annotation => annotation !== null),
    );
  }
}
