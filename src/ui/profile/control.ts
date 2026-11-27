// Who controls an item: the one rule the properties panel and the automation surface both ask.
//
// The clip carries the **snapshot** of the profile it was made under, and a profile that
// declares an item **fixes** it: the person cannot change it. The app answers that
// question in one place, from the clip itself, so the panel that draws the row and the
// surface an agent drives cannot disagree — and a recording reopened after a reload still
// says who fixes its items, even if the profile has since been edited or removed.
//
// It is free of the DOM, so it can be proved in node beside the domain rule it reads.

import type { Clip } from '../../domain/clip/Clip.js';

/** The name of the profile that fixes an item, or null when the item is the person's. */
export type Controlling = (propertyId: string) => string | null;

/** The rule, read from the clip in hand — a profile chosen later is seen at once. */
export function controllingIn(clip: () => Clip): Controlling {
  return propertyId => (clip().profile.valueFor(propertyId) === null ? null : clip().profile.name);
}