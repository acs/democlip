import { describe, it, expect, beforeEach } from 'vitest';
import { t, tIn, translate, setLocale, currentLocale } from './index.js';
import { DEFAULT_LOCALE } from './locale.js';

describe('t', () => {
  beforeEach(() => setLocale(DEFAULT_LOCALE));

  it('returns the sentence for the active language', () => {
    expect(t('record.button.start')).toBe('Record');
    setLocale('es_ES');
    expect(currentLocale()).toBe('es_ES');
    expect(t('record.button.start')).toBe('Grabar');
  });

  it('substitutes {name} values, in either language', () => {
    expect(t('status.encoding.left', { time: '0:12' })).toBe('ENCODING · 0:12 left');
    setLocale('es_ES');
    expect(t('status.encoding.left', { time: '0:12' })).toBe('CODIFICANDO · quedan 0:12');
  });

  it('leaves a {name} alone when no value is given for it', () => {
    expect(translate({ k: 'a {x} b' }, {}, 'k')).toBe('a {x} b');
  });

  it('falls back to the English sentence when the active catalogue has no entry', () => {
    expect(translate({}, { 'record.button.start': 'Record' }, 'record.button.start')).toBe('Record');
  });

  it('returns the key itself when no catalogue holds it, never a blank', () => {
    expect(translate({}, {}, 'nowhere.key')).toBe('nowhere.key');
  });

  it('tIn reads a named language whatever the active one is', () => {
    setLocale('es_ES');
    expect(tIn('en_UK', 'record.button.start')).toBe('Record');
    expect(tIn('es_ES', 'record.button.start')).toBe('Grabar');
  });
});
