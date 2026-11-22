// Where the profiles outlive the page: localStorage.
//
// A profile is a few hundred bytes of configuration, read before any take exists — so it
// lives in localStorage, which answers synchronously and cheaply, rather than the clip
// store (IndexedDB, and that is for the recording's bytes). One key holds the whole book
// as JSON.
//
// This is deliberately the browser boundary and nothing more: no rules live here. A
// missing, unreadable or other-version record reads as `null`, so the app starts on its
// built-in default rather than guessing; a failure to write is reported to the caller
// rather than swallowed.

import { PROFILES_FORMAT, type StoredProfiles } from '../domain/profile/Profiles.js';
import type { ProfileStorePort } from '../application/ports/ProfileStorePort.js';

const KEY = 'democlip_profiles';

/** The written book, or null when nothing is kept or nothing usable is. */
export function loadProfiles(): Promise<StoredProfiles | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return Promise.resolve(null);
    const parsed = JSON.parse(raw) as StoredProfiles | null;
    if (!parsed || typeof parsed !== 'object') return Promise.resolve(null);
    // This build reads the shape it writes; another version is not guessed at, and
    // `Profiles.of` repairs whatever is inside a record of the right version.
    if (parsed.version !== PROFILES_FORMAT) return Promise.resolve(null);
    return Promise.resolve(parsed);
  } catch {
    return Promise.resolve(null);
  }
}

/** Write the book down. Rejects when the browser will not take it. */
export function saveProfiles(state: StoredProfiles): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/** The port the profiles use case sees. */
export const profileStore: ProfileStorePort = {
  load: loadProfiles,
  save: saveProfiles,
};
