// Which kinds this build knows, and how one is read back from what was written down.
//
// A kind is a subclass of `Annotation` — the arrow is `Arrow` — and it is named here
// so that a clip written down can be opened again: the id in the stored data is
// looked up, and the class rebuilds its own geometry. A kind this version does not
// know answers null, so a clip from a later version opens with those annotations
// left out rather than failing.
//
// Adding a kind is a class beside this one and a line in the register at the foot of
// the file; nothing that already exists is edited.

import type { Annotation, StoredAnnotation } from './Annotation.js';
import { Arrow } from './Arrow.js';
import { ImageAnnotation } from './ImageAnnotation.js';
import { Magnifier } from './Magnifier.js';
import { SoundAnnotation } from './SoundAnnotation.js';
import { TextAnnotation } from './TextAnnotation.js';

/** A kind is the class itself: its id, and how to rebuild one. */
export interface AnnotationKind {
  readonly id: string;
  restore(stored: StoredAnnotation): Annotation | null;
}

const kinds = new Map<string, AnnotationKind>();

/** Teach the family a kind. The same id again replaces it, which is what a test wants. */
export function registerKind(kind: AnnotationKind): void {
  kinds.set(kind.id, kind);
}

/** Rebuild an annotation, or null for a kind this version does not know. */
export function annotationFrom(stored: StoredAnnotation): Annotation | null {
  return kinds.get(stored.kind)?.restore(stored) ?? null;
}

/** Which kinds this build knows, for tests and for a picker. */
export function registeredKinds(): readonly string[] {
  return [...kinds.keys()];
}

// The arrow is the first kind, and registering it here is what makes it the first.
registerKind(Arrow);

// The image is the second kind, added by describing it alone.
registerKind(ImageAnnotation);

// The text is the third kind, added the same way.
registerKind(TextAnnotation);

// The sound is the fourth kind, added the same way — a kind with no shape.
registerKind(SoundAnnotation);

// The magnifier is the fifth kind, added the same way — a round lens with a zoom.
registerKind(Magnifier);
