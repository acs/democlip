// The seam a kind is described through in the view: its action, its renderer, and how
// a new one is made.
//
// The class in `domain/annotation/` says what shape a kind is and the rules for that
// shape — how it is normalised, whether it is worth keeping, how it moves, resizes and
// is hit. This says what the kind is in *the browser*: which button adds it to a
// selected stretch, how it is drawn, and what a press-and-drag (or a chosen picture)
// makes. Everything the spec calls shared — selecting, moving, resizing, copying,
// deleting, undoing, saving, exporting — belongs to the annotation canvas and the
// clip, so a kind never describes any of it and gets all of it by existing.
//
// A plugin is registered under the same id as the domain class, so the id is the whole
// of the coupling — exactly as the renderer registry is. Adding a kind is a class, a
// line in the register in `domain/annotation/kinds.ts`, and a plugin here.
//
// It also says what can be changed about the kind after it is placed — its properties —
// so one shared inspector can edit them without knowing the kind. A kind with none gets
// no settings control and no panel.

import type { Annotation, Point } from '../../domain/annotation/Annotation.js';
import type { AnnotationColour } from '../../domain/annotation/AnnotationColour.js';
import type { Span } from '../../domain/clip/Span.js';
import type { Clip } from '../../domain/clip/Clip.js';
import type { AnnotationRenderer } from './annotation-layer.js';
import { durationProperty } from './duration-property.js';

/** The button a kind adds to the section's actions. */
export interface AnnotationAction {
  /** What the button says, and what the kind is called in a message: 'Arrow', 'Image'. */
  readonly label: string;
  /** Its tooltip. */
  readonly title: string;
  /** Its inline svg, dropped into the section's action row. */
  readonly icon: string;
}

/**
 * What a kind may ask of the canvas while a new one is being made. The canvas owns the
 * pointer plumbing; the kind owns what the gesture *means*, through the `build` it
 * hands `drag` — so the arrow's "drag a line" and the image's "choose a picture" both
 * fit without the canvas learning either.
 */
export interface CreationContext {
  /** The stretch the annotation will be shown over — the selected section. */
  readonly span: Span;
  /** The picture being drawn on, in its own pixels. */
  readonly picture: { readonly w: number; readonly h: number };
  /**
   * The colour a new annotation is made in — the clip's own annotation colour, so the kind
   * does not choose one and an arrow and a text start in the same colour.
   */
  readonly colour: AnnotationColour;
  /**
   * Ask for a drag across the picture. Resolves with where it started and ended, or
   * null when there was no drag worth having (a stray click, a cancelled gesture).
   * `build` is called on every move to show the draft.
   */
  drag(
    build: (from: Point, to: Point) => Annotation | null,
    minLengthPx?: number,
  ): Promise<{ from: Point; to: Point } | null>;
  /** Show this as the draft while it is being made, or clear it with null. */
  draft(annotation: Annotation | null): void;
  /** It is made: the clip takes it, and it is put in hand. */
  commit(annotation: Annotation): void;
  /**
   * Nothing to make this time, but stay armed — the arrow's stray click, where the next
   * try is another drag on the same section.
   */
  abandon(message: string): void;
  /**
   * Nothing to make, and the creation is over: let the canvas go, so the next press is
   * a press that edits the picture rather than one nothing answers.
   */
  cancel(message: string): void;
  /** Say something under the timeline while the kind is busy. */
  say(message: string): void;
}

/** Which shared control edits a property. */
export type PropertyControl = 'colour' | 'text' | 'duration' | 'sound';

/**
 * Something about an annotation the user can change after it is placed. Its kind
 * declares it; the shared inspector renders it from the `control` and applies it through
 * the clip, so the inspector never learns which kinds have which properties.
 */
export interface AnnotationProperty {
  /** 'colour', 'words' — stable, and what the panel keys on. */
  readonly id: string;
  /** What the control is called: 'Colour', 'Words'. */
  readonly label: string;
  /** Which shared control renders it. */
  readonly control: PropertyControl;
  /** The value the control shows for this annotation. */
  value(annotation: Annotation): string;
  /** The same annotation with a new value; null when that value is not allowed. */
  with(annotation: Annotation, value: string): Annotation | null;
}

/** One kind, as the editing canvas sees it. */
export interface AnnotationPlugin {
  /** The kind's id — the same one the domain class and the register use. */
  readonly id: string;
  /** The button the section offers for this kind. */
  readonly action: AnnotationAction;
  /** How it is drawn, in the picture's own proportions. */
  readonly renderer: AnnotationRenderer<Annotation>;
  /** What can be changed after it is placed. A kind with none gets no settings control. */
  readonly properties?: readonly AnnotationProperty[];
  /**
   * Does making one of these need a picture to draw on? True for every drawn kind, so the
   * annotate options offer it only where there is a picture; a kind with nothing to draw —
   * the **sound** — says false, and is offered on a clip with no picture too.
   */
  readonly needsPicture?: boolean;
  /** Begin making one over the selected stretch. */
  begin(ctx: CreationContext): void;
}

const registry = new Map<string, AnnotationPlugin>();

/** Teach the view a kind. The same id again replaces it, which is what a test wants. */
export function registerPlugin(plugin: AnnotationPlugin): void {
  registry.set(plugin.id, plugin);
}

/** The plugin for a kind, or null for one this build does not offer. */
export function pluginOf(id: string): AnnotationPlugin | null {
  return registry.get(id) ?? null;
}

/** Which kinds the section offers an action for, in the order they were registered. */
export function plugins(): readonly AnnotationPlugin[] {
  return [...registry.values()];
}

/** The properties a kind offers for this annotation — none for no annotation or a kind without. */
export function propertiesOf(annotation: Annotation | null): readonly AnnotationProperty[] {
  return annotation ? (pluginOf(annotation.kind)?.properties ?? []) : [];
}

/**
 * The properties of this annotation: its kind's own, plus the one shared **duration**
 * — except for the clip's **watermark**, which spans the whole clip by construction and
 * takes no duration. A caller that wants to edit what a person can edit asks this; a
 * caller that wants only what a kind declares asks `propertiesOf`.
 */
export function propertiesFor(annotation: Annotation, clip: Clip): readonly AnnotationProperty[] {
  const own = propertiesOf(annotation);
  const isWatermark = clip.watermarks().some(water => water.id === annotation.id);
  return isWatermark ? own : [...own, durationProperty(clip)];
}
