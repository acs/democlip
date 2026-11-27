// The projects use case: reading the book in, creating, selecting, editing and removing.
//
// The rules about a project and about several of them live in `src/domain/project/`;
// what is left here is the two things the domain cannot know — whether the sitting
// session has begun to capture, and where the book is written down. Every change goes
// through the domain and is saved, so the app's state and the kept state move together.
//
// Removing a project does not touch recordings: those belong to the recordings use case.
// The caller removes the project from the book first and moves its recordings to Default,
// in that order, so an interruption can only leave a recording pointing at a project that
// is gone — which reads as Default.

import { Project } from '../domain/project/Project.js';
import { Projects } from '../domain/project/Projects.js';
import type { ProjectStorePort } from './ports/ProjectStorePort.js';

/** What a project operation answers: the change, or a reason it was refused. */
export type ProjectResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export interface ProjectDeps {
  readonly store: ProjectStorePort;
  /** Has the sitting session begun to capture? The app answers with the session's own latch. */
  readonly capturing: () => boolean;
  /** A fresh id for a new project — the caller's source. */
  readonly newId: () => string;
  /** Does the profile book hold this profile? */
  readonly hasProfile: (id: string) => boolean;
  /** The id of the app's built-in profile, handed in so the domain holds no duplication. */
  readonly defaultProfileId: string;
  /** Something went wrong that the person need not be stopped for. */
  readonly warn?: (error: unknown) => void;
}

const LOCKED = 'A project is fixed once recording has started — press New to start another session.';

export class ManageProjects {
  private book: Projects = Projects.starting();
  private storedAtLoad = false;

  constructor(private readonly deps: ProjectDeps) {}

  /** The book in hand: what the list shows and what the draft's project comes from. */
  get current(): Projects {
    return this.book;
  }

  /** Was there a written book when the app last read one? A fresh install has none. */
  get wasStored(): boolean {
    return this.storedAtLoad;
  }

  /** Read the written book in. A failure leaves the app on its built-in Empty profile. */
  async load(): Promise<Projects> {
    let stored = null;
    try {
      stored = await this.deps.store.load();
    } catch (error) {
      this.deps.warn?.(error);
    }
    this.storedAtLoad = !!stored;
    this.book = Projects.of(stored);
    return this.book;
  }

  /**
   * A new project. It joins the list; it becomes current only when the session has not
   * begun to capture — a project created mid-session must not move the clip under itself.
   */
  create(input: { name: string; motivation?: string; objectives?: string }): ProjectResult<{ id: string; current: boolean }> {
    const id = this.deps.newId();
    const project = Project.create({
      id,
      name: input.name,
      motivation: input.motivation,
      objectives: input.objectives,
      defaultProfileId: this.deps.defaultProfileId,
    });
    if (!project) return { ok: false, reason: 'a project needs a name' };
    const added = this.book.create(project);
    if (!added) return { ok: false, reason: 'that project name is already used' };
    const becomesCurrent = !this.deps.capturing();
    const next = becomesCurrent ? added.select(id)! : added;
    return this.commit(next, { id, current: becomesCurrent });
  }

  /** Make a project current. Refused once the session has begun to capture. */
  select(id: string): ProjectResult<{ currentId: string }> {
    if (this.book.currentId === id) return { ok: true, currentId: id };
    if (this.deps.capturing()) return { ok: false, reason: LOCKED };
    const next = this.book.select(id);
    if (!next) return { ok: false, reason: `there is no project called ${id}` };
    return this.commit(next, { currentId: id });
  }

  /**
   * Make a project current without the capture check: the app is following a recording it
   * just opened, not moving a clip that is being made.
   */
  selectNow(id: string): ProjectResult<{ currentId: string }> {
    const next = this.book.select(id);
    if (!next) return { ok: false, reason: `there is no project called ${id}` };
    return this.commit(next, { currentId: id });
  }

  /** Change a project's name, description or default profile. */
  edit(id: string, input: {
    name?: string;
    motivation?: string;
    objectives?: string;
    defaultProfile?: string;
  }): ProjectResult<{ project: Project }> {
    if (!this.book.has(id)) return { ok: false, reason: `there is no project called ${id}` };

    let next = this.book;
    if (input.name !== undefined) {
      if (id === Projects.DEFAULT_ID) return { ok: false, reason: 'the Default project cannot be renamed' };
      if (input.name.trim() === '') return { ok: false, reason: 'a project needs a name' };
      const renamed = next.rename(id, input.name);
      if (!renamed) return { ok: false, reason: 'that project name is already used' };
      next = renamed;
    }
    if (input.motivation !== undefined || input.objectives !== undefined) {
      const project = next.get(id)!;
      const described = next.describe(
        id,
        input.motivation ?? project.motivation,
        input.objectives ?? project.objectives,
      )!;
      next = described;
    }
    if (input.defaultProfile !== undefined) {
      if (!this.deps.hasProfile(input.defaultProfile)) {
        return { ok: false, reason: `there is no profile called ${input.defaultProfile}` };
      }
      const changed = next.setDefaultProfile(id, input.defaultProfile);
      if (!changed) return { ok: false, reason: 'that profile cannot be the project default' };
      next = changed;
    }
    return this.commit(next, { project: next.get(id)! });
  }

  /**
   * Take a project away. The caller moves its recordings to Default; this refuses the
   * Default project and one that is not here.
   */
  remove(id: string): ProjectResult<{ currentId: string }> {
    if (id === Projects.DEFAULT_ID) return { ok: false, reason: 'the Default project cannot be removed' };
    const next = this.book.remove(id);
    if (!next) return { ok: false, reason: `there is no project called ${id}` };
    return this.commit(next, { currentId: next.currentId });
  }

  /** The profile a project's recordings start under, resolved; the built-in Empty profile when gone. */
  defaultProfileOf(project: Project): string {
    return this.deps.hasProfile(project.defaultProfileId)
      ? project.defaultProfileId
      : this.deps.defaultProfileId;
  }

  /** Take a change the domain allowed: hold it, write the book down, and answer it. */
  private commit<T>(next: Projects, value: T): ProjectResult<T> {
    this.book = next;
    void this.deps.store.save(next.stored()).catch(error => this.deps.warn?.(error));
    return { ...value, ok: true } as ProjectResult<T>;
  }
}