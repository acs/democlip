// Seeding a clip from the active profile: what a clip starts with.
//
// A profile reaches a clip in exactly one place, and only onto an **empty** clip — a clip
// already being made is the person's, and a restored one carries its own values. It walks
// the seedable clip properties and nothing else, so a stored setting for a property this
// build does not preload is ignored rather than applied.
//
// It is free of the DOM, so the rule can be proved in node.

import type { Clip } from '../../domain/clip/Clip.js';
import type { Profiles } from '../../domain/profile/Profiles.js';
import { seedableClipProperties } from '../clip/clip-properties.js';

/**
 * Give an empty clip the active profile's settings. A clip that already holds a take is
 * left exactly as it is; a profile that says nothing about a property leaves the clip's
 * own value alone. A seeded value is an ordinary clip change — announced once, and the
 * value the panel and the export see.
 */
export function seedActiveProfile(clip: Clip, profiles: Profiles): void {
  if (!clip.takes.isEmpty()) return;
  const active = profiles.active();
  for (const property of seedableClipProperties()) {
    const value = active.valueFor(property.id);
    if (value === null) continue;
    const next = property.with(clip.properties, value);
    if (!next) continue;
    clip.setProperty(property.id, next.get(property.id));
  }
}
