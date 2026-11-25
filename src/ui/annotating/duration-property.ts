// The one shared **duration** property: how long an annotation is shown, as a value.
//
// Every hand-placed annotation has it, whatever its kind — the arrow, the picture, the line
// of text — so it is one descriptor built here rather than a property each kind declares.
// The value is an annotation's own span read in seconds of the clip; setting it is the
// rule on `Annotation.withDuration`, so announcing, the one undo and keeping it are the
// clip's and not this module's.
//
// It is the clip's own that which annotations are its **watermark** — those span the whole
// clip and take no duration — so the caller asks `propertiesFor`, which leaves it out for
// them; this descriptor is offered only for an annotation placed by hand.

import type { Clip } from '../../domain/clip/Clip.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import type { AnnotationProperty } from './annotation-plugin.js';

/** How much one press of − or + changes a duration, in seconds. */
export const DURATION_STEP_S = 0.1;

/** The shared duration property, over the clip's own length. */
export function durationProperty(clip: Clip): AnnotationProperty {
  return {
    id: 'duration',
    label: 'Duration',
    control: 'duration',
    value: (annotation: Annotation) => (annotation.span.length * clip.total()).toFixed(2),
    with: (annotation: Annotation, value: string) => {
      const seconds = Number(value);
      if (!Number.isFinite(seconds)) return null;
      return annotation.withDuration(seconds, clip.total());
    },
  };
}
