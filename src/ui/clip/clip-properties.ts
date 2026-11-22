// The clip's own properties, declared for the app: what a clip says about itself —
// its title, its description — rather than what is drawn over its picture.
//
// This is the annotation seam one level up. There, a *kind* declares what can be
// changed about its annotations (`AnnotationPlugin.properties`); here the app declares
// what can be changed about the clip, because every clip has the same few. Each
// descriptor names a label, which shared control edits it, and how to read and write
// the value on the clip's own `ClipProperties` — so one panel edits them all without
// knowing which is which, and the automation surface offers the same list.
//
// It is free of the DOM, so the app's description of the clip (and a node test) can
// read it. The panel that draws it lives in `properties-panel.ts`.

import type { ClipProperties } from '../../domain/clip/ClipProperties.js';

/** Which shared control edits a clip property. */
export type ClipPropertyControl = 'text' | 'long-text' | 'toggle';

/**
 * Something about the clip the user can change after it is made. The app declares it;
 * the panel renders it from the `control` and applies it through the clip, so the
 * panel never learns which properties exist.
 */
export interface ClipProperty {
  /** 'title', 'description' — stable, and what the panel and the surface key on. */
  readonly id: string;
  /** What the control is called: 'Title', 'Description'. */
  readonly label: string;
  /** Which shared control renders it: one line, or a paragraph. */
  readonly control: ClipPropertyControl;
  /** The value the control shows for these properties. */
  value(properties: ClipProperties): string;
  /** The same properties with a new value; null when that value is not allowed. */
  with(properties: ClipProperties, value: string): ClipProperties | null;
}

const registry = new Map<string, ClipProperty>();

/** Teach the app a clip property. The same id again replaces it, which is what a test wants. */
export function registerClipProperty(property: ClipProperty): void {
  registry.set(property.id, property);
}

/** The clip properties this build offers, in the order they were registered. */
export function clipProperties(): readonly ClipProperty[] {
  return [...registry.values()];
}

/** One by id, or null for one this build does not offer. */
export function clipProperty(id: string): ClipProperty | null {
  return registry.get(id) ?? null;
}

// The title and the description, the first two. Both are free text — what a destination
// will take is the destination's own rule (`domain/youtube/VideoDetails.ts`), not the
// clip's — and a description is a paragraph where a title is a line.
registerClipProperty({
  id: 'title',
  label: 'Title',
  control: 'text',
  value: properties => properties.get('title'),
  with: (properties, value) => properties.with('title', value),
});

registerClipProperty({
  id: 'description',
  label: 'Description',
  control: 'long-text',
  value: properties => properties.get('description'),
  with: (properties, value) => properties.with('description', value),
});

// And the one switch: whether an export puts a title card — these two lines over the
// clip's first frame — at the head of the file. Off unless it is turned on.
registerClipProperty({
  id: 'addToExport',
  label: 'Add to export',
  control: 'toggle',
  value: properties => (properties.get('addToExport') === 'true' ? 'true' : ''),
  with: (properties, value) => properties.with('addToExport', value === 'true' ? 'true' : ''),
});
