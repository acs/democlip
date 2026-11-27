// Keeping the profiles across a page load, named without localStorage.
//
// The profiles are a few hundred bytes of configuration, so they live in localStorage
// rather than the clip store (IndexedDB, which is for the recording's bytes). The port
// keeps that name out of the use case, the way `RecordingStorePort` keeps IndexedDB out of
// keeping a clip, and lets the rules be proved with a fake.

import type { StoredProfiles } from '../../domain/profile/Profiles.js';

export interface ProfileStorePort {
  /** The written book, or null when nothing is kept or nothing usable is. */
  load(): Promise<StoredProfiles | null>;
  /** Write it down. May reject — the caller reports the failure. */
  save(state: StoredProfiles): Promise<void>;
}
