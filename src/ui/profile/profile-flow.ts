// The profile flow: the profiles use case composed with the app.
//
// It is the one place the profiles meet the session, the store and the view. The rules
// live in `src/domain/profile/` and the use case in `src/application/profiles.ts`; what is
// here is the wiring — the session's own answer to "has it begun to capture", the browser's
// id source and store, the seeding that gives a new clip its starting values, and the
// toolbar icon that opens the menu.

import { ManageProfiles, type ProfileResult } from '../../application/profiles.js';
import { session } from '../../session.js';
import { profileStore } from '../../infra/profile-store.js';
import { onPhaseChange } from '../../state.js';
import { el, toast } from '../dom.js';
import { seedActiveProfile } from './seed.js';
import { avatarLetters } from './profile-rows.js';
import { profileMenu } from './profile-menu.js';

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

/** Read the profiles in. A failure leaves the app working under its built-in default. */
export async function loadProfiles(): Promise<void> {
  await profiles.load();
}

/** Give an empty clip the active profile's settings. Does nothing to a clip that has a take. */
export function seedClip(): void {
  seedActiveProfile(session.clip, profiles.current);
}

/** Wire the toolbar pill and the menu: the pill toggles it, and the book's changes redraw both. */
export function initProfileMenu(): void {
  profileMenu.init({
    list: () => profiles.current,
    locked,
    choose: id => report(profiles.choose(id)),
    setSetting: (id, property, value) => report(profiles.setSetting(id, property, value)),
    create: name => report(profiles.create(name)),
    rename: (id, name) => report(profiles.rename(id, name)),
    remove: id => report(profiles.remove(id)),
  });
  el.profileBtn.addEventListener('click', () => profileMenu.toggle());
  // The rows say what the lock changes — a take starting, a session ending — so redraw
  // while the menu is open. A change behind a closed menu costs nothing.
  session.clip.onChange(() => profileMenu.refresh());
  onPhaseChange(() => profileMenu.refresh());
  paintProfileButton();
}

/**
 * The toolbar pill shows the active profile's first letters — Dem for DemoClipTV, Def for
 * Default — so what the clip is about to be made under is readable without opening anything.
 */
export function paintProfileButton(): void {
  const active = profiles.current.active();
  el.profileInitials.textContent = avatarLetters(active.name);
  const label = `Profiles — working under ${active.name}`;
  el.profileBtn.setAttribute('aria-label', label);
  el.profileBtn.title = label;
}

/**
 * Take a change the use case allowed or refused. A refusal is said out loud; a change
 * re-seeds an empty clip, so what the person set up is what the clip about to be made
 * starts with — and never while the session is capturing, when the active profile is fixed.
 */
function report(outcome: ProfileResult): void {
  if (!outcome.ok) { toast(outcome.reason); return; }
  paintProfileButton();
  if (!locked()) seedClip();
}
