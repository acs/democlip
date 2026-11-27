// A project's overview: what it is for, how far along it is, and every recording it holds.
//
// The description is the project's own words — its motivation and objectives — and stands
// in for a structured plan until one exists. The progress is derived from the recordings:
// the open one is in progress, every other is finished.
//
// The overview names no rule: it asks the recordings use case for the list and the counts,
// and hands every press to the flow. It refreshes when the clip changes, because the view
// listens rather than being re-rendered by whoever caused the change.

import { el } from '../dom.js';
import { t } from '../i18n/index.js';
import type { RecordingProgress, RecordingSummary } from '../../application/recordings.js';
import type { Project } from '../../domain/project/Project.js';
import { Projects } from '../../domain/project/Projects.js';
import type { StorageReading } from '../../infra/storage.js';
import { formatLength, recordingRows } from './recording-rows.js';
import { storageLine } from './storage-line.js';

export interface ProjectOverviewHandlers {
  projects(): Projects;
  project(id: string): Project | null;
  list(projectId: string): Promise<RecordingSummary[]>;
  progress(recordings: readonly RecordingSummary[]): RecordingProgress;
  /** What the browser says about the app's storage, or null when it will not say. */
  storage(): Promise<StorageReading | null>;
  open(recordingId: string): Promise<void>;
  move(recordingId: string, projectId: string): Promise<void>;
  remove(recordingId: string): Promise<void>;
  delete(recordingId: string): Promise<void>;
}

const NO_HANDLERS: ProjectOverviewHandlers = {
  projects: () => Projects.starting(),
  project: () => null,
  list: async () => [],
  progress: recordings => ({ total: recordings.length, finished: 0, inProgress: 0 }),
  storage: async () => null,
  open: async () => {},
  move: async () => {},
  remove: async () => {},
  delete: async () => {},
};

class ProjectOverview {
  private id: string | null = null;
  private handlers: ProjectOverviewHandlers = NO_HANDLERS;
  private renderToken = 0;

  get isOpen(): boolean {
    return el.projectOvBd.classList.contains('on');
  }

  init(handlers: ProjectOverviewHandlers): void {
    this.handlers = handlers;
    el.projectOvClose.addEventListener('click', () => this.close());
    el.projectOvBd.addEventListener('click', event => {
      if (event.target === el.projectOvBd) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  async open(projectId: string): Promise<void> {
    this.id = projectId;
    el.projectOvBd.classList.add('on');
    await this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    el.projectOvBd.classList.remove('on');
    this.id = null;
  }

  refresh(): void {
    if (this.isOpen) void this.render();
  }

  private async render(): Promise<void> {
    if (!this.id) return;
    const token = ++this.renderToken;
    const project = this.handlers.project(this.id);
    if (!project) { this.close(); return; }
    const [recordings, storage] = await Promise.all([this.handlers.list(this.id), this.handlers.storage()]);
    if (token !== this.renderToken || !this.isOpen) return; // a newer render won
    const progress = this.handlers.progress(recordings);
    const book = this.handlers.projects();

    el.projectOvTitle.textContent = project.name;
    const description = [project.motivation, project.objectives].filter(line => line.trim() !== '');
    el.projectOvDesc.textContent = description.length
      ? description.join('\n')
      : t('project.overview.noDescription');

    if (progress.total === 0) {
      el.projectOvProgress.textContent = t('project.overview.none');
      el.projectOvStamp.hidden = true;
    } else {
      el.projectOvProgress.textContent = t('project.overview.progress', { finished: progress.finished, total: progress.total });
      el.projectOvStamp.hidden = progress.finished !== progress.total;
      el.projectOvStamp.textContent = progress.finished === progress.total
        ? t('project.overview.allFinished')
        : '';
    }

    const line = storageLine(storage);
    el.projectOvStorage.hidden = !line;
    el.projectOvStorage.textContent = line ? t('project.overview.storage', line) : '';

    const rows = recordingRows(recordings, project.name, Projects.DEFAULT_ID);
    el.projectOvList.replaceChildren(...rows.map(row => this.row(row, book, project)));
    el.projectOvEmpty.hidden = rows.length > 0;
  }

  private row(
    row: ReturnType<typeof recordingRows>[number],
    book: Projects,
    project: Project,
  ): HTMLElement {
    const host = document.createElement('li');
    host.className = 'proj-row';
    host.dataset.id = row.id;

    const main = document.createElement('div');
    main.className = 'proj-row-main';
    const title = document.createElement('span');
    title.className = 'proj-row-title';
    title.textContent = row.title;
    const meta = document.createElement('span');
    meta.className = 'proj-row-meta';
    meta.textContent = t('project.overview.rowMeta', {
      length: formatLength(row.seconds),
      state: t(row.state === 'in-progress' ? 'project.state.inProgress' : 'project.state.finished'),
      profile: row.profileName,
    });
    main.append(title, meta);

    const acts = document.createElement('div');
    acts.className = 'proj-row-acts';
    acts.append(this.button(t('project.overview.open'), () => void this.handlers.open(row.id)));

    const move = document.createElement('select');
    move.className = 'proj-row-move pdef-select';
    move.setAttribute('aria-label', t('project.overview.moveAria', { title: row.title }));
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('project.overview.move');
    move.append(placeholder);
    for (const other of book.all) {
      if (other.id === project.id) continue;
      const option = document.createElement('option');
      option.value = other.id;
      option.textContent = other.name;
      move.append(option);
    }
    move.addEventListener('change', () => {
      const to = move.value;
      move.value = '';
      if (to) void this.handlers.move(row.id, to);
    });
    acts.append(move);

    if (!row.inDefault) {
      acts.append(this.button(t('project.overview.remove'), () => void this.handlers.remove(row.id), 'danger'));
    } else {
      acts.append(this.button(t('project.overview.delete'), () => void this.handlers.delete(row.id), 'danger'));
    }

    host.append(main, acts);
    return host;
  }

  private button(label: string, press: () => void, kind?: 'danger'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind === 'danger' ? 'proj-btn proj-btn-danger' : 'proj-btn';
    button.textContent = label;
    button.addEventListener('click', press);
    return button;
  }
}

export const projectOverview = new ProjectOverview();