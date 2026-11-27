// The colours an annotation may be drawn in.
//
// One flat colour per annotation, chosen from a small fixed set: every entry is one
// the kinds' outlines keep legible over a light or a dark picture, which a free-form
// picker could not promise. The rule — which values are colours, and what an unknown
// one becomes — lives here once, so a kind carries a colour without copying the list
// or the check.
//
// Each kind picks its own fallback for what was written before colours existed: an
// arrow that arrives with no colour is the arrow's red, a text's is white. That is what
// makes a clip written before this change paint exactly as it did — and it is **not**
// what a *new* annotation is made in. A new one takes the clip's **annotation colour**
// (`ui/clip/clip-properties.ts`), which is `DEFAULT_ANNOTATION_COLOUR` until the clip
// or a profile says otherwise.

export const COLOURS = ['#e53e3e', '#ff6c23', '#ffffff', '#f6e05e', '#38a169', '#3182ce', '#111827'] as const;

export type AnnotationColour = (typeof COLOURS)[number];

/** The colour a new annotation is made in when the clip has none of its own — the app's red. */
export const DEFAULT_ANNOTATION_COLOUR: AnnotationColour = '#e53e3e';

const KNOWN: ReadonlySet<string> = new Set(COLOURS);

/** Is this one of the colours an annotation may be drawn in? */
export function isColour(value: unknown): value is AnnotationColour {
  return typeof value === 'string' && KNOWN.has(value);
}

/** The colour `value` means, or the fallback when it is not one of ours. */
export function colourOf(value: unknown, fallback: AnnotationColour): AnnotationColour {
  return isColour(value) ? value : fallback;
}