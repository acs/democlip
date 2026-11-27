// Applying a profile: the items it declares, fixed on the clip.
//
// A project's profile does not offer defaults for a new clip; it **fixes** the items it
// declares, and the app applies them. The clip carries the **snapshot** of the profile it
// was made under, so this walks the snapshot and not a book that may have moved since —
// a recording already made keeps the configuration it was made with.
//
// It walks the seedable clip properties and nothing else, so a declaration for an item
// this build does not know is ignored rather than applied. It touches an **empty** clip
// only: a clip already holding a take is one the person is making, and its profile is
// fixed for its life.
//
// It is free of the DOM, so the rule can be proved in node.

import type { Clip } from '../../domain/clip/Clip.js';
import { seedableClipProperties } from '../clip/clip-properties.js';

/**
 * Fix onto an empty clip every item its profile declares, at the value the snapshot holds.
 * An item the profile does not declare is left exactly as it is — the person's. Applying a
 * value the clip already holds is no change at all.
 */
export function applyClipProfile(clip: Clip): void {
  if (!clip.takes.isEmpty()) return;
  for (const property of seedableClipProperties()) {
    const value = clip.profile.valueFor(property.id);
    if (value === null) continue;                 // not the profile's: the person's
    const next = property.with(clip.properties, value);
    if (!next) continue;
    clip.applyProperty(property.id, next.get(property.id));
  }
}
