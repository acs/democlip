// What a profile panel draws, and the rules for drawing it.
//
// Two shapes live here, both free of the DOM so they can be read in node: a **row** of the
// selector (which profile is in use, and what may be done to each) and a row of the sheet a
// profile is **defined** in (which items it controls, and at what). What the app draws and
// what a check reads are the same answer, so a row that is refused is refused in both.

import { seedableClipProperties } from '../clip/clip-properties.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';

/** A profile, as the selector draws it. */
export interface ProfileRow {
  readonly id: string;
  readonly name: string;
  /** The first letters of the name, for the row's and the toolbar's pill — 'Dem'. */
  readonly avatar: string;
  /** Which of the avatar colours this profile keeps — the same one every time it is drawn. */
  readonly tone: number;
  readonly active: boolean;
  /** May this profile be chosen now? False for the others while the session has begun to capture. */
  readonly selectable: boolean;
  /** The built-in default: nothing is done to it. It is the app's free profile. */
  readonly fixed: boolean;
  /** May this profile be defined, renamed or removed now? */
  readonly manageable: boolean;
}

/** One item a profile may control, as its definition sheet draws it. */
export interface DefineRow {
  /** The clip property's id — 'addToExport'. */
  readonly id: string;
  readonly label: string;
  /** Which shared control edits the value — the clip property's own. */
  readonly control: string;
  /** True when the profile does not control it, so the person has it as always. */
  readonly free: boolean;
  /** The value it is fixed at. May be empty: fixed off, for a boolean. */
  readonly value: string;
  /** False when the profile is the active one and the session has begun to capture. */
  readonly editable: boolean;
}

/** How many avatar colours there are; the tone is one of these. */
export const AVATAR_TONES = 5;

/**
 * The letters a profile's pill shows: the first three of its name, the first one
 * capitalised — DemoClipTV is Dem, Default is Def. A name is never empty, so a pill always
 * has something in it.
 */
export function avatarLetters(name: string): string {
  const letters = name.replace(/\s+/g, '').trim().slice(0, 3);
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

/**
 * A profile's own colour, from its id alone, so a pill keeps its colour between openings
 * and after a reload rather than being handed out by position.
 */
export function avatarTone(id: string): number {
  let hash = 0;
  for (let at = 0; at < id.length; at++) hash = (hash * 31 + id.charCodeAt(at)) % 997;
  return hash % AVATAR_TONES;
}

/**
 * The selector's rows for a book. The active profile is fixed once the session has begun to
 * capture; another profile is not, so a new one can still be defined, renamed and removed
 * without touching the clip in front of the person. The built-in default is left alone: it
 * is the app's free profile, and the one guaranteed to define nothing.
 */
export function profileRows(book: Profiles, locked: boolean): ProfileRow[] {
  return book.all.map(profile => {
    const active = profile.id === book.activeId;
    const fixed = profile.id === Profiles.DEFAULT_ID;
    return {
      id: profile.id,
      name: profile.name,
      avatar: avatarLetters(profile.name),
      tone: avatarTone(profile.id),
      active,
      selectable: !locked || active,
      fixed,
      manageable: !fixed && !(locked && active),
    };
  });
}

/**
 * The rows of a profile's definition sheet: one per item a profile may control, saying
 * whether it does and at what. Nothing is offered for the built-in default, whose whole
 * point is that it controls nothing.
 */
export function defineRows(profile: Profile, options: { active: boolean; locked: boolean }): DefineRow[] {
  const editable = !(options.active && options.locked);
  return seedableClipProperties().map(property => {
    const value = profile.valueFor(property.id);
    return {
      id: property.id,
      label: property.label,
      control: property.control,
      free: value === null,
      value: value ?? '',
      editable,
    };
  });
}
