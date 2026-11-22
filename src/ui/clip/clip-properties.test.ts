import { describe, expect, it } from 'vitest';

import { clipProperties, clipProperty, registerClipProperty, type ClipProperty } from './clip-properties.js';
import { ClipProperties } from '../../domain/clip/ClipProperties.js';

// The register, proved in node: the two the app offers, and that a new property needs
// no change to the panel or anywhere else — which is what the seam exists for.

describe('the clip property register', () => {
  it('offers the title, the description, the switch and the size, in order', () => {
    expect(clipProperties().map(property => property.id)).toEqual(['title', 'description', 'addToExport', 'size']);
    expect(clipProperty('title')?.label).toBe('Title');
    expect(clipProperty('description')?.control).toBe('long-text');
    expect(clipProperty('addToExport')?.control).toBe('toggle');
    expect(clipProperty('size')?.control).toBe('size');
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

  it('writes the clip size as a canonical even pair, and refuses what it cannot', () => {
    const size = clipProperty('size')!;
    expect(size.with(ClipProperties.EMPTY, '1920x1080')?.get('size')).toBe('1920x1080');
    expect(size.with(ClipProperties.EMPTY, '985x611')?.get('size')).toBe('986x612');
    expect(size.with(ClipProperties.EMPTY, ' 800 x 600 ')?.get('size')).toBe('800x600');
    expect(size.with(ClipProperties.EMPTY, '')).toBeNull();
    expect(size.with(ClipProperties.EMPTY, 'wide')).toBeNull();
    expect(size.with(ClipProperties.EMPTY, '0x1080')).toBeNull();
  });

  it('shows the size the clip is written at — the set one, or none', () => {
    const size = clipProperty('size')!;
    expect(size.value(ClipProperties.EMPTY)).toBe('');
    const set = size.with(ClipProperties.EMPTY, '1280x720')!;
    expect(size.value(set)).toBe('1280x720');
  });
});
