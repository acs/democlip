// The project menu: the toolbar pill's popover.
//
// It lists the projects, marks the one the app is in, and offers what may be done to each:
// select it, open its overview, open its own dialog, or — for the person's own projects —
// remove it. The Default project carries no bin and no rename; it is the app's own.
//
// It names no rule of its own. It asks for the book and whether the session has begun to
// capture, draws the rows from the answer, and hands every press to the flow.

import { el } from '../dom.js';
import { Projects } from '../../domain/project/Projects.js';
import type { Project } from '../../domain/project/Project.js';
import { avatarLetters, avatarTone } from '../profile/profile-rows.js';

/** A project's tone: its own, salted away from a profile that happens to share its id. */
export function projectTone(id: string): number {
  return avatarTone(`project:${id}`);
}

/** The flow's own operations, handed to the menu. Each answers nothing; the menu redraws. */
export interface ProjectMenuHandlers {
  list(): Projects;
  /** How many recordings each project holds, from the flow's last read. */
  counts(): ReadonlyMap<string, number>;
  /** Has the session begun to capture? Then another project cannot be chosen. */
  locked(): boolean;
  choose(id: string): void;
  define(id: string): void;
  overview(id: string): void;
  remove(id: string): void;
  create(): void;
}

const PENCIL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const BIN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
const LIST = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';

const GAP = 6;
const EDGE = 8;

const NO_HANDLERS: ProjectMenuHandlers = {
  list: () => Projects.starting(),
  counts: () => new Map(),
  locked: () => false,
  choose: () => {},
  define: () => {},
  overview: () => {},
  remove: () => {},
  create: () => {},
};

class ProjectMenu {
  private handlers: ProjectMenuHandlers = NO_HANDLERS;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    if (path.includes(el.projectMenu) || path.includes(el.projectBtn)) return;
    if (path.includes(el.projectDefBd) || path.includes(el.projectOvBd)) return;
    this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private readonly onViewportChange = (): void => {
    if (this.isOpen) this.place();
  };

  init(handlers: ProjectMenuHandlers): void {
    this.handlers = handlers;
  }

  get isOpen(): boolean {
    return el.projectMenu.classList.contains('on');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.render();
    el.projectMenu.classList.add('on');
    el.projectBtn.setAttribute('aria-expanded', 'true');
    this.place();
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onViewportChange);
  }

  close(): void {
    if (!this.isOpen) return;
    el.projectMenu.classList.remove('on');
    el.projectBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onViewportChange);
  }

  refresh(): void {
    if (this.isOpen) this.render();
  }

  private render(): void {
    const book = this.handlers.list();
    const locked = this.handlers.locked();
    const title = document.createElement('div');
    title.className = 'profile-title';
    title.textContent = 'Projects';

    el.projectMenu.replaceChildren(
      title,
      ...book.all.map(project => this.row(project, project.id === book.currentId, locked)),
      ...(locked ? [this.lockLine()] : []),
      this.foot(),
    );
  }

  private row(project: Project, active: boolean, locked: boolean): HTMLElement {
    const host = document.createElement('div');
    host.className = active ? 'profile-row project-row active' : 'profile-row project-row';
    host.dataset.id = project.id;

    const line = document.createElement('div');
    line.className = 'profile-line';
    line.append(this.pick(project, active, locked));
    line.append(this.acts(project, active));

    // What the project is for, and how much it holds: enough to tell two apart without
    // opening either.
    const purpose = document.createElement('div');
    purpose.className = 'project-purpose';
    purpose.textContent = project.motivation.trim() || project.objectives.trim() || 'No description yet.';

    host.append(line, purpose);
    return host;
  }

  private pick(project: Project, active: boolean, locked: boolean): HTMLElement {
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'profile-pick project-pick';
    pick.setAttribute('role', 'menuitemradio');
    pick.setAttribute('aria-checked', String(active));
    pick.disabled = locked && !active;

    const avatar = document.createElement('span');
    avatar.className = `profile-avatar project-avatar av-${projectTone(project.id)}`;
    avatar.textContent = avatarLetters(project.name);
    const name = document.createElement('span');
    name.className = 'profile-name';
    name.textContent = project.name;
    const count = document.createElement('span');
    count.className = 'project-count';
    count.textContent = String(this.handlers.counts().get(project.id) ?? 0);
    count.title = `${count.textContent} recordings`;
    const check = document.createElement('span');
    check.className = 'profile-check';
    check.textContent = active ? '✓' : '';
    pick.append(avatar, name, count, check);

    pick.addEventListener('click', () => { this.close(); this.handlers.choose(project.id); });
    return pick;
  }

  private acts(project: Project, active: boolean): HTMLElement {
    const acts = document.createElement('div');
    acts.className = 'profile-acts';
    acts.append(
      this.icon('overview', `Open the overview of ${project.name}`, LIST, true, () => {
        this.close();
        this.handlers.overview(project.id);
      }),
      this.icon('define', `Settings of ${project.name}`, PENCIL, true, () => {
        this.close();
        this.handlers.define(project.id);
      }),
    );
    if (project.id !== Projects.DEFAULT_ID) {
      acts.append(this.icon('remove', `Remove ${project.name}`, BIN, true, () => {
        this.close();
        this.handlers.remove(project.id);
      }));
    }
    // `active` is read by the row class; the acts do not depend on it.
    void active;
    return acts;
  }

  private icon(kind: string, label: string, svg: string, enabled: boolean, press: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-ico';
    button.dataset.act = kind;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = !enabled;
    button.innerHTML = svg;
    button.addEventListener('click', press);
    return button;
  }

  private lockLine(): HTMLElement {
    const line = document.createElement('div');
    line.className = 'profile-lock';
    line.textContent = 'The project is fixed until this session ends.';
    return line;
  }

  private foot(): HTMLElement {
    const foot = document.createElement('div');
    foot.className = 'profile-foot';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'profile-new-btn';
    add.textContent = 'New project';
    add.addEventListener('click', () => { this.close(); this.handlers.create(); });
    foot.append(add);
    return foot;
  }

  private place(): void {
    const pill = el.projectBtn.getBoundingClientRect();
    const width = el.projectMenu.offsetWidth;
    const height = el.projectMenu.offsetHeight;
    const below = pill.bottom + GAP;
    const above = pill.top - GAP - height;
    const top = below + height <= window.innerHeight - EDGE ? below : Math.max(EDGE, above);
    const left = Math.min(Math.max(EDGE, pill.right - width), window.innerWidth - width - EDGE);
    el.projectMenu.style.left = `${left}px`;
    el.projectMenu.style.top = `${top}px`;
    el.projectMenu.style.maxHeight = `${Math.max(120, window.innerHeight - 2 * EDGE)}px`;
  }
}

export const projectMenu = new ProjectMenu();