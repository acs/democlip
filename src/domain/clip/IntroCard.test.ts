import { describe, expect, it } from 'vitest';

import { IntroCard, stampOf } from './IntroCard.js';

// The card a clip's words make: the two words, the day line under them, and the two rules
// — there is a time to show it in, and it always has at least the day to show.

const DAY = new Date(2026, 10, 22, 9, 30);   // 22 November 2026, in the person's own time

describe('IntroCard', () => {
  it('is a card with the words and the day line', () => {
    const card = IntroCard.of('A demo', 'What the clip shows', DAY, 2);
    expect(card).toMatchObject({
      title: 'A demo',
      description: 'What the clip shows',
      stamp: '2026-11-22 - DemoClip',
      seconds: 2,
    });
  });

  it('is a card with only a title, or only a description', () => {
    expect(IntroCard.of('A demo', '', DAY, 2)?.title).toBe('A demo');
    expect(IntroCard.of('', 'What the clip shows', DAY, 2)?.description).toBe('What the clip shows');
  });

  it('is a card even with nothing but the day line to show', () => {
    const card = IntroCard.of('', '', DAY, 2);
    expect(card?.title).toBe('');
    expect(card?.stamp).toBe('2026-11-22 - DemoClip');
  });

  it('carries the logo the clip wears, and none at all by default', () => {
    expect(IntroCard.of('A demo', '', DAY, 2, 'democlip')?.logo).toBe('democlip');
    expect(IntroCard.of('A demo', '', DAY, 2)?.logo).toBe('');
    expect(IntroCard.of('A demo', '', DAY, 2, '  democlip  ')?.logo).toBe('democlip');
  });

  it('is no card with no time to show it in', () => {
    expect(IntroCard.of('A demo', 'What it shows', DAY, 0)).toBeNull();
    expect(IntroCard.of('A demo', 'What it shows', DAY, -2)).toBeNull();
  });

  it('trims the words it shows', () => {
    expect(IntroCard.of('  A demo  ', '  What it shows  ', DAY, 2)).toMatchObject({
      title: 'A demo', description: 'What it shows',
    });
  });

  it('writes the day in the person\u2019s own time, as YYYY-MM-DD', () => {
    expect(stampOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05 - DemoClip');
  });
});
