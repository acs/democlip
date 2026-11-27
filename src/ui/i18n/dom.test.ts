import { describe, it, expect, beforeEach } from 'vitest';
import { applyTranslations } from './dom.js';
import { setLocale } from './index.js';
import { DEFAULT_LOCALE } from './locale.js';

// A tiny stand-in for a marked element and a root, so the pass can be read in node without
// a DOM: `applyTranslations` only ever reads `getAttribute` and writes text/attributes.
interface FakeEl {
  attributes: Map<string, string>;
  textContent: string;
  innerHTML: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

function fakeElement(attrs: Record<string, string>): FakeEl {
  const attributes = new Map(Object.entries(attrs));
  return {
    attributes,
    textContent: '',
    innerHTML: '',
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => { attributes.set(name, value); },
  };
}

function fakeRoot(elements: FakeEl[]): ParentNode {
  return { querySelectorAll: () => elements } as unknown as ParentNode;
}

describe('applyTranslations', () => {
  beforeEach(() => setLocale(DEFAULT_LOCALE));

  it('fills the text and every attribute from the catalogue', () => {
    const label = fakeElement({ 'data-i18n': 'record.button.start' });
    const button = fakeElement({
      'data-i18n-aria-label': 'record.button.aria',
      'data-i18n-title': 'record.button.aria',
    });
    applyTranslations(fakeRoot([label, button]));
    expect(label.textContent).toBe('Record');
    expect(button.attributes.get('aria-label')).toBe('Start or stop recording');
    expect(button.attributes.get('title')).toBe('Start or stop recording');
  });

  it('fills a placeholder too', () => {
    const input = fakeElement({ 'data-i18n-placeholder': 'record.button.start' });
    applyTranslations(fakeRoot([input]));
    expect(input.attributes.get('placeholder')).toBe('Record');
  });

  it('fills a sentence that carries first-party markup through data-i18n-html', () => {
    const body = fakeElement({ 'data-i18n-html': 'help.more' });
    applyTranslations(fakeRoot([body]));
    expect(body.innerHTML).toBe('Read the complete guide →');
  });

  it('leaves an unmarked element alone', () => {
    const el = fakeElement({});
    el.textContent = 'untouched';
    applyTranslations(fakeRoot([el]));
    expect(el.textContent).toBe('untouched');
  });

  it('shows Spanish once the locale is Spanish', () => {
    setLocale('es_ES');
    const label = fakeElement({ 'data-i18n': 'record.button.start' });
    applyTranslations(fakeRoot([label]));
    expect(label.textContent).toBe('Grabar');
  });
});
