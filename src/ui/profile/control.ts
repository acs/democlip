// Who controls an item: the one rule the properties panel and the automation surface both ask.
//
// A profile that declares an item **fixes** it, and the person cannot change it. The app
// answers that question in one place, so the panel that draws the row and the surface an
// agent drives cannot disagree about what is the person's.
//
// It is free of the DOM, so it can be proved in node beside the domain rule it reads.

import type { Profiles } from '../../domain/profile/Profiles.js';

/** The name of the profile that fixes an item, or null when the item is the person's. */
export type Controlling = (propertyId: string) => string | null;

/** The rule, read from the book in hand — so a profile chosen later is seen at once. */
export function controllingIn(book: () => Profiles): Controlling {
  return propertyId => book().controlling(propertyId)?.name ?? null;
}
