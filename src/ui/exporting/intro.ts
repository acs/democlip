// Whether this clip's export gets a title card at its head, and what it shows.
//
// The rule is the clip's own: it says **add to export** as one of its properties, and when
// that is on the export puts the clip's words on its first frame for two seconds, with the
// day and the app's name under them. A **logo** asks for a card on its own: a logo lives on
// the card, so a clip that wears one always opens with it — which is what makes a profile
// that fixes a logo mean *every* clip made under it wears it. Nothing here draws — the plan
// carries the card and the renderer draws it — and publishing never asks: a post uses the
// words alone.

import type { Clip } from '../../domain/clip/Clip.js';
import { IntroCard } from '../../domain/clip/IntroCard.js';
import { clipProperty } from '../clip/clip-properties.js';

/** How long the card the export may put at its head lasts, in seconds. */
export const INTRO_S = 2;

/**
 * The card this clip asks its export to put at its head, or null when it asks for none —
 * neither **add to export** nor a **logo**. `when` is the day the card is made, which its
 * last line says; `clip` is the clip the export is of.
 */
export function introFor(clip: Clip, when: Date = new Date()): IntroCard | null {
  const logo = clip.properties.get('logo');
  const asked = clipProperty('addToExport')?.value(clip.properties) === 'true' || logo !== '';
  if (!asked) return null;
  return IntroCard.of(clip.properties.get('title'), clip.properties.get('description'), when, INTRO_S, logo);
}
