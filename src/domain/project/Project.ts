// A project: a body of work and the reason for it.
//
// It holds the name a person calls it by, the description — the motivation and the
// objectives, shown together — and the id of the profile its recordings start under.
// It holds no recordings: a recording says which project it belongs to, so a project is
// never a second place that has to agree with the recordings.
//
// A value object: identity, the fields, and the transformations that keep them valid.
// The rules about *several* projects (the Default one, the current one, unique names)
// live in `Projects`.

import { Profiles } from '../profile/Profiles.js';

export interface StoredProject {
  id: string;
  name: string;
  motivation: string;
  objectives: string;
  defaultProfileId: string;
}

export interface ProjectInput {
  id: string;
  name: string;
  motivation?: string;
  objectives?: string;
  defaultProfileId?: string;
}

/** The built-in project's id and name: one spelling, used by the book and the Default. */
export const DEFAULT_PROJECT_ID = 'default';
export const DEFAULT_PROJECT_NAME = 'Default';

export class Project {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly motivation: string,
    readonly objectives: string,
    readonly defaultProfileId: string,
  ) {}

  /**
   * A project, or null when it cannot be one: the id must be a non-empty string, the
   * name must still have something in it once trimmed, and the default profile must be
   * named. The description is free text and may be empty.
   */
  static create(input: ProjectInput): Project | null {
    if (!input || typeof input !== 'object') return null;
    const id = typeof input.id === 'string' ? input.id : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const defaultProfileId = typeof input.defaultProfileId === 'string' ? input.defaultProfileId : '';
    if (id === '' || name === '' || defaultProfileId === '') return null;
    return new Project(
      id,
      name,
      text(input.motivation),
      text(input.objectives),
      defaultProfileId,
    );
  }

  /** Read one back, or null when the record cannot name one. */
  static restore(stored: StoredProject | null | undefined): Project | null {
    if (!stored || typeof stored !== 'object') return null;
    return Project.create(stored);
  }

  /** What the project is for, in the person's own words. */
  description(): { motivation: string; objectives: string } {
    return { motivation: this.motivation, objectives: this.objectives };
  }

  /** The same project under another name, or null for one with nothing in it. */
  renamed(name: string): Project | null {
    return Project.create({ ...this.stored(), name });
  }

  /** The same project with a new description. The text is kept exactly as written. */
  described(motivation: string, objectives: string): Project {
    return new Project(this.id, this.name, text(motivation), text(objectives), this.defaultProfileId);
  }

  /** The same project starting its recordings under another profile. */
  withDefaultProfile(defaultProfileId: string): Project | null {
    return Project.create({ ...this.stored(), defaultProfileId });
  }

  /** The project as it is written down. */
  stored(): StoredProject {
    return {
      id: this.id,
      name: this.name,
      motivation: this.motivation,
      objectives: this.objectives,
      defaultProfileId: this.defaultProfileId,
    };
  }
}

/** A free-text field: whatever a string holds, nothing for anything else. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The project the app always has. Here so the Default's identity has one spelling. */
export function defaultProject(): Project {
  return Project.create({
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    defaultProfileId: Profiles.DEFAULT_ID,
  })!;
}