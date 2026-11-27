// What a profile panel draws, and the rules for drawing it.
//
// Two shapes live here, both free of the DOM so they can be read in node: a **row** of the
// selector (which profile is in use, and what may be done to each) and a row of the sheet a
// profile is **defined** in (which items it controls, and at what). What the app draws and
// what a check reads are the same answer, so a row that is refused is refused in both.

import { seedableClipProperties, type PropertyChoice } from '../clip/clip-properties.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { isColour, type AnnotationColour } from '../../domain/annotation/AnnotationColour.js';

/** A profile, as the selector draws it. */
export interface ProfileRow {
  readonly id: string;
  readonly name: string;
  /** The first letters of the name, for the row's and the toolbar's pill — 'Dem'. */
  readonly avatar: string;
  /** Which of the avatar colours this profile keeps when it fixes no colour — the same one every time. */
  readonly tone: number;
  /** The colour the profile fixes its annotations to, or null — the badge wears it when there is one. */
  readonly colour: AnnotationColour | null;
  /** The ink that reads on that colour; unused when the profile fixes none. */
  readonly ink: string;
  readonly active: boolean;
  /** May this profile be chosen now? False for the others while the session has begun to capture. */
  readonly selectable: boolean;
  /** The built-in default: nothing is done to it. It is the app's free profile. */
  readonly fixed: boolean;
  /** May this profile be opened or removed now? Its name is set in its own dialog. */
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
  /** The values a `choice` item offers, when it is one. */
  readonly choices: readonly PropertyChoice[];
  /** False when the profile is the active one and the session has begun to capture. */
  readonly editable: boolean;
}

/** How many avatar colours there are; the tone is one of these. */
export const AVATAR_TONES = 5;

/**
 * The letters a profile's pill shows: the first three of its name, the first one
 * capitalised — DemoClipTV is Dem, Empty is Emp. A name is never empty, so a pill always
 * has something in it.
 */
export function avatarLetters(name: string): string {
  const letters = name.replace(/\s+/g, '').trim().slice(0, 3);
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

/**
 * A profile's own colour, from its id alone, so a pill keeps its colour between openings
 * and after a reload rather than being handed out by position. It is the fallback: a profile
 * that fixes an annotation colour wears that one instead (`profileColour`).
 */
export function avatarTone(id: string): number {
  let hash = 0;
  for (let at = 0; at < id.length; at++) hash = (hash * 31 + id.charCodeAt(at)) % 997;
  return hash % AVATAR_TONES;
}

/** The colour a profile fixes its annotations to, or null when it fixes none. */
export function profileColour(profile: { valueFor(id: string): string | null }): AnnotationColour | null {
  const value = profile.valueFor('annotationColour');
  return isColour(value) ? value : null;
}

/**
 * The ink that reads on a badge of this colour: the app's dark on the light colours, white on
 * the dark one. A badge is a solid patch of the colour, so the theme it sits in is not part of
 * the answer — the colour is the same on both.
 */
export function badgeInk(colour: AnnotationColour): string {
  return luminance(colour) > 0.186 ? '#08091A' : '#FFFFFF';
}

/** How bright a colour is, linearised as WCAG measures it. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(at => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * The selector's rows for a book. The active profile is fixed once the session has begun to
 * capture; another profile is not, so a new one can still be defined, renamed and removed
 * without touching the clip in front of the person. The built-in default is left alone: it
 * is the app's free profile, and the one guaranteed to define nothing.
 */
export function profileRows(book: Profiles, locked: boolean, activeId: string = book.activeId): ProfileRow[] {
  return book.all.map(profile => {
    const active = profile.id === activeId;
    const fixed = profile.id === Profiles.DEFAULT_ID;
    const colour = profileColour(profile);
    return {
      id: profile.id,
      name: profile.name,
      avatar: avatarLetters(profile.name),
      tone: avatarTone(profile.id),
      colour,
      ink: colour ? badgeInk(colour) : '',
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
      choices: property.choices ?? [],
      editable,
    };
  });
}
