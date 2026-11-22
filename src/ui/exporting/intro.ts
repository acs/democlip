// Whether this clip's export gets a title card at its head, and how long it is.
//
// The rule is the clip's own: it says "add to export" as one of its properties, and
// when that is on, the export puts the clip's title and description on its first frame
// for three seconds. Nothing here draws — the plan carries the card and the renderer
// draws it — and publishing never asks: a post uses the words alone.

import type { Clip } from '../../domain/clip/Clip.js';
import { IntroCard } from '../../domain/clip/IntroCard.js';
import { clipProperty } from '../clip/clip-properties.js';

/** How long the card the export may put at its head lasts, in seconds. */
export const INTRO_S = 3;

/**
 * The card this clip asks its export to put at its head, or null when it asks for none —
 * the property is off, or there is nothing to say. `clip` is the clip the export is of.
 */
export function introFor(clip: Clip): IntroCard | null {
  if (clipProperty('addToExport')?.value(clip.properties) !== 'true') return null;
  return IntroCard.of(clip.properties.get('title'), clip.properties.get('description'), INTRO_S);
}
