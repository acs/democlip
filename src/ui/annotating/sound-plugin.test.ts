import { describe, expect, it } from 'vitest';

import { Span } from '../../domain/clip/Span.js';
import { SoundAnnotation } from '../../domain/annotation/SoundAnnotation.js';
import { soundPlugin } from './sound-plugin.js';

const span = Span.of(0.1, 0.3);
const sound = (name: string): SoundAnnotation => {
  const made = SoundAnnotation.create(span, name);
  if (!made) throw new Error('the test sound should be usable');
  return made;
};

describe('the sound kind in the view', () => {
  it('is the sound kind, and asks for no picture', () => {
    expect(soundPlugin.id).toBe('sound');
    expect(soundPlugin.needsPicture).toBe(false);
    expect(soundPlugin.action.label).toBe('Sound');
    expect(soundPlugin.action.icon.length).toBeGreaterThan(0);
  });

  it('declares the sound it plays, as a property the inspector can change', () => {
    const property = soundPlugin.properties?.find(p => p.id === 'sound');
    expect(property?.control).toBe('sound');
    expect(property?.value(sound('chime'))).toBe('chime');
    const changed = property?.with(sound('chime'), 'gong') as SoundAnnotation | null;
    expect(changed?.geometry).toEqual({ sound: 'gong' });
    // a name the app does not serve is refused, so the panel reports it rather than the clip changing
    expect(property?.with(sound('chime'), 'applause')).toBeNull();
  });

  it('draws nothing, whatever it is handed', () => {
    // The renderer paints no pixel: a sound is heard, not drawn.
    expect(soundPlugin.draw()).toBeUndefined();
  });
});
