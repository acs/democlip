// The profile flow: the profiles use case composed with the app.
//
// It is the one place the profiles meet the session, the store and the view. The rules live
// in `src/domain/profile/` and the use case in `src/application/profiles.ts`; what is here is
// the wiring — the session's own answer to "has it begun to capture", the browser's id source
// and store, the application of what a profile fixes, the toolbar pill, and the two surfaces
// that show and define profiles.

import { ManageProfiles, type ProfileResult } from '../../application/profiles.js';
import { session } from '../../session.js';
import { profileStore } from '../../infra/profile-store.js';
import { onPhaseChange } from '../../state.js';
import { el, toast } from '../dom.js';
import { applyActiveProfile } from './apply.js';
import { controllingIn } from './control.js';
import { avatarLetters, badgeInk, profileColour } from './profile-rows.js';
import { profileMenu } from './profile-menu.js';
import { profileDef } from './profile-def.js';

export const profiles = new ManageProfiles({
  store: profileStore,
  capturing: () => locked(),
  newId: () => crypto.randomUUID(),
  warn: error => console.warn('DemoClip: could not keep the profiles —', error),
});

/**
 * Has the sitting session begun to capture? A profile is fixed from here until the session
 * ends. The clip's own takes are part of the answer as well as the session's latch: a take
 * brought in by Import, and a clip that came back after a reload, both hold takes without
 * the latch ever having been raised.
 */
export function locked(): boolean {
  return session.hasCaptured || !session.clip.takes.isEmpty();
}

/** Who fixes an item, or null when it is the person's. The one rule, asked by both surfaces. */
export const controlling = controllingIn(() => profiles.current);

/** Read the profiles in. A failure leaves the app working under its built-in default. */
export async function loadProfiles(): Promise<void> {
  await profiles.load();
}

/** Fix onto the clip the items the active profile controls. Does nothing to a clip with a take. */
export function applyProfile(): void {
  applyActiveProfile(session.clip, profiles.current);
}

/** Wire the pill, the selector and the config sheet; redraw the selector when the lock moves. */
export function initProfiles(): void {
  profileMenu.init({
    list: () => profiles.current,
    locked,
    choose: id => report(profiles.choose(id)),
    create: name => report(profiles.create(name)),
    define: id => profileDef.open(id),
    remove: id => report(profiles.remove(id)),
  });
  profileDef.init({
    list: () => profiles.current,
    locked,
    declare: (id, property, value) => report(profiles.declare(id, property, value)),
    // The name is set in the profile's own dialog, and the list behind it follows.
    rename: (id, name) => report(profiles.rename(id, name)),
  });
  el.profileBtn.addEventListener('click', () => profileMenu.toggle());
  // The rows say what the lock changes — a take starting, a session ending — so redraw while
  // the selector is open. A change behind a closed panel costs nothing.
  session.clip.onChange(() => profileMenu.refresh());
  onPhaseChange(() => profileMenu.refresh());
  paintProfileButton();
}

/**
 * The toolbar pill shows the active profile's first letters — Dem for DemoClipTV, Def for
 * Default — so what the clip is about to be made under is readable without opening anything.
 * It is the same badge its row wears: when the profile fixes an annotation colour, the pill
 * wears that colour too.
 */
export function paintProfileButton(): void {
  const active = profiles.current.active();
  el.profileInitials.textContent = avatarLetters(active.name);
  const colour = profileColour(active);
  el.profileBtn.style.background = colour ?? '';
  el.profileBtn.style.color = colour ? badgeInk(colour) : '';
  el.profileBtn.classList.toggle('wears-colour', colour !== null);
  const label = `Profiles — working under ${active.name}`;
  el.profileBtn.setAttribute('aria-label', label);
  el.profileBtn.title = label;
}

/**
 * Take a change the use case allowed or refused. A refusal is said out loud. A change is
 * followed by applying what the active profile fixes, so a clip not yet capturing is always
 * showing the values the profile holds — and never while the session is capturing, when the
 * active profile cannot move at all.
 */
function report(outcome: ProfileResult): void {
  if (!outcome.ok) { toast(outcome.reason); return; }
  paintProfileButton();
  // The selector is open behind the profile's dialog, so it follows a name or an item changed
  // there — and a change to what the active profile fixes reaches the clip.
  profileMenu.refresh();
  if (!locked()) applyProfile();
}
