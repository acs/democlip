import { describe, expect, it } from 'vitest';

import { ManageProjects } from './projects.js';
import { Projects } from '../domain/project/Projects.js';
import type { ProjectStorePort } from './ports/ProjectStorePort.js';
import type { StoredProjects } from '../domain/project/Projects.js';

class FakeStore implements ProjectStorePort {
  state: StoredProjects | null = null;
  saves = 0;
  async load(): Promise<StoredProjects | null> { return this.state; }
  async save(state: StoredProjects): Promise<void> { this.state = state; this.saves++; }
}

const build = (options: { capturing?: boolean; profiles?: string[] } = {}) => {
  let capturing = options.capturing ?? false;
  const store = new FakeStore();
  const profiles = new Set(options.profiles ?? ['default', 'tv']);
  let n = 0;
  const projects = new ManageProjects({
    store,
    capturing: () => capturing,
    newId: () => `p${++n}`,
    hasProfile: id => profiles.has(id),
    defaultProfileId: 'default',
  });
  return {
    projects,
    store,
    setCapturing: (value: boolean) => { capturing = value; },
  };
};

describe('ManageProjects', () => {
  it('starts on Default and creates a project that becomes current', () => {
    const { projects } = build();

    const outcome = projects.create({ name: 'Launch', motivation: 'Why', objectives: 'What' });

    expect(outcome).toEqual({ ok: true, id: 'p1', current: true });
    expect(projects.current.currentId).toBe('p1');
    expect(projects.current.get('p1')!.description()).toEqual({ motivation: 'Why', objectives: 'What' });
  });

  it('refuses a name already used, and a name with nothing in it', () => {
    const { projects } = build();
    projects.create({ name: 'Launch' });

    expect(projects.create({ name: '  launch ' })).toEqual({ ok: false, reason: 'that project name is already used' });
    expect(projects.create({ name: '  ' })).toEqual({ ok: false, reason: 'a project needs a name' });
  });

  it('adds a project mid-session without making it current', () => {
    const { projects, setCapturing } = build();
    setCapturing(true);

    const outcome = projects.create({ name: 'Launch' });

    expect(outcome).toEqual({ ok: true, id: 'p1', current: false });
    expect(projects.current.currentId).toBe(Projects.DEFAULT_ID);
    expect(projects.current.has('p1')).toBe(true);
  });

  it('selects a project until capture begins; selecting the current one is always fine', () => {
    const { projects, setCapturing } = build();
    projects.create({ name: 'Launch' });
    projects.select(Projects.DEFAULT_ID);
    setCapturing(true);

    expect(projects.select('p1')).toEqual({
      ok: false,
      reason: 'A project is fixed once recording has started — press New to start another session.',
    });
    expect(projects.select(Projects.DEFAULT_ID).ok).toBe(true);
    expect(projects.select('gone').ok).toBe(false);
  });

  it('edits the description, the name and the default profile', () => {
    const { projects } = build();
    projects.create({ name: 'Launch' });

    const edited = projects.edit('p1', {
      name: 'Launch video',
      motivation: 'Why',
      objectives: 'What',
      defaultProfile: 'tv',
    });

    expect(edited.ok).toBe(true);
    const project = projects.current.get('p1')!;
    expect(project.name).toBe('Launch video');
    expect(project.description()).toEqual({ motivation: 'Why', objectives: 'What' });
    expect(project.defaultProfileId).toBe('tv');
  });

  it('refuses to rename Default, an empty name, a taken name or an unknown profile', () => {
    const { projects } = build();
    projects.create({ name: 'Launch' });
    projects.create({ name: 'Series' });

    expect(projects.edit(Projects.DEFAULT_ID, { name: 'Mine' })).toEqual({
      ok: false,
      reason: 'the Default project cannot be renamed',
    });
    expect(projects.edit('p1', { name: '  ' }).ok).toBe(false);
    expect(projects.edit('p1', { name: 'Series' }).ok).toBe(false);
    expect(projects.edit('p1', { defaultProfile: 'gone' })).toEqual({
      ok: false,
      reason: 'there is no profile called gone',
    });
  });

  it('refuses the Default project’s removal, and falls back to it when the current one goes', () => {
    const { projects } = build();
    projects.create({ name: 'Launch' });

    expect(projects.remove(Projects.DEFAULT_ID).ok).toBe(false);
    expect(projects.remove('p1')).toEqual({ ok: true, currentId: Projects.DEFAULT_ID });
    expect(projects.current.has('p1')).toBe(false);
  });

  it('resolves a project’s default profile, falling back when it is gone', () => {
    const { projects } = build();
    projects.create({ name: 'Launch' });
    projects.edit('p1', { defaultProfile: 'tv' });

    expect(projects.defaultProfileOf(projects.current.get('p1')!)).toBe('tv');

    const gone = projects.current.get('p1')!.withDefaultProfile('removed')!;
    expect(projects.defaultProfileOf(gone)).toBe('default');
  });

  it('reads the written book in, and repairs what it cannot use', async () => {
    const { projects, store } = build();
    store.state = {
      version: 1,
      currentId: 'gone',
      projects: [
        { id: 'p1', name: 'Launch', motivation: '', objectives: '', defaultProfileId: 'default' },
      ],
    };

    await projects.load();

    expect(projects.current.currentId).toBe(Projects.DEFAULT_ID);
    expect(projects.current.has('p1')).toBe(true);
  });

  it('holds a change and writes the book down', () => {
    const { projects, store } = build();
    projects.create({ name: 'Launch' });

    expect(store.saves).toBe(1);
    expect(store.state!.projects.map(project => project.name)).toEqual(['Default', 'Launch']);
  });
});
describe('ManageProjects — reading the book in', () => {
  it('knows whether a written book was there, so a fresh install can adopt the active profile', async () => {
    const { projects, store } = build();
    await projects.load();
    expect(projects.wasStored).toBe(false);

    store.state = projects.current.stored();
    await projects.load();
    expect(projects.wasStored).toBe(true);
  });
});
