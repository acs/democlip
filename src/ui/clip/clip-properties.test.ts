import { describe, expect, it } from 'vitest';

import { clipProperties, clipProperty, registerClipProperty, seedableClipProperties, type ClipProperty } from './clip-properties.js';
import { ClipProperties } from '../../domain/clip/ClipProperties.js';

// The register, proved in node: the two the app offers, and that a new property needs
// no change to the panel or anywhere else — which is what the seam exists for.

describe('the clip property register', () => {
  it('offers the title, the description, the switch, the logo and the size, in order', () => {
    expect(clipProperties().map(property => property.id)).toEqual(['title', 'description', 'addToExport', 'logo', 'size']);
    expect(clipProperty('title')?.label).toBe('Title');
    expect(clipProperty('description')?.control).toBe('long-text');
    expect(clipProperty('addToExport')?.control).toBe('toggle');
    expect(clipProperty('size')?.readOnly).toBe(true);
  });

  it('answers null for a property this build does not offer', () => {
    expect(clipProperty('subtitle')).toBeNull();
  });

  it('reads and writes the value on the clip\'s own properties', () => {
    const title = clipProperty('title')!;
    const properties = ClipProperties.EMPTY;
    expect(title.value(properties)).toBe('');
    const next = title.with(properties, 'A demo')!;
    expect(title.value(next)).toBe('A demo');
  });

  it('takes a new property, and it is listed beside the two without either changing', () => {
    const before = clipProperty('title')?.label;
    const subtitle: ClipProperty = {
      id: 'subtitle',
      label: 'Subtitle',
      control: 'text',
      value: properties => properties.get('subtitle'),
      with: (properties, value) => properties.with('subtitle', value),
    };
    registerClipProperty(subtitle);
    expect(clipProperty('subtitle')?.id).toBe('subtitle');
    expect(clipProperties().map(property => property.id)).toContain('subtitle');
    expect(clipProperty('title')?.label).toBe(before);
  });

  it('keeps the switch as "true" or nothing, whatever it is handed', () => {
    const addToExport = clipProperty('addToExport')!;
    expect(addToExport.value(ClipProperties.EMPTY)).toBe('');
    const on = addToExport.with(ClipProperties.EMPTY, 'true')!;
    expect(addToExport.value(on)).toBe('true');
    expect(addToExport.value(addToExport.with(on, 'false')!)).toBe('');
    expect(addToExport.value(addToExport.with(on, 'no')!)).toBe('');
  });

  it('offers the clip size as a value the person does not set', () => {
    const size = clipProperty('size')!;
    expect(size.readOnly).toBe(true);
    // Nothing to write: the size follows the takes, so the property refuses any value.
    expect(size.with(ClipProperties.EMPTY, '1920x1080')).toBeNull();
    // And with no clip handed in there is no derived size to show.
    expect(size.value(ClipProperties.EMPTY)).toBe('');
  });

  it('marks the switch and the logo as what a profile may control', () => {
    // What a profile may declare in this iteration; the title, the description and the
    // read-only size are never a profile's.
    expect(seedableClipProperties().map(property => property.id)).toEqual(['addToExport', 'logo']);
  });

  it('takes the name of a logo the app ships, and nothing else, or nothing at all', () => {
    const logo = clipProperty('logo')!;
    expect(logo.control).toBe('text');
    expect(logo.value(ClipProperties.EMPTY)).toBe('');

    const worn = logo.with(ClipProperties.EMPTY, 'democlip')!;
    expect(logo.value(worn)).toBe('democlip');
    // A clip with no logo is the ordinary case, and an empty value clears it.
    expect(logo.value(logo.with(worn, '')!)).toBe('');
    // A name the app does not ship is refused rather than kept: a typo must not leave an
    // export waiting for a file that will never draw.
    expect(logo.with(ClipProperties.EMPTY, 'nope')).toBeNull();
    // Surrounding space is the person's typing, not part of the name.
    expect(logo.value(logo.with(ClipProperties.EMPTY, '  democlip  ')!)).toBe('democlip');
  });
});
