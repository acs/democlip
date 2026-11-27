import { describe, expect, it } from 'vitest';

import { createProjectsSurface } from './projects.js';
import { Projects } from '../../domain/project/Projects.js';
import { Project } from '../../domain/project/Project.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import type { RecordingSummary } from '../../application/recordings.js';

const project = (id: string, name: string) =>
  Project.create({ id, name, motivation: `${name} why`, objectives: `${name} what`, defaultProfileId: Profiles.DEFAULT_ID })!;

const book = (): Projects =>
  Projects.starting()
    .create(project('p1', 'Launch'))!
    .select('p1')!;

const recording = (id: string, projectId: string, state: RecordingSummary['state'] = 'finished'): RecordingSummary => ({
  id,
  projectId,
  profile: ClipProfile.DEFAULT.stored(),
  createdAt: 1_000,
  duration: 4,
  count: 1,
  title: '',
  state,
});

const build = () => {
  let current = book();
  const all = [recording('r1', 'default'), recording('r2', 'p1')];
  const calls: string[] = [];
  const surface = createProjectsSurface({
    list: () => current,
    recordings: async () => all,
    progress: recordings => ({
      total: recordings.length,
      finished: recordings.filter(one => one.state === 'finished').length,
      inProgress: recordings.filter(one => one.state === 'in-progress').length,
    }),
    defaultProfile: () => ({ id: 'default', name: 'Empty' }),
    create: async input => {
      calls.push(`create:${input.name}`);
      const created = project('p2', input.name);
      current = current.create(created)!.select('p2')!;
      return { ok: true, id: 'p2', current: true };
    },
    select: async id => {
      calls.push(`select:${id}`);
      current = current.select(id)!;
      return { ok: true, currentId: id };
    },
    edit: async (id, input) => {
      calls.push(`edit:${id}`);
      const edited = current.get(id)!.described(input.motivation ?? 'x', input.objectives ?? 'y');
      current = current.describe(id, edited.motivation, edited.objectives)!;
      return { ok: true, project: current.get(id)! };
    },
    move: async (recordingId, projectId) => {
      calls.push(`move:${recordingId}:${projectId}`);
      return { ok: true, projectId };
    },
  });
  return { surface, calls, all };
};

describe('the projects an agent drives', () => {
  it('lists every project with its description, default profile, count and which is current', async () => {
    const { surface } = build();

    const listed = await surface.list();

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.currentId).toBe('p1');
    expect(listed.projects.map(one => one.name)).toEqual(['Default', 'Launch']);
    expect(listed.projects.map(one => one.recordingCount)).toEqual([1, 1]);
    expect(listed.projects[1]).toMatchObject({
      motivation: 'Launch why',
      objectives: 'Launch what',
      defaultProfile: { id: 'default', name: 'Empty' },
      current: true,
    });
  });

  it('reads one project with its recordings and the progress', async () => {
    const { surface } = build();

    const read = await surface.read('p1');

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.project.name).toBe('Launch');
    expect(read.recordings.map(one => one.id)).toEqual(['r2']);
    expect(read.recordings[0]!.title).toContain('Launch');
    expect(read.progress).toEqual({ total: 1, finished: 1, inProgress: 0 });
  });

  it('refuses a project that is not there', async () => {
    const { surface } = build();

    expect(await surface.read('gone')).toEqual({ ok: false, reason: 'there is no project called gone' });
  });

  it('creates, selects, edits and moves through the same use cases a person uses', async () => {
    const { surface, calls } = build();

    expect(await surface.create({ name: 'Series' })).toMatchObject({ ok: true, current: true });
    expect(await surface.select('default')).toEqual({ ok: true, currentId: 'default' });
    expect((await surface.edit('p1', { motivation: 'New why' })).ok).toBe(true);
    expect(await surface.move('r2', 'default')).toEqual({ ok: true, recordingId: 'r2', projectId: 'default' });
    expect(calls).toEqual(['create:Series', 'select:default', 'edit:p1', 'move:r2:default']);
  });

  it('has no way to delete a recording or remove a project', () => {
    const { surface } = build();

    expect('remove' in surface).toBe(false);
    expect('delete' in surface).toBe(false);
  });
});