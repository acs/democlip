// The names the app's own declarations carry, resolved through the catalogue.
//
// A kind's name, an annotation property's name, a colour's name and a stock sound's name
// are declared where the thing is (the plugin, the palette, the sound list) in the words the
// app already used. Where one is drawn for a person, it is resolved here, so the view shows
// the person's language while the declaration keeps the stable English name an agent is told.
//
// A declaration's own label is the fallback: an id this build does not know, or one a test
// registers, reads as its declaration rather than as a raw key.

import { t, type TranslationKey } from './index.js';

const KINDS = new Set(['arrow', 'image', 'text', 'magnifier', 'sound']);
const PROPERTIES = new Set(['colour', 'zoom', 'sound', 'words', 'duration']);
const CLIP_PROPERTIES = new Set([
  'title', 'description', 'logo', 'addToExport', 'annotationColour', 'soundBoost', 'size', 'exportResolution',
]);

const COLOUR_KEYS: Readonly<Record<string, TranslationKey>> = {
  '#e53e3e': 'colour.red',
  '#ff6c23': 'colour.orange',
  '#ffffff': 'colour.white',
  '#f6e05e': 'colour.yellow',
  '#38a169': 'colour.green',
  '#3182ce': 'colour.blue',
  '#111827': 'colour.black',
};

const SOUND_KEYS: Readonly<Record<string, TranslationKey>> = {
  chime: 'sound.chime',
  gong: 'sound.gong',
  pluck: 'sound.pluck',
  riser: 'sound.riser',
  thud: 'sound.thud',
  whoosh: 'sound.whoosh',
  wow: 'sound.wow',
};

/** A kind's name, in the person's language, or its own label for one this build does not name. */
export function kindLabel(id: string, fallback: string): string {
  return KINDS.has(id) ? t(`annotation.kind.${id}` as TranslationKey) : fallback;
}

/** A kind's tooltip, in the person's language, or its own title for one this build does not name. */
export function kindTitle(id: string, fallback: string): string {
  return KINDS.has(id) ? t(`annotation.kind.${id}.title` as TranslationKey) : fallback;
}

/** An annotation property's name, in the person's language. */
export function propertyLabel(id: string, fallback: string): string {
  return PROPERTIES.has(id) ? t(`annotation.property.${id}` as TranslationKey) : fallback;
}

/** A palette colour's name, in the person's language, or its hex for one not in the palette. */
export function colourLabel(colour: string): string {
  const key = COLOUR_KEYS[colour];
  return key ? t(key) : colour;
}

/** A stock sound's name, in the person's language, or the sound's own label for one not served. */
export function soundLabel(name: string, fallback: string): string {
  const key = SOUND_KEYS[name];
  return key ? t(key) : fallback;
}

/** A clip property's name, in the person's language. */
export function clipPropertyLabel(id: string, fallback: string): string {
  return CLIP_PROPERTIES.has(id) ? t(`clip.property.${id}` as TranslationKey) : fallback;
}

/**
 * What one of a clip property's listed values is called, in the person's language: a colour,
 * a logo's name, an export level, or the plain `None` / `Clip size`.
 */
export function clipChoiceLabel(propertyId: string, value: string, fallback: string): string {
  if (propertyId === 'annotationColour') return colourLabel(value);
  if (propertyId === 'logo') return value === '' ? t('clip.choice.none') : t(`logo.${value}` as TranslationKey);
  if (propertyId === 'exportResolution') {
    return value === '' ? t('clip.choice.clipSize') : t(`export.level.${value}` as TranslationKey);
  }
  return fallback;
}
