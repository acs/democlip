// The project book, kept across a page load, named without localStorage.

import type { StoredProjects } from '../../domain/project/Projects.js';

export interface ProjectStorePort {
  /** The written book, or null when nothing is kept or nothing usable is. */
  load(): Promise<StoredProjects | null>;
  /** Write the book down. Rejects when the browser will not take it. */
  save(state: StoredProjects): Promise<void>;
}