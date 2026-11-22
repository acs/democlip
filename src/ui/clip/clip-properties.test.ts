import { describe, expect, it } from 'vitest';

import { clipProperties, clipProperty, registerClipProperty, type ClipProperty } from './clip-properties.js';
import { ClipProperties } from '../../domain/clip/ClipProperties.js';

// The register, proved in node: the two the app offers, and that a new property needs
// no change to the panel or anywhere else — which is what the seam exists for.

describe('the clip property register', () => {
  it('offers the title and the description, in order', () => {
    expect(clipProperties().map(property => property.id)).toEqual(['title', 'description']);
    expect(clipProperty('title')?.label).toBe('Title');
    expect(clipProperty('description')?.control).toBe('long-text');
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
});
