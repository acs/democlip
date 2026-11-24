import { describe, expect, it } from 'vitest';

import { COLOURS, COLOUR_LABELS, DEFAULT_ANNOTATION_COLOUR, colourOf, isColour } from './AnnotationColour.js';

describe('the annotation colour', () => {
  it('names every colour a person may pick, and the one a new annotation is made in', () => {
    for (const colour of COLOURS) expect(COLOUR_LABELS[colour]).toMatch(/\S/);
    expect(DEFAULT_ANNOTATION_COLOUR).toBe('#e53e3e');
    expect(isColour(DEFAULT_ANNOTATION_COLOUR)).toBe(true);
  });
  it('takes every colour the palette holds', () => {
    for (const colour of COLOURS) expect(colourOf(colour, COLOURS[0])).toBe(colour);
  });

  it('answers the fallback for anything that is not one of ours', () => {
    const junk: unknown[] = [undefined, null, '', 'red', '#123456', '#e53e3e00', 42, {}, [], true];
    for (const value of junk) expect(colourOf(value, '#ffffff')).toBe('#ffffff');
  });

  it('is not fooled by a near miss', () => {
    expect(colourOf('#E53E3E', '#ffffff')).toBe('#ffffff');   // case matters
    expect(colourOf(' #e53e3e', '#ffffff')).toBe('#ffffff');  // and so does the exact string
  });

  it('answers the fallback the kind gave it, not one of its own', () => {
    expect(colourOf('nonsense', '#111827')).toBe('#111827');
    expect(colourOf('nonsense', '#e53e3e')).toBe('#e53e3e');
  });

  // The predicate the kinds use to *refuse* a value rather than fall back to the
  // default: a caller asking for a colour that is not ours is told so, which is what
  // lets a property change from outside the app be refused rather than quietly
  // turned into the arrow's red.
  it('says which values are colours, and which are not', () => {
    for (const colour of COLOURS) expect(isColour(colour)).toBe(true);
    for (const value of [undefined, null, '', 'red', '#E53E3E', 42, {}, [], true]) {
      expect(isColour(value)).toBe(false);
    }
  });
});