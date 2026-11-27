// Where the projects outlive the page: localStorage.
//
// A project is a few hundred bytes of words and an id, read before any take exists — so
// it lives in localStorage, which answers synchronously and cheaply, rather than the
// recording store (IndexedDB, and that is for the recording's bytes). One key holds the
// whole book as JSON, as the profiles do.
//
// This is deliberately the browser boundary and nothing more: no rules live here. A
// missing, unreadable or other-version record reads as `null`, so the app starts on its
// built-in Default rather than guessing; a failure to write is reported to the caller
// rather than swallowed.

import { PROJECTS_FORMAT, type StoredProjects } from '../domain/project/Projects.js';
import type { ProjectStorePort } from '../application/ports/ProjectStorePort.js';

const KEY = 'democlip_projects';

/** The written book, or null when nothing is kept or nothing usable is. */
export function loadProjects(): Promise<StoredProjects | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return Promise.resolve(null);
    const parsed = JSON.parse(raw) as StoredProjects | null;
    if (!parsed || typeof parsed !== 'object') return Promise.resolve(null);
    if (parsed.version !== PROJECTS_FORMAT) return Promise.resolve(null);
    return Promise.resolve(parsed);
  } catch {
    return Promise.resolve(null);
  }
}

/** Write the book down. Rejects when the browser will not take it. */
export function saveProjects(state: StoredProjects): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/** The port the projects use case sees. */
export const projectStore: ProjectStorePort = {
  load: loadProjects,
  save: saveProjects,
};