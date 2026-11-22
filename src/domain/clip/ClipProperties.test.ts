import { describe, expect, it } from 'vitest';

import { ClipProperties } from './ClipProperties.js';

// The value object: what a clip says about itself. No browser, no clip — the rules
// about empty values and about reading back a record are the whole of it.

describe('ClipProperties', () => {
  it('holds nothing until something is set, and answers an empty string for that', () => {
    expect(ClipProperties.EMPTY.get('title')).toBe('');
    expect(ClipProperties.EMPTY.toRecord()).toEqual({});
  });

  it('sets one and reads it back, keeping the others', () => {
    const props = ClipProperties.EMPTY.with('title', 'A demo').with('description', 'What it shows');
    expect(props.get('title')).toBe('A demo');
    expect(props.get('description')).toBe('What it shows');
    expect(props.toRecord()).toEqual({ title: 'A demo', description: 'What it shows' });
  });

  it('is a value: setting one gives a new one, and leaves the old alone', () => {
    const before = ClipProperties.EMPTY.with('title', 'A demo');
    const after = before.with('title', 'Another');
    expect(before.get('title')).toBe('A demo');
    expect(after.get('title')).toBe('Another');
  });

  it('clears a property set to nothing, so unset has one shape', () => {
    const props = ClipProperties.EMPTY.with('title', 'A demo').with('title', '');
    expect(props.get('title')).toBe('');
    expect(props.toRecord()).toEqual({});
  });

  it('reads back a written record, dropping what is not a named string', () => {
    const props = ClipProperties.of({
      title: 'A demo',
      description: '',
      // A record from elsewhere: a number, a nested thing and an unnamed one are not ours.
      ...({ width: 12, geometry: { x: 1 }, '': 'nameless' } as Record<string, unknown>),
    } as Record<string, string>);
    expect(props.toRecord()).toEqual({ title: 'A demo' });
  });

  it('reads nothing back from nothing, or from what is not a record', () => {
    expect(ClipProperties.of().toRecord()).toEqual({});
    expect(ClipProperties.of(null).toRecord()).toEqual({});
    expect(ClipProperties.of({})).toBe(ClipProperties.EMPTY);
  });
});
