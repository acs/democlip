// The projects: the book of them, and which one is current.
//
// It is the one place that knows the rules about *several* projects — that the built-in
// Default is always there and cannot go, that a name is unique among the person's own,
// and that the current project falls back rather than leaving the app without one.
// `Project` holds what one project is; this holds what is true of the set.
//
// Nothing here reaches for storage or the browser: the app keeps the book in memory and
// writes it down through a port (the same split `Profiles` uses). What it reads back is
// treated as untrusted — a person's browser holds it, and it may be old — so `of` repairs
// what it can and never throws.

import { Project, DEFAULT_PROJECT_ID, defaultProject, type StoredProject } from './Project.js';

/** The shape this build writes and reads; another version is not guessed at. */
export const PROJECTS_FORMAT = 1;

export interface StoredProjects {
  version: number;
  currentId: string;
  projects: StoredProject[];
}

export class Projects {
  /** The built-in project's id: the project the app always has. */
  static readonly DEFAULT_ID = DEFAULT_PROJECT_ID;

  private constructor(
    readonly all: readonly Project[],
    readonly currentId: string,
  ) {}

  /** The app with nothing set up: the Default project alone, and current. */
  static starting(): Projects {
    return new Projects([defaultProject()], DEFAULT_PROJECT_ID);
  }

  /**
   * Read a written book back. Every entry is untrusted: a project that cannot be named is
   * dropped, an entry claiming the Default id is replaced by the app's own Default, and a
   * `currentId` that names nothing lands on Default — so the book is never empty and
   * always has one current project.
   */
  static of(stored: StoredProjects | null | undefined): Projects {
    if (!stored || typeof stored !== 'object' || !Array.isArray(stored.projects)) return Projects.starting();

    const seen = new Set<string>([DEFAULT_PROJECT_ID]);
    const kept: Project[] = [];
    // The Default is the app's own in id and name — a stored entry cannot rename it — but
    // its description and default profile are the person's, and are kept.
    let defaultEntry = defaultProject();
    for (const raw of stored.projects) {
      const project = Project.restore(raw);
      if (!project) continue;
      if (project.id === DEFAULT_PROJECT_ID) {
        const described = defaultEntry.described(project.motivation, project.objectives);
        defaultEntry = described.withDefaultProfile(project.defaultProfileId) ?? described;
        continue;
      }
      if (seen.has(project.id)) continue;
      seen.add(project.id);
      kept.push(project);
    }

    const all = [defaultEntry, ...kept];
    const currentId = all.some(project => project.id === stored.currentId) ? stored.currentId : DEFAULT_PROJECT_ID;
    return new Projects(all, currentId);
  }

  /** The project the app is working in. There is always one. */
  current(): Project {
    return this.get(this.currentId) ?? this.all[0]!;
  }

  /** One by id, or null for one this book does not hold. */
  get(id: string): Project | null {
    return this.all.find(project => project.id === id) ?? null;
  }

  /**
   * Add a project, or null when its id is taken or its name is already used by another
   * project — the Default's name included, so "Default" cannot be created twice.
   */
  create(project: Project): Projects | null {
    if (this.has(project.id) || this.nameTaken(project.name)) return null;
    return new Projects([...this.all, project], this.currentId);
  }

  /** Make one current, or null when there is no such project. */
  select(id: string): Projects | null {
    return this.has(id) ? new Projects(this.all, id) : null;
  }

  /**
   * Rename one of the person's own projects, or null when it cannot be renamed: the
   * Default's name is fixed, the name must have something in it, and it must not be
   * another project's.
   */
  rename(id: string, name: string): Projects | null {
    if (id === DEFAULT_PROJECT_ID) return null;
    const current = this.get(id);
    const renamed = current?.renamed(name);
    if (!renamed) return null;
    if (this.all.some(project => project.id !== id && sameName(project.name, renamed.name))) return null;
    return new Projects(this.all.map(project => (project.id === id ? renamed : project)), this.currentId);
  }

  /** Change what a project is for, exactly as written. Null for one that is not here. */
  describe(id: string, motivation: string, objectives: string): Projects | null {
    const current = this.get(id);
    if (!current) return null;
    const described = current.described(motivation, objectives);
    return new Projects(this.all.map(project => (project.id === id ? described : project)), this.currentId);
  }

  /**
   * Take one of the person's own projects away, or null when it cannot go. When the one
   * removed was current, the Default becomes current, so the app is never left without a
   * project to work in. The recordings are the use case's job: it moves them to Default.
   */
  remove(id: string): Projects | null {
    if (id === DEFAULT_PROJECT_ID) return null;
    if (!this.has(id)) return null;
    const all = this.all.filter(project => project.id !== id);
    const currentId = this.currentId === id ? DEFAULT_PROJECT_ID : this.currentId;
    return new Projects(all, currentId);
  }

  /** Put a project's recordings under a profile, or null when either cannot be named. */
  setDefaultProfile(id: string, profileId: string): Projects | null {
    if (typeof profileId !== 'string' || profileId === '') return null;
    const current = this.get(id);
    const changed = current?.withDefaultProfile(profileId);
    if (!changed) return null;
    return new Projects(this.all.map(project => (project.id === id ? changed : project)), this.currentId);
  }

  has(id: string): boolean {
    return this.all.some(project => project.id === id);
  }

  /** The book as it is written down. */
  stored(): StoredProjects {
    return {
      version: PROJECTS_FORMAT,
      currentId: this.currentId,
      projects: this.all.map(project => project.stored()),
    };
  }

  private nameTaken(name: string): boolean {
    return this.all.some(project => sameName(project.name, name));
  }
}

/** Two names a person would read as the same: trimmed, and ignoring case. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}