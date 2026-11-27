// The projects an agent may drive: list, read, create, select, edit and move.
//
// It adds no rule of its own. Every operation asks the same use case a button asks, and every
// refusal is the use case's own words. There is deliberately no deletion here and no way to
// remove a project: those need the person's confirmation, and the tool list is the boundary
// (contracts/mcp-tools.md).
//
// It is free of the DOM, so it is proved in node with a fake behind the same shape.

import type { Project } from '../../domain/project/Project.js';
import type { Projects } from '../../domain/project/Projects.js';
import type { RecordingProgress, RecordingSummary } from '../../application/recordings.js';
import { recordingLabel } from '../project/recording-rows.js';
import type {
  ProjectProgress,
  ProjectSummary,
  ProjectsSurface,
  RecordingSummary as AgentRecording,
  Result,
} from './surface.js';

export interface ProjectAgentDeps {
  readonly list: () => Projects;
  /** Every recording, so the counts and the reads come from one answer. */
  readonly recordings: () => Promise<RecordingSummary[]>;
  readonly progress: (recordings: readonly RecordingSummary[]) => RecordingProgress;
  readonly defaultProfile: (project: Project) => { id: string; name: string };
  readonly create: (input: { name: string; motivation?: string; objectives?: string }) => Promise<Result<{ id: string; current: boolean }>>;
  readonly select: (id: string) => Promise<Result<{ currentId: string }>>;
  readonly edit: (id: string, input: { name?: string; motivation?: string; objectives?: string; defaultProfile?: string }) => Promise<Result<{ project: Project }>>;
  readonly move: (recordingId: string, projectId: string) => Promise<Result<{ projectId: string }>>;
}

export function createProjectsSurface(deps: ProjectAgentDeps): ProjectsSurface {
  const summary = (project: Project, book: Projects, count: number): ProjectSummary => ({
    id: project.id,
    name: project.name,
    motivation: project.motivation,
    objectives: project.objectives,
    defaultProfile: deps.defaultProfile(project),
    recordingCount: count,
    current: project.id === book.currentId,
  });

  const recording = (one: RecordingSummary, projectName: string): AgentRecording => ({
    id: one.id,
    title: recordingLabel(one, projectName),
    length: one.duration,
    state: one.state,
    projectId: one.projectId,
    profileName: one.profile.name,
    createdAt: one.createdAt,
  });

  return {
    async list() {
      const book = deps.list();
      const all = await deps.recordings();
      return {
        ok: true,
        currentId: book.currentId,
        projects: book.all.map(project =>
          summary(project, book, all.filter(recording => recording.projectId === project.id).length)),
      };
    },

    async read(id) {
      const book = deps.list();
      const project = book.get(id);
      if (!project) return { ok: false, reason: `there is no project called ${id}` };
      const all = await deps.recordings();
      const mine = all.filter(recording => recording.projectId === id);
      const counts = deps.progress(mine);
      return {
        ok: true,
        project: summary(project, book, mine.length),
        recordings: mine.map(one => recording(one, project.name)),
        progress: counts as ProjectProgress,
      };
    },

    create(input) {
      return deps.create(input);
    },

    select(id) {
      return deps.select(id);
    },

    async edit(id, input) {
      const outcome = await deps.edit(id, input);
      if (!outcome.ok) return outcome;
      const book = deps.list();
      const all = await deps.recordings();
      return {
        ok: true,
        project: summary(outcome.project, book, all.filter(recording => recording.projectId === id).length),
      };
    },

    async move(recordingId, projectId) {
      const outcome = await deps.move(recordingId, projectId);
      if (!outcome.ok) return outcome;
      return { ok: true, recordingId, projectId: outcome.projectId };
    },
  };
}