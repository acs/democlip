// Applying the active profile: the items it controls, fixed on the clip.
//
// A profile does not offer defaults for a new clip; it **fixes** the items it declares, and
// the app applies them. The value lands on the clip so that everything downstream — the
// properties panel, the export, the snapshot — reads one value and needs to know nothing
// about profiles.
//
// It walks the seedable clip properties and nothing else, so a declaration for an item this
// build does not know is ignored rather than applied. It touches an **empty** clip only: a
// clip already holding a take is one the person is making, and a profile may not be chosen
// once a session has begun to capture anyway.
//
// It is free of the DOM, so the rule can be proved in node.

import type { Clip } from '../../domain/clip/Clip.js';
import type { Profiles } from '../../domain/profile/Profiles.js';
import { seedableClipProperties } from '../clip/clip-properties.js';

/**
 * Fix onto an empty clip every item the active profile controls, at the value it declares.
 * An item the profile does not control is left exactly as it is — the person's. Applying a
 * value the clip already holds is no change at all.
 */
export function applyActiveProfile(clip: Clip, profiles: Profiles): void {
  if (!clip.takes.isEmpty()) return;
  const active = profiles.active();
  for (const property of seedableClipProperties()) {
    const value = active.valueFor(property.id);
    if (value === null) continue;                 // not the profile's: the person's
    const next = property.with(clip.properties, value);
    if (!next) continue;
    clip.applyProperty(property.id, next.get(property.id));
  }
}
