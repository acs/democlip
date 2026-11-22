import { describe, expect, it } from 'vitest';

import { IntroCard } from './IntroCard.js';

// The card a clip's words make: the two rules are that there is something to show and
// some time to show it in, and both are proved here.

describe('IntroCard', () => {
  it('is a card when there are words to show', () => {
    const card = IntroCard.of('A demo', 'What the clip shows', 3);
    expect(card).not.toBeNull();
    expect(card?.title).toBe('A demo');
    expect(card?.description).toBe('What the clip shows');
    expect(card?.seconds).toBe(3);
  });

  it('is a card with only a title, or only a description', () => {
    expect(IntroCard.of('A demo', '', 3)?.title).toBe('A demo');
    expect(IntroCard.of('', 'What the clip shows', 3)?.description).toBe('What the clip shows');
  });

  it('is no card with nothing to show', () => {
    expect(IntroCard.of('', '', 3)).toBeNull();
    expect(IntroCard.of('  ', '\n', 3)).toBeNull();
  });

  it('is no card with no time to show it in', () => {
    expect(IntroCard.of('A demo', 'What it shows', 0)).toBeNull();
    expect(IntroCard.of('A demo', 'What it shows', -3)).toBeNull();
  });

  it('trims the words it shows', () => {
    expect(IntroCard.of('  A demo  ', '  What it shows  ', 3)).toMatchObject({
      title: 'A demo', description: 'What it shows',
    });
  });
});
