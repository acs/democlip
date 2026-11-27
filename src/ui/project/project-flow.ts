// The project flow: the projects and recordings use cases composed with the app.
//
// It is the one place the two meet the session, the stores and the profile book. The rules
// live in `src/domain/project/`, `src/domain/clip/ClipProfile.ts` and the two use cases;
// what is here is the wiring — the browser's id source and stores, the current project, the
// profile a project's recordings start under, the toolbar pill, and the three surfaces that
// show and define projects.

import { AdoptRecording } from '../../application/adopt-recording.js';
import { ManageProjects } from '../../application/projects.js';
import { Recordings } from '../../application/recordings.js';
import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { Projects } from '../../domain/project/Projects.js';
import type { Project } from '../../domain/project/Project.js';
import { session } from '../../session.js';
import { projectStore } from '../../infra/project-store.js';
import { recordingStore } from '../../infra/recording-store.js';
import { images } from '../../infra/images.js';
import { setPhase } from '../../state.js';
import { el, toast } from '../dom.js';
import { t } from '../i18n/index.js';
import { applyProfile, paintProfileButton, profiles } from '../profile/profile-flow.js';
import { avatarLetters } from '../profile/profile-rows.js';
import { paintPill } from '../shell/pill.js';
import { createProjectsSurface } from '../agent/projects.js';
import type { ProjectsSurface } from '../agent/surface.js';
import { openReview } from '../clip/review-flow.js';
import { syncWatermark } from '../clip/watermark.js';
import { projectMenu, projectTone } from './project-menu.js';
import { projectDef, type ProjectDraft } from './project-def.js';
import { projectOverview } from './project-overview.js';

export const projects = new ManageProjects({
  store: projectStore,
  capturing: () => session.hasCaptured || !session.clip.takes.isEmpty(),
  newId: () => crypto.randomUUID(),
  hasProfile: id => profiles.current.has(id),
  defaultProfileId: Profiles.DEFAULT_ID,
  warn: error => console.warn('DemoClip: could not keep the projects —', error),
});

/** How many recordings each project holds, kept for the menu's rows. */
const counts = new Map<string, number>();

async function refreshProjectCounts(): Promise<void> {
  counts.clear();
  for (const recording of await recordings.list()) {
    counts.set(recording.projectId, (counts.get(recording.projectId) ?? 0) + 1);
  }
}

export const recordings = new Recordings({
  store: recordingStore,
  clip: session.clip,
  session,
  newId: () => crypto.randomUUID(),
  now: () => Date.now(),
  hasProject: id => projects.current.has(id),
  warn: error => console.warn('DemoClip: could not keep the recording —', error),
});

/**
 * The profile a project's recordings start under: the one it names, or the built-in
 * Default when that profile is gone. Never null — the app always has a profile.
 */
export function defaultProfileFor(project: Project): ClipProfile {
  const live = profiles.current.get(projects.defaultProfileOf(project)) ?? profiles.current.active();
  return ClipProfile.of(live);
}

/** Read the written project book in. A failure leaves the app on its built-in Default. */
export async function loadProjects(): Promise<void> {
  const activeProfile = profiles.current.activeId;
  await projects.load();
  // The first start after projects exist: the profile the person was working under becomes
  // the Default project's default, so their production environment survives the update.
  if (!projects.wasStored && activeProfile !== Profiles.DEFAULT_ID) {
    projects.edit(Projects.DEFAULT_ID, { defaultProfile: activeProfile });
  }
}

/** Adopt the previous version's one clip, before the app looks for a recording to resume. */
export async function adoptLegacyRecording(): Promise<void> {
  const adopt = new AdoptRecording({
    store: recordingStore,
    now: () => Date.now(),
    warn: error => console.warn('DemoClip: could not adopt the old recording —', error),
  });
  const outcome = await adopt.run();
  if (outcome.kind === 'failed') console.warn('DemoClip: the old recording was not adopted —', outcome.reason);
}

/** Wire the project pill, the list, the project dialog and the overview. */
export function initProjects(): void {
  projectMenu.init({
    list: () => projects.current,
    counts: () => counts,
    locked: () => session.hasCaptured || !session.clip.takes.isEmpty(),
    choose: id => void selectProject(id),
    define: id => projectDef.open(id),
    overview: id => void projectOverview.open(id),
    remove: id => void removeProject(id),
    create: () => projectDef.open(null),
  });
  projectDef.init({
    profiles: () => profiles.current,
    list: () => projects.current,
    create: createProject,
    edit: editProject,
  });
  projectOverview.init({
    projects: () => projects.current,
    project: id => projects.current.get(id),
    list: id => recordings.listProject(id),
    progress: list => recordings.progressFor(list),
    open: openRecording,
    move: moveRecording,
    remove: removeRecording,
    delete: deleteRecording,
  });

  el.projectBtn.addEventListener('click', () => projectMenu.toggle());
  session.clip.onChange(() => {
    paintProjectButton();
    void refreshProjectCounts().then(() => projectMenu.refresh());
    projectOverview.refresh();
  });
  paintProjectButton();
  void refreshProjectCounts().then(() => projectMenu.refresh());
}

/** The toolbar pill wears the current project's first letters, and names it in its tooltip. */
export function paintProjectButton(): void {
  const project = projects.current.current();
  el.projectInitials.textContent = avatarLetters(project.name);
  paintPill(el.projectBtn, { colour: null, tone: projectTone(project.id) });
  const label = t('project.flow.fixedAria', { name: project.name });
  el.projectBtn.setAttribute('aria-label', label);
  el.projectBtn.title = label;
}

/** Make a project current, and — before capture — move the open draft into it. */
async function selectProject(id: string): Promise<void> {
  const outcome = projects.select(id);
  if (!outcome.ok) { toast(outcome.reason); return; }
  const project = projects.current.get(id);
  if (project && !session.hasCaptured && session.clip.takes.isEmpty()) {
    const moved = await recordings.selectProject(id, defaultProfileFor(project));
    if (!moved.ok) toast(moved.reason);
    else applyProfile();
  }
  paintProjectButton();
  void refreshProjectCounts().then(() => projectMenu.refresh());
  projectOverview.refresh();
}

/** Create a project from the dialog, with the default profile it was given. */
async function createProject(input: ProjectDraft): Promise<boolean> {
  const outcome = projects.create({
    name: input.name,
    motivation: input.motivation,
    objectives: input.objectives,
  });
  if (!outcome.ok) { toast(outcome.reason); return false; }
  if (input.defaultProfile !== projects.current.get(outcome.id)?.defaultProfileId) {
    projects.edit(outcome.id, { defaultProfile: input.defaultProfile });
  }
  if (outcome.current) await selectProject(outcome.id);
  paintProjectButton();
  void refreshProjectCounts().then(() => projectMenu.refresh());
  projectOverview.refresh();
  return true;
}

/** Change a project from its dialog. Its Default name is the app's and is not passed. */
async function editProject(id: string, input: ProjectDraft): Promise<boolean> {
  const changes: Parameters<ManageProjects['edit']>[1] = {
    motivation: input.motivation,
    objectives: input.objectives,
    defaultProfile: input.defaultProfile,
  };
  if (id !== Projects.DEFAULT_ID) changes.name = input.name;
  const outcome = projects.edit(id, changes);
  if (!outcome.ok) { toast(outcome.reason); return false; }
  if (id === projects.current.currentId && !session.hasCaptured && session.clip.takes.isEmpty()) {
    await selectProject(id);
  }
  paintProjectButton();
  void refreshProjectCounts().then(() => projectMenu.refresh());
  projectOverview.refresh();
  return true;
}

/** Remove a project: its recordings move to Default, its own words are lost. */
async function removeProject(id: string): Promise<void> {
  if (id === Projects.DEFAULT_ID) return;
  const project = projects.current.get(id);
  if (!project) return;
  if (session.projectId === id && (session.hasCaptured || !session.clip.takes.isEmpty())) {
    toast(t('project.flow.belongs'));
    return;
  }
  const recordingsIn = await recordings.listProject(id);
  if (!window.confirm(t('project.flow.confirmRemove', { name: project.name }))) return;

  const wasCurrent = projects.current.currentId === id;
  const removed = projects.remove(id);
  if (!removed.ok) { toast(removed.reason); return; }
  for (const recording of recordingsIn) {
    const moved = await recordings.move(recording.id, Projects.DEFAULT_ID);
    if (!moved.ok) toast(moved.reason);
  }
  if (wasCurrent && !session.hasCaptured && session.clip.takes.isEmpty()) {
    const next = projects.current.current();
    await recordings.selectProject(next.id, defaultProfileFor(next));
    applyProfile();
  }
  paintProjectButton();
  void refreshProjectCounts().then(() => projectMenu.refresh());
  projectOverview.refresh();
}

/** Open a recording from the overview: it resumes as a session, takes included. */
async function openRecording(id: string): Promise<void> {
  const outcome = await recordings.openRecording(id);
  if (!outcome.ok) { toast(outcome.reason); return; }
  const project = (await recordings.list()).find(recording => recording.id === id)?.projectId;
  // Opening a recording is not choosing a project for a clip being made: the book follows
  // the recording, even though the restored clip already holds takes.
  if (project) projects.selectNow(project);
  images.setRecording(id);
  await images.load();
  await syncWatermark('picture');
  projectOverview.close();
  projectMenu.close();
  paintProjectButton();
  paintProfileButton();
  setPhase('review');
  await openReview(0, 0);
}

async function moveRecording(id: string, projectId: string): Promise<void> {
  const outcome = await recordings.move(id, projectId);
  if (!outcome.ok) toast(outcome.reason);
  projectOverview.refresh();
  void refreshProjectCounts().then(() => projectMenu.refresh());
}

async function removeRecording(id: string): Promise<void> {
  const outcome = await recordings.remove(id);
  if (!outcome.ok) toast(outcome.reason);
  projectOverview.refresh();
  void refreshProjectCounts().then(() => projectMenu.refresh());
}

async function deleteRecording(id: string): Promise<void> {
  const recording = (await recordings.list()).find(one => one.id === id);
  if (!recording) return;
  const label = recording.title.trim() || t('project.flow.thisRecording');
  if (!window.confirm(t('project.flow.confirmDelete', { label }))) return;
  const wasOpen = session.recordingId === id;
  const outcome = await recordings.delete(id);
  if (!outcome.ok) { toast(outcome.reason); return; }
  if (wasOpen) {
    const project = projects.current.current();
    await recordings.startFresh(project.id, defaultProfileFor(project));
    images.setRecording(session.recordingId);
    applyProfile();
    setPhase('idle');
  }
  projectOverview.refresh();
  void refreshProjectCounts().then(() => projectMenu.refresh());
}

/** The projects an agent may drive: the same use cases a hand drives. */
export function createAgentProjects(): ProjectsSurface {
  return createProjectsSurface({
    list: () => projects.current,
    recordings: () => recordings.list(),
    progress: list => recordings.progressFor(list),
    defaultProfile: project => {
      const profile = defaultProfileFor(project);
      return { id: profile.id, name: profile.name };
    },
    create: async input => {
      const outcome = projects.create(input);
      if (!outcome.ok) return outcome;
      if (outcome.current) await selectProject(outcome.id);
      return outcome;
    },
    select: async id => {
      if (id === projects.current.currentId) return { ok: true, currentId: id };
      const outcome = projects.select(id);
      if (!outcome.ok) return outcome;
      const project = projects.current.get(id);
      if (project && !session.hasCaptured && session.clip.takes.isEmpty()) {
        await recordings.selectProject(id, defaultProfileFor(project));
        applyProfile();
      }
      paintProjectButton();
      projectMenu.refresh();
      projectOverview.refresh();
      return { ok: true, currentId: id };
    },
    edit: async (id, input) => {
      // The agent may name a profile instead of knowing its id; the book resolves it.
      let resolved = input;
      const wanted = input.defaultProfile;
      if (wanted && !profiles.current.has(wanted)) {
        const byName = profiles.current.all.find(one =>
          one.name.toLocaleLowerCase() === wanted.trim().toLocaleLowerCase());
        if (byName) resolved = { ...input, defaultProfile: byName.id };
      }
      const outcome = projects.edit(id, resolved);
      if (!outcome.ok) return outcome;
      if (id === projects.current.currentId && !session.hasCaptured && session.clip.takes.isEmpty()) {
        await recordings.selectProject(id, defaultProfileFor(outcome.project));
        applyProfile();
      }
      paintProjectButton();
      projectMenu.refresh();
      projectOverview.refresh();
      return outcome;
    },
    move: async (recordingId, projectId) => {
      const outcome = await recordings.move(recordingId, projectId);
      projectMenu.refresh();
      projectOverview.refresh();
      return outcome.ok ? { ok: true, projectId: outcome.projectId } : outcome;
    },
  });
}
