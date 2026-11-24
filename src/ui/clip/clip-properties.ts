// The clip's own properties, declared for the app: its title and its description, the mark
// it wears, and the colour a new annotation is made in — the few things a person may change
// about a clip without touching its picture.
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
import type { Clip } from '../../domain/clip/Clip.js';
import {
  COLOURS, COLOUR_LABELS, DEFAULT_ANNOTATION_COLOUR, colourOf, isColour,
  type AnnotationColour,
} from '../../domain/annotation/AnnotationColour.js';
import { LOGOS, logoFile } from '../logos.js';

/** Which shared control edits a clip property. */
export type ClipPropertyControl = 'text' | 'long-text' | 'toggle' | 'choice' | 'colour';

/** One of the values a property whose control is a list offers. */
export interface PropertyChoice {
  /** What the clip holds when it is chosen. */
  readonly value: string;
  /** What the choice is called where a person reads it. */
  readonly label: string;
}

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
  /** Which shared control renders it: one line, a paragraph, a switch, a list, or the palette. */
  readonly control: ClipPropertyControl;
  /**
   * The values a **list** or **colour** control offers, in order, and nothing for any other kind.
   * The panel, a profile's sheet and the automation surface all draw or read them without naming
   * the property they belong to.
   */
  readonly choices?: readonly PropertyChoice[];
  /**
   * True for a property the app shows but the person does not set — the **clip size**,
   * which is derived from the takes. The panel draws its value and offers no control,
   * and the automation surface refuses to set it.
   */
  readonly readOnly?: boolean;
  /**
   * Why the control cannot be moved now, or null when it can. Absent for every property
   * that is always the person's to move. Only **add to export** has one: the switch asks
   * for a **title card**, and a card with nothing to draw is not worth asking for, so it
   * waits for a title, a description or a logo. The panel draws its control disabled; the
   * automation surface refuses it with the same words.
   */
  blocked?(properties: ClipProperties, clip?: Clip): string | null;
  /**
   * True for a property a **profile** may preload onto a new clip — **add to export**,
   * **logo** and **annotation colour**. A profile carries settings keyed by property id,
   * and only the seedable ones are ever applied, so flagging one here is the whole of
   * teaching a profile to carry it.
   */
  readonly seedable?: boolean;
  /**
   * The value the control shows for these properties. The clip is handed in for a
   * property whose value it derives rather than stores — the clip size — so the panel
   * and the agent surface show the size the clip is shown and exported at.
   */
  value(properties: ClipProperties, clip?: Clip): string;
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

/**
 * The properties a **profile** may carry — the seedable ones, in the same order. Seeding
 * walks this list and nothing else, so a stored setting for a property this build does
 * not preload is ignored rather than applied.
 */
export function seedableClipProperties(): readonly ClipProperty[] {
  return clipProperties().filter(property => property.seedable === true);
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

// And the mark a clip wears at the head of its export: one of the logos the app ships
// (`ui/logos.ts`), or **None** at all — which is the ordinary case. It is a *list*, not a field:
// the app knows which marks it serves, so a person chooses one rather than typing a name that
// might not be there. The property still refuses a name it does not serve, because a value can
// also arrive from a profile written elsewhere. And a **profile** may fix it, so every clip made
// under that profile opens with the same mark.
registerClipProperty({
  id: 'logo',
  label: 'Logo',
  control: 'choice',
  seedable: true,
  choices: [
    { value: '', label: 'None' },
    ...LOGOS.map(logo => ({ value: logo.name, label: logo.label })),
  ],
  value: properties => properties.get('logo'),
  with: (properties, value) => {
    const name = value.trim();
    if (name !== '' && !logoFile(name)) return null;
    return properties.with('logo', name);
  },
});

// And the one switch: whether an export puts a title card — the clip's logo, title and
// description over its first frame — at the head of the file. Off unless it is turned on. It
// sits below the three things the card draws, because it is their switch: with nothing to put
// on the card there is nothing to switch on, so it is offered only once the clip has a title, a
// description or a logo (`blocked`). It is one of the two properties a **profile** may preload
// (`seedable`), so a clip made under DemoClipTV opens its export with the card without the
// switch being pressed.
registerClipProperty({
  id: 'addToExport',
  label: 'Add to export',
  control: 'toggle',
  seedable: true,
  value: properties => (properties.get('addToExport') === 'true' ? 'true' : ''),
  with: (properties, value) => properties.with('addToExport', value === 'true' ? 'true' : ''),
  // A switch already **on** stays movable: the person may always take the card back off, even
  // after clearing the last word from it. It is only switching it *on* that needs something to
  // switch on. A **sound-only** clip has no picture for the card to be drawn on, so the
  // switch says why it cannot apply rather than accepting a request the file cannot honour.
  blocked: (properties, clip) => {
    if (clip && clip.takes.count() > 0 && !clip.hasPicture()) {
      return 'A sound-only clip has no picture for the card — record a take with a picture, or export the sound';
    }
    return hasCardContent(properties) || properties.get('addToExport') === 'true'
      ? null
      : 'Add to export needs something to put on the card — a title, a description or a logo';
  },
});

/** Whether the clip has anything for a **title card** to draw: a title, a description or a logo. */
function hasCardContent(properties: ClipProperties): boolean {
  return properties.get('title') !== '' || properties.get('description') !== '' || properties.get('logo') !== '';
}

/**
 * The colour a **new annotation** is made in: the clip's own annotation colour, or the
 * app's red when it holds none. The creation canvas and the agent's maker both ask this,
 * so an arrow a person draws and one an agent places land in the same colour.
 */
export function annotationColour(properties: ClipProperties): AnnotationColour {
  return colourOf(properties.get('annotationColour'), DEFAULT_ANNOTATION_COLOUR);
}

// And the colour every new arrow and text is made in — the palette itself, because a free-form
// picker could not promise a colour that reads over any picture. It is the clip's own answer, and
// a **profile** may fix it, so every annotation made under that profile starts in its colour.
// Changing it recolours nothing already placed: an annotation carries the colour it was made in,
// and its own settings change that one.
registerClipProperty({
  id: 'annotationColour',
  label: 'Annotation colour',
  control: 'colour',
  seedable: true,
  choices: COLOURS.map(colour => ({ value: colour, label: COLOUR_LABELS[colour] })),
  value: annotationColour,
  with: (properties, value) => (isColour(value) ? properties.with('annotationColour', value) : null),
});

// And the clip's own size: the picture the review shows and every export writes — the
// largest width and height among the takes, both even. It is **shown, not set**: the size
// follows the takes, so a person cannot hold a clip to a shape its own takes do not have.
// The panel draws the value and offers no control, and the automation surface refuses to
// change it (`ClipProperty.readOnly`).
registerClipProperty({
  id: 'size',
  label: 'Clip size',
  control: 'text',
  readOnly: true,
  value: (_properties, clip) => clip?.size()?.toString() ?? '',
  with: () => null,
});
