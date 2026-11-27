import { describe, it, expect, beforeEach } from 'vitest';
import { kindLabel, kindTitle, propertyLabel, colourLabel, soundLabel } from './labels.js';
import { setLocale } from './index.js';
import { DEFAULT_LOCALE } from './locale.js';

describe('the app\'s declared names, in the person\'s language', () => {
  beforeEach(() => setLocale(DEFAULT_LOCALE));

  it('names a kind, and its tooltip, in English and Spanish', () => {
    expect(kindLabel('arrow', 'Arrow')).toBe('Arrow');
    expect(kindTitle('arrow', 'Annotate this section with an arrow')).toBe('Annotate this section with an arrow');
    setLocale('es_ES');
    expect(kindLabel('arrow', 'Arrow')).toBe('Flecha');
    expect(kindTitle('arrow', 'Annotate this section with an arrow')).toBe('Anota esta sección con una flecha');
  });

  it('names an annotation property, a colour and a sound', () => {
    expect(propertyLabel('colour', 'Colour')).toBe('Colour');
    expect(colourLabel('#e53e3e')).toBe('Red');
    expect(soundLabel('chime', 'Chime')).toBe('Chime');
    setLocale('es_ES');
    expect(propertyLabel('colour', 'Colour')).toBe('Color');
    expect(colourLabel('#e53e3e')).toBe('Rojo');
    expect(soundLabel('chime', 'Chime')).toBe('Campana');
  });

  it('falls back to the declaration for an id or colour this build does not name', () => {
    expect(kindLabel('box', 'Box')).toBe('Box');
    expect(propertyLabel('nope', 'Nope')).toBe('Nope');
    expect(colourLabel('#123456')).toBe('#123456');
    expect(soundLabel('nope', 'Nope')).toBe('Nope');
  });
});
