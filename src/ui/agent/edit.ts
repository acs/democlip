// The surface's editing operations.
//
// Every one is the app's own: a cut is the clip's own approve, an annotation goes in
// through the clip, a property change goes through the kind's own descriptor — or, for
// the clip's own properties, the clip register's — and the undo is the clip's one undo.
// There is no second implementation of any rule, so a change an agent makes is announced
// to the views, taken back by the one undo, and kept with the clip — exactly as a
// person's change is.
//
// A refusal is a **value**, not a throw: the app's answer, with a reason, and the clip
// left alone.
//
// Making an annotation is the one operation that may have to wait: an image is decoded
// and its picture kept before the clip can take it. A maker answers with a promise when
// it needs the browser, and the clip takes the annotation only once there is one.

import { Span } from '../../domain/clip/Span.js';
import type { Clip } from '../../domain/clip/Clip.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { pluginOf, propertiesOf } from '../annotating/annotation-plugin.js';
import { clipProperty } from '../clip/clip-properties.js';
import { MIN_SECTION } from '../cutting/selection.js';
import type { Controlling } from '../profile/control.js';
import type { AnnotationParams, Result } from './surface.js';

/** What a kind's maker answered: the annotation, or why it would not make one. */
export type Made = { readonly annotation: Annotation } | { readonly reason: string };

/**
 * Make a new annotation of a kind from data alone. The kinds whose shape *is* data
 * are here; a kind that needs something from outside the clip is not, and says so. A
 * maker that has to read a picture first answers with a promise.
 */
export type MakeAnnotation = (kind: string, params: AnnotationParams, span: Span) => Made | Promise<Made>;

export interface Editor {
  cut(from: number, to: number): Result<{ removed: number }>;
  annotate(kind: string, params: AnnotationParams): Promise<Result<{ id: string }>>;
  setProperty(id: string, property: string, value: string): Result<{ value: string }>;
  setClipProperty(property: string, value: string): Result<{ value: string }>;
  remove(id: string): Result<{ kind: string }>;
  undo(): Result<{ change: string }>;
}

export function createEditor(clip: Clip, make: MakeAnnotation, controlling: Controlling = () => null): Editor {
  return {
    cut(from, to) {
      const span = Span.between(from, to, MIN_SECTION);
      if (!span) {
        return { ok: false, reason: `a cut has to be at least ${MIN_SECTION} of the clip, and inside it` };
      }
      return { ok: true, removed: clip.approve(span) };
    },

    async annotate(kind, params) {
      if (!pluginOf(kind)) return { ok: false, reason: `the app has no annotation kind called ${kind}` };
      const span = spanIn(params);
      if (!span) {
        return { ok: false, reason: `an annotation needs a stretch of the clip to be shown over, at least ${MIN_SECTION} long` };
      }
      const made = await make(kind, params, span);
      if ('reason' in made) return { ok: false, reason: made.reason };
      clip.addAnnotation(made.annotation);
      return { ok: true, id: made.annotation.id };
    },

    setProperty(id, property, value) {
      const annotation = clip.annotations.byId(id);
      if (!annotation) return { ok: false, reason: `there is no annotation with id ${id}` };
      const descriptor = propertiesOf(annotation).find(candidate => candidate.id === property);
      if (!descriptor) return { ok: false, reason: `a ${annotation.kind} has no property called ${property}` };
      if (typeof value !== 'string') return { ok: false, reason: 'a property value is a string' };
      const next = descriptor.with(annotation, value);
      if (!next) return { ok: false, reason: `${property} will not take ${JSON.stringify(value)}` };
      clip.changeAnnotation(id, next);
      return { ok: true, value: descriptor.value(next) };
    },

    setClipProperty(property, value) {
      const descriptor = clipProperty(property);
      if (!descriptor) return { ok: false, reason: `a clip has no property called ${property}` };
      if (descriptor.readOnly) return { ok: false, reason: `the ${descriptor.label.toLowerCase()} is not the person's to set` };
      // A property a **profile** fixes is not the person's to change, and not an agent's
      // either — the same answer the properties panel gives, asked in the same place.
      const fixedBy = controlling(property);
      if (fixedBy) return { ok: false, reason: `${fixedBy} fixes ${descriptor.label.toLowerCase()}, so it is not the person's to set` };
      // A property the clip cannot offer yet — the switch to add the card with nothing to put
      // on it — is refused with the property's own words, the same reason the panel draws it
      // disabled for.
      const blocked = descriptor.blocked?.(clip.properties, clip) ?? null;
      if (blocked) return { ok: false, reason: blocked };
      if (typeof value !== 'string') return { ok: false, reason: 'a property value is a string' };
      const next = descriptor.with(clip.properties, value);
      if (!next) return { ok: false, reason: `${property} will not take ${JSON.stringify(value)}` };
      clip.setProperty(property, next.get(property));
      return { ok: true, value: next.get(property) };
    },

    remove(id) {
      const annotation = clip.annotations.byId(id);
      if (!annotation) return { ok: false, reason: `there is no annotation with id ${id}` };
      clip.removeAnnotation(id);
      return { ok: true, kind: annotation.kind };
    },

    undo() {
      const change = clip.undo();
      if (!change) return { ok: false, reason: 'there is nothing to undo' };
      return { ok: true, change: change.type };
    },
  };
}

/** The stretch an annotation is shown over: `params.span`, as `{ s, e }` fractions. */
function spanIn(params: AnnotationParams): Span | null {
  const value = params.span;
  if (!value || typeof value !== 'object') return null;
  const { s, e } = value as { s?: unknown; e?: unknown };
  if (typeof s !== 'number' || typeof e !== 'number') return null;
  return Span.between(s, e, MIN_SECTION);
}
