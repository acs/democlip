// The colour a toolbar pill wears: the one of the entry it opens.
//
// A profile's pill wears what the active profile's own badge wears — the annotation
// colour it fixes, or the tone its id gives it. A project's pill wears the tone of the
// project it is in, the same one its row shows. The pill is then a small copy of the
// selected entry, not a second anonymous control.

import { badgeInk } from '../profile/profile-rows.js';
import type { AnnotationColour } from '../../domain/annotation/AnnotationColour.js';

const TONES = ['av-0', 'av-1', 'av-2', 'av-3', 'av-4'] as const;

export interface PillColour {
  /** The colour a profile fixes, when it fixes one; null for a tone. */
  readonly colour: AnnotationColour | null;
  /** The entry's own tone, 0..4 — the same number its row avatar uses. */
  readonly tone: number;
}

/** Paint a pill: a fixed colour with the ink that reads on it, or the entry's tone. */
export function paintPill(button: HTMLElement, options: PillColour): void {
  button.classList.remove(...TONES, 'wears-colour');
  button.style.background = '';
  button.style.color = '';

  if (options.colour) {
    button.style.background = options.colour;
    button.style.color = badgeInk(options.colour);
    button.classList.add('wears-colour');
    return;
  }

  const tone = ((Math.trunc(options.tone) % TONES.length) + TONES.length) % TONES.length;
  button.classList.add(TONES[tone]!, 'wears-colour');
}
