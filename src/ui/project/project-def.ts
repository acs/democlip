// A project's own dialog: what it is called, what it is for, and the profile its recordings
// start under.
//
// The list only selects, opens the overview and creates; everything about a project is set
// here, as a profile's name and items are set in its own sheet. The Default project's name
// is the app's and is not editable; its description and default profile are the person's.

import { el } from '../dom.js';
import { t } from '../i18n/index.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { Projects } from '../../domain/project/Projects.js';

export interface ProjectDraft {
  readonly name: string;
  readonly motivation: string;
  readonly objectives: string;
  readonly defaultProfile: string;
}

export interface ProjectDefHandlers {
  /** The profile book, for the default-profile list. */
  profiles(): Profiles;
  /** Create a project; answers false when it could not (the flow has said why). */
  create(input: ProjectDraft): Promise<boolean>;
  /** Change one; answers false when it could not (the flow has said why). */
  edit(id: string, input: ProjectDraft): Promise<boolean>;
  /** The book in hand, so the dialog can read the project it is on. */
  list(): Projects;
}

const NO_HANDLERS: ProjectDefHandlers = {
  profiles: () => Profiles.starting(),
  create: async () => false,
  edit: async () => false,
  list: () => Projects.starting(),
};

class ProjectDef {
  private id: string | null = null;
  private creating = false;
  private handlers: ProjectDefHandlers = NO_HANDLERS;

  get isOpen(): boolean {
    return el.projectDefBd.classList.contains('on');
  }

  init(handlers: ProjectDefHandlers): void {
    this.handlers = handlers;
    el.projectDefDone.addEventListener('click', () => void this.save());
    el.projectDefBd.addEventListener('click', event => {
      if (event.target === el.projectDefBd) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  /** Open it on one project, or on none for a new one. */
  open(id: string | null): void {
    this.id = id;
    this.creating = id === null;
    this.render();
    el.projectDefBd.classList.add('on');
  }

  close(): void {
    if (!this.isOpen) return;
    el.projectDefBd.classList.remove('on');
    this.id = null;
    this.creating = false;
  }

  private render(): void {
    const book = this.handlers.list();
    const project = this.id ? book.get(this.id) : null;
    const profiles = this.handlers.profiles();
    el.projectDefTitle.textContent = project ? project.name : t('project.def.new');
    el.projectDefDone.textContent = project ? t('common.done') : t('project.def.create');

    const name = this.field(t('project.def.name'), 'input');
    name.value = project?.name ?? '';
    name.disabled = project?.id === Projects.DEFAULT_ID;
    name.placeholder = t('project.def.namePlaceholder');

    const motivation = this.field(t('project.def.motivation'), 'textarea');
    motivation.value = project?.motivation ?? '';
    motivation.placeholder = t('project.def.motivationPlaceholder');

    const objectives = this.field(t('project.def.objectives'), 'textarea');
    objectives.value = project?.objectives ?? '';
    objectives.placeholder = t('project.def.objectivesPlaceholder');

    const profile = document.createElement('select');
    profile.className = 'pdef-select';
    profile.setAttribute('aria-label', t('project.def.defaultProfile'));
    for (const one of profiles.all) {
      const option = document.createElement('option');
      option.value = one.id;
      option.textContent = one.name;
      profile.append(option);
    }
    profile.value = project?.defaultProfileId ?? Profiles.DEFAULT_ID;

    const profileField = document.createElement('label');
    profileField.className = 'pdef-row';
    const label = document.createElement('span');
    label.className = 'pdef-name';
    label.textContent = t('project.def.defaultProfile');
    profileField.append(label, profile);

    el.projectDefRows.replaceChildren(name.parentElement!, motivation.parentElement!, objectives.parentElement!, profileField);
  }

  private field(labelText: string, kind: 'input' | 'textarea'): HTMLInputElement | HTMLTextAreaElement {
    const host = document.createElement('label');
    host.className = 'pdef-row';
    const label = document.createElement('span');
    label.className = 'pdef-name';
    label.textContent = labelText;
    const field = kind === 'input'
      ? document.createElement('input')
      : document.createElement('textarea');
    field.className = 'pdef-input';
    if (field instanceof HTMLTextAreaElement) field.rows = 2;
    field.setAttribute('aria-label', labelText);
    host.append(label, field);
    return field;
  }

  private draft(): ProjectDraft {
    const inputs = el.projectDefRows.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.pdef-input');
    const [name, motivation, objectives] = [...inputs];
    const profile = el.projectDefRows.querySelector<HTMLSelectElement>('select.pdef-select');
    return {
      name: name?.value ?? '',
      motivation: motivation?.value ?? '',
      objectives: objectives?.value ?? '',
      defaultProfile: profile?.value ?? Profiles.DEFAULT_ID,
    };
  }

  private async save(): Promise<void> {
    const input = this.draft();
    const ok = this.creating
      ? await this.handlers.create(input)
      : await this.handlers.edit(this.id!, input);
    if (ok) this.close();
  }
}

export const projectDef = new ProjectDef();