// What a profile menu row is, and the rules for drawing them.
//
// Kept apart from the menu itself so the answer can be read in node, with no DOM: what the
// menu draws and what a check reads are the same rows, so a row that is refused for the
// person is refused in the test too.

import { seedableClipProperties } from '../clip/clip-properties.js';
import { Profiles } from '../../domain/profile/Profiles.js';

/** One setting a profile carries, as a row draws it. */
export interface ProfileSettingRow {
  /** The clip property's id — 'addToExport'. */
  readonly id: string;
  readonly label: string;
  /** Which shared control edits it — the clip property's own. */
  readonly control: string;
  readonly value: string;
  /** False when the row is fixed for now: the active profile while the session captures, or the default. */
  readonly editable: boolean;
}

/** One profile, as a row draws it. */
export interface ProfileRow {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  /** May this profile be chosen now? False for the others while the session has begun to capture. */
  readonly selectable: boolean;
  /** The built-in default: no rename, no remove, no settings. */
  readonly fixed: boolean;
  /** May this profile be renamed or removed now? */
  readonly manageable: boolean;
  readonly settings: readonly ProfileSettingRow[];
}

/**
 * The rows for a book. The active profile is fixed once the session has begun to capture;
 * another profile is not, so a new one can still be set up and tidied without touching the
 * clip in front of the person.
 */
export function profileRows(book: Profiles, locked: boolean): ProfileRow[] {
  return book.all.map(profile => {
    const active = profile.id === book.activeId;
    const fixed = profile.id === Profiles.DEFAULT_ID;
    const frozen = locked && active;
    return {
      id: profile.id,
      name: profile.name,
      active,
      selectable: !locked || active,
      fixed,
      manageable: !fixed && !frozen,
      settings: seedableClipProperties().map(property => ({
        id: property.id,
        label: property.label,
        control: property.control,
        value: profile.valueFor(property.id) ?? '',
        editable: !fixed && !frozen,
      })),
    };
  });
}
