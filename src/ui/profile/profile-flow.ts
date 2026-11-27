// The profile flow: the profiles use case composed with the app.
//
// It is the one place the profiles meet the session, the store and the view. The rules live
// in `src/domain/profile/` and the use case in `src/application/profiles.ts`; what is here is
// the wiring — the session's own answer to "has it begun to capture", the browser's id source
// and store, the profile the clip is made under, the toolbar pill, and the two surfaces that
// show and define profiles.
//
// The profile in force is the **clip's snapshot**, not a book's active id: a recording
// carries the profile it was made under, so a reload, a later edit or a removed profile
// cannot move what it is produced as. The selector's tick follows the clip with it.

import { ManageProfiles, type ProfileResult } from '../../application/profiles.js';
import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import { session } from '../../session.js';
import { profileStore } from '../../infra/profile-store.js';
import { onPhaseChange } from '../../state.js';
import { el, toast } from '../dom.js';
import { applyClipProfile } from './apply.js';
import { controllingIn } from './control.js';
import { avatarLetters, badgeInk, profileColour } from './profile-rows.js';
import { profileMenu } from './profile-menu.js';
import { profileDef } from './profile-def.js';
import { recordings } from '../project/project-flow.js';

const LOCKED = 'A profile is fixed once recording has started — press New to start another session.';

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
export const controlling = controllingIn(() => session.clip);

/** Read the profiles in. A failure leaves the app working under its built-in default. */
export async function loadProfiles(): Promise<void> {
  await profiles.load();
}

/** Fix onto the clip the items its profile declares. Does nothing to a clip with a take. */
export function applyProfile(): void {
  applyClipProfile(session.clip);
}

/** Wire the pill, the selector and the config sheet; redraw the selector when the lock moves. */
export function initProfiles(): void {
  profileMenu.init({
    list: () => profiles.current,
    activeId: () => session.clip.profile.id,
    locked,
    choose: id => void chooseProfile(id),
    create: name => report(profiles.create(name)),
    define: id => profileDef.open(id),
    remove: id => report(profiles.remove(id)),
  });
  profileDef.init({
    list: () => profiles.current,
    activeId: () => session.clip.profile.id,
    locked,
    declare: (id, property, value) => report(profiles.declare(id, property, value)),
    // The name is set in the profile's own dialog, and the list behind it follows.
    rename: (id, name) => report(profiles.rename(id, name)),
  });
  el.profileBtn.addEventListener('click', () => profileMenu.toggle());
  // The rows say what the lock changes — a take starting, a session ending — so redraw while
  // the selector is open. A change behind a closed panel costs nothing.
  session.clip.onChange(event => {
    // The pill shows the clip's profile, so a profile chosen, a draft started or a session
    // ended repaints it; the selector behind it follows every change.
    if (event.type === 'profile-changed' || event.type === 'cleared') paintProfileButton();
    profileMenu.refresh();
  });
  onPhaseChange(() => profileMenu.refresh());
  paintProfileButton();
}

/**
 * The toolbar pill shows the profile the clip is made under — its first letters, Dem for
 * DemoClipTV, Emp for Empty — so what the clip is produced as is readable without opening
 * anything. A profile that fixes an annotation colour wears that colour as its badge.
 */
export function paintProfileButton(): void {
  const active = session.clip.profile;
  el.profileInitials.textContent = avatarLetters(active.name);
  const colour = profileColour(active);
  el.profileBtn.style.background = colour ?? '';
  el.profileBtn.style.color = colour ? badgeInk(colour) : '';
  el.profileBtn.classList.toggle('wears-colour', colour !== null);
  const label = `Profiles — making this clip under ${active.name}`;
  el.profileBtn.setAttribute('aria-label', label);
  el.profileBtn.title = label;
}

/**
 * Choose the profile the clip is made under. Only before it begins to capture: from the
 * first take the profile is fixed for the life of the recording, and the refusal says so.
 */
async function chooseProfile(id: string): Promise<void> {
  if (locked()) { toast(LOCKED); return; }
  const outcome = profiles.choose(id);
  if (!outcome.ok) { toast(outcome.reason); return; }
  const live = profiles.current.get(id);
  if (live) await recordings.chooseProfile(ClipProfile.of(live));
  report({ ok: true });
}

/**
 * Take a change the use case allowed or refused. A refusal is said out loud. A change is
 * followed by applying what the clip's profile declares, so a clip not yet capturing is
 * always showing those values — and never while the session is capturing, when the profile
 * is fixed.
 */
function report(outcome: ProfileResult): void {
  if (!outcome.ok) { toast(outcome.reason); return; }
  paintProfileButton();
  // The selector is open behind the profile's dialog, so it follows a name or an item changed
  // there — and a change to the clip's own profile reaches the clip before it captures.
  profileMenu.refresh();
  if (!locked()) {
    const live = profiles.current.get(session.clip.profile.id);
    // A profile the person lets go of while it is the draft's falls back to the free one,
    // exactly as the book's own active profile does.
    void recordings.chooseProfile(live ? ClipProfile.of(live) : ClipProfile.DEFAULT);
    applyProfile();
  }
}