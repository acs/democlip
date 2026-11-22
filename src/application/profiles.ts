// The profiles use case: reading them in, choosing one, and the person's own changes.
//
// The rules about a profile and about several of them live in `src/domain/profile/`;
// what is left here is the two things the domain cannot know — whether the sitting
// session has begun to capture, and where the book is written down. Every change goes
// through the domain and is saved, so the app's state and the kept state move together.
//
// Nothing here reaches for the DOM, `session`, a browser API or the clock: the composition
// root hands in the session's own answer, the id source and the store, which is what lets
// every rule and refusal below be proved in node with a fake.

import { Profile } from '../domain/profile/Profile.js';
import { Profiles } from '../domain/profile/Profiles.js';
import type { ProfileStorePort } from './ports/ProfileStorePort.js';

/** What a profile operation answers: the change, or a reason it was refused. */
export type ProfileResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export interface ProfileDeps {
  readonly store: ProfileStorePort;
  /** Has the sitting session begun to capture? The app answers with the session's own latch. */
  readonly capturing: () => boolean;
  /** A fresh id for a new profile — the caller's source, so the domain holds no random one. */
  readonly newId: () => string;
  /** Something went wrong that the person need not be stopped for. */
  readonly warn?: (error: unknown) => void;
}

const LOCKED = 'A profile is fixed once recording has started — press New to start another session.';

export class ManageProfiles {
  private book: Profiles = Profiles.starting();

  constructor(private readonly deps: ProfileDeps) {}

  /** The book in hand: what the menu lists and what seeding reads. */
  get current(): Profiles {
    return this.book;
  }

  /** Read the written book in. A failure leaves the app on its built-in default. */
  async load(): Promise<Profiles> {
    let stored = null;
    try {
      stored = await this.deps.store.load();
    } catch (error) {
      this.deps.warn?.(error);
    }
    this.book = Profiles.of(stored);
    return this.book;
  }

  /** Make a profile active. Refused once the session has begun to capture. */
  choose(id: string): ProfileResult<{ active: string }> {
    if (this.deps.capturing()) return { ok: false, reason: LOCKED };
    const next = this.book.choose(id);
    if (!next) return { ok: false, reason: `there is no profile called ${id}` };
    return this.commit(next, { active: id });
  }

  /**
   * Make a new profile. It joins the list and does not become active on its own — the
   * person chooses it — so creating one while the session has begun to capture changes
   * nothing about the clip in front of them.
   */
  create(name: string): ProfileResult<{ id: string }> {
    const id = this.deps.newId();
    const profile = Profile.create(id, name);
    if (!profile) return { ok: false, reason: 'a profile needs a name' };
    const next = this.book.add(profile);
    if (!next) return { ok: false, reason: 'that profile is already here' };
    return this.commit(next, { id });
  }

  /** Change one of a profile's settings. The active profile is fixed while capturing. */
  setSetting(id: string, property: string, value: string): ProfileResult<{ value: string }> {
    if (this.deps.capturing() && id === this.book.activeId) return { ok: false, reason: LOCKED };
    const next = this.book.setSetting(id, property, value);
    if (!next) return { ok: false, reason: `there is no profile called ${id}` };
    return this.commit(next, { value });
  }

  /** Rename one of the person's own profiles. The active one is fixed while capturing. */
  rename(id: string, name: string): ProfileResult<{ id: string; name: string }> {
    if (id === Profiles.DEFAULT_ID) return { ok: false, reason: 'the default profile cannot be renamed' };
    if (this.deps.capturing() && id === this.book.activeId) return { ok: false, reason: LOCKED };
    if (!this.book.has(id)) return { ok: false, reason: `there is no profile called ${id}` };
    if (name.trim() === '') return { ok: false, reason: 'a profile needs a name' };
    const next = this.book.rename(id, name)!;
    return this.commit(next, { id, name: next.get(id)!.name });
  }

  /** Take one of the person's own profiles away. The active one is fixed while capturing. */
  remove(id: string): ProfileResult<{ activeId: string }> {
    if (id === Profiles.DEFAULT_ID) return { ok: false, reason: 'the default profile cannot be removed' };
    if (this.deps.capturing() && id === this.book.activeId) return { ok: false, reason: LOCKED };
    const next = this.book.remove(id);
    if (!next) return { ok: false, reason: `there is no profile called ${id}` };
    return this.commit(next, { activeId: next.activeId });
  }

  /**
   * Take a change the domain allowed: hold it, write the book down, and answer it. A failed
   * write is reported and does not undo the change, so the person keeps what they just did
   * — as they do for a clip that failed to be kept.
   */
  private commit<T>(next: Profiles, value: T): ProfileResult<T> {
    this.book = next;
    void this.deps.store.save(next.stored()).catch(error => this.deps.warn?.(error));
    return { ...value, ok: true } as ProfileResult<T>;
  }
}
