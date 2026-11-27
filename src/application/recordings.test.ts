import { describe, expect, it } from 'vitest';

import { Recordings } from './recordings.js';
import { Clip, type ClipSnapshot } from '../domain/clip/Clip.js';
import { ClipProfile } from '../domain/clip/ClipProfile.js';
import { Session } from '../domain/session/Session.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type {
  LegacyRecording,
  LoadedRecording,
  OpenRecording,
  RecordingHeader,
  RecordingPlace,
  RecordingStorePort,
} from './ports/RecordingStorePort.js';

class FakeTakes implements TakeRepository {
  private takes: Take[] = [];
  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) {
    for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i;
    return Math.max(0, this.takes.length - 1);
  }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

class FakeStore implements RecordingStorePort {
  readonly records = new Map<string, { snapshot: ClipSnapshot; place: RecordingPlace }>();
  pointer: OpenRecording | null = null;
  legacy: LegacyRecording | null = null;
  readonly calls: string[] = [];

  seed(id: string, snapshot: ClipSnapshot, place: RecordingPlace): void {
    this.records.set(id, { snapshot, place });
  }

  async saveTake(id: string, clip: Clip, _index: number, place: RecordingPlace): Promise<void> {
    this.calls.push(`take:${id}`);
    this.records.set(id, { snapshot: clip.snapshot(), place });
    this.pointer = { recordingId: id, ...place };
  }
  async saveMeta(id: string, clip: Clip, place: RecordingPlace): Promise<void> {
    this.calls.push(`meta:${id}`);
    if (!clip.takes.isEmpty()) this.records.set(id, { snapshot: clip.snapshot(), place });
  }
  async saveAll(id: string, clip: Clip, place: RecordingPlace): Promise<void> {
    this.calls.push(`all:${id}`);
    this.records.set(id, { snapshot: clip.snapshot(), place });
  }
  async load(id: string): Promise<LoadedRecording | null> {
    const record = this.records.get(id);
    if (!record) return null;
    return {
      snapshot: record.snapshot,
      projectId: record.place.projectId,
      profile: record.place.profile,
      createdAt: record.place.createdAt,
      title: record.snapshot.properties?.title ?? '',
    };
  }
  async list(): Promise<RecordingHeader[]> {
    return [...this.records.entries()]
      .map(([id, record]) => ({
        id,
        projectId: record.place.projectId,
        profile: record.place.profile,
        createdAt: record.place.createdAt,
        duration: record.snapshot.takes.reduce((sum, take) => sum + take.duration, 0),
        count: record.snapshot.takes.length,
        title: record.snapshot.properties?.title ?? '',
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  async delete(id: string): Promise<void> {
    this.calls.push(`delete:${id}`);
    this.records.delete(id);
  }
  async setProject(id: string, projectId: string): Promise<void> {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, place: { ...record.place, projectId } });
  }
  async open(): Promise<OpenRecording | null> { return this.pointer; }
  async setOpen(open: OpenRecording): Promise<void> { this.pointer = open; }
  async clearOpen(): Promise<void> { this.pointer = null; }
  async readLegacy(): Promise<LegacyRecording | null> { return this.legacy; }
  async adopt(id: string, legacy: LegacyRecording, place: RecordingPlace): Promise<void> {
    this.records.set(id, { snapshot: legacy.snapshot, place });
    this.pointer = { recordingId: id, ...place };
  }
  async clearLegacy(): Promise<void> { this.legacy = null; }
}

const build = (hasProject: (id: string) => boolean = () => true) => {
  const clip = Clip.empty(new FakeTakes());
  const session = new Session(clip);
  const store = new FakeStore();
  let n = 0;
  const recordings = new Recordings({
    store,
    clip,
    session,
    newId: () => `r${++n}`,
    now: () => 1_000,
    hasProject,
  });
  return { clip, session, store, recordings };
};

const clipWith = (...durations: number[]) => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const snapshotWith = (...durations: number[]) => {
  const clip = clipWith(...durations);
  clip.setProperty('title', 'Hello');
  return clip.snapshot();
};

const snapshotUnder = (profile: ClipProfile, ...durations: number[]) => {
  const clip = Clip.empty(new FakeTakes(), profile);
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  clip.setProperty('title', 'Hello');
  return clip.snapshot();
};

describe('Recordings', () => {
  it('starts a draft in the project, under the profile, and points the sitting at it', async () => {
    const { clip, session, store, recordings } = build();
    const tv = ClipProfile.create('tv', 'DemoClipTV', { logo: 'democlip' })!;

    await recordings.startFresh('default', tv);

    expect(session.recordingId).toBe('r1');
    expect(session.projectId).toBe('default');
    expect(clip.profile.equals(tv)).toBe(true);
    expect(store.pointer).toEqual({ recordingId: 'r1', projectId: 'default', profile: tv.stored(), createdAt: 0 });
  });

  it('has nowhere to write before a draft is started, and places a take by the first one', async () => {
    const { clip, recordings } = build();
    expect(recordings.place()).toBeNull();

    await recordings.startFresh('default', ClipProfile.DEFAULT);
    expect(recordings.place()!.createdAt).toBe(1_000);
    clip.addTake(new Blob(['x']), 2);
    expect(recordings.place()!.createdAt).toBe(1_000);
  });

  it('keeps the recording and drops the pointer when the session finishes', async () => {
    const { clip, session, store, recordings } = build();
    await recordings.startFresh('p1', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 2);
    const id = session.recordingId;
    await store.saveTake(id, clip, 0, recordings.place()!);

    await recordings.finish();

    expect(store.records.has(id)).toBe(true);
    expect(store.pointer).toBeNull();
    expect(session.recordingId).toBe('');
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('opens a recording back into the sitting, with its project and profile', async () => {
    const { clip, session, store, recordings } = build();
    const tv = ClipProfile.create('tv', 'DemoTV', { addToExport: 'true' })!;
    store.seed('r1', snapshotUnder(tv, 2, 3), { projectId: 'p1', profile: tv.stored(), createdAt: 500 });

    const outcome = await recordings.openRecording('r1');

    expect(outcome).toEqual({ ok: true, title: 'Hello' });
    expect(clip.takes.count()).toBe(2);
    expect(clip.profile.equals(tv)).toBe(true);
    expect(session.recordingId).toBe('r1');
    expect(session.projectId).toBe('p1');
    expect(store.pointer).toEqual({ recordingId: 'r1', projectId: 'p1', profile: tv.stored(), createdAt: 500 });
  });

  it('refuses a recording that is not here', async () => {
    const { recordings } = build();

    expect(await recordings.openRecording('gone')).toEqual({ ok: false, reason: 'that recording is not here' });
  });

  it('lists every recording, marking only the open one with a take as in progress', async () => {
    const { clip, session, store, recordings } = build();
    store.seed('a', snapshotWith(2), { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 500 });
    store.seed('b', snapshotWith(3, 4), { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 600 });
    await recordings.startFresh('p1', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 1);
    await store.saveTake(session.recordingId, clip, 0, recordings.place()!);

    const list = await recordings.list();

    expect(list.map(recording => recording.id)).toEqual(['a', 'b', 'r1']);
    expect(list.map(recording => recording.state)).toEqual(['finished', 'finished', 'in-progress']);
    expect(list[1]!.duration).toBe(7);
  });

  it('does not count an empty draft as a recording', async () => {
    const { store, recordings } = build();
    await recordings.startFresh('p1', ClipProfile.DEFAULT);

    expect(await recordings.list()).toEqual([]);
    expect(store.pointer).not.toBeNull();
  });

  it('counts a project’s progress from its list', async () => {
    const { store, recordings } = build();
    store.seed('r1', snapshotWith(2), { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 500 });
    store.seed('r2', snapshotWith(2), { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 600 });
    store.seed('r3', snapshotWith(2), { projectId: 'p2', profile: ClipProfile.DEFAULT.stored(), createdAt: 700 });

    expect(recordings.progressFor(await recordings.listProject('p1'))).toEqual({ total: 2, finished: 2, inProgress: 0 });
  });

  it('moves a finished recording, refusing an unknown project or the open one', async () => {
    const { clip, session, store, recordings } = build(id => id === 'default' || id === 'p2');
    store.seed('a', snapshotWith(2), { projectId: 'default', profile: ClipProfile.DEFAULT.stored(), createdAt: 500 });

    expect(await recordings.move('a', 'nope')).toEqual({ ok: false, reason: 'there is no project called nope' });
    expect(await recordings.move('a', 'p2')).toEqual({ ok: true, projectId: 'p2' });
    expect(store.records.get('a')!.place.projectId).toBe('p2');

    await recordings.startFresh('p2', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 1);
    await store.saveTake(session.recordingId, clip, 0, recordings.place()!);
    expect((await recordings.move(session.recordingId, 'default')).ok).toBe(false);
  });

  it('deletes a recording wherever it lives, and says so when it is not here', async () => {
    const { store, recordings } = build();
    store.seed('r1', snapshotWith(2), { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 500 });

    expect(await recordings.delete('gone')).toEqual({ ok: false, reason: 'that recording is not here' });
    expect(await recordings.delete('r1')).toEqual({ ok: true });
    expect(store.records.has('r1')).toBe(false);
    expect(store.calls).toContain('delete:r1');
  });

  it('ends the sitting when the open recording itself is deleted', async () => {
    const { clip, session, store, recordings } = build();
    await recordings.startFresh('default', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 2);
    await store.saveTake(session.recordingId, clip, 0, recordings.place()!);

    await recordings.delete(session.recordingId);

    expect(session.recordingId).toBe('');
    expect(store.pointer).toBeNull();
    expect(store.records.has('r1')).toBe(false);
  });
});
describe('Recordings — choosing the draft’s profile', () => {
  it('writes the choice into the pointer, so a reload comes back to it', async () => {
    const { clip, store, recordings } = build();
    const tv = ClipProfile.create('tv', 'DemoTV', { addToExport: 'true' })!;
    await recordings.startFresh('default', ClipProfile.DEFAULT);

    expect(await recordings.chooseProfile(tv)).toBe(true);

    expect(clip.profile.equals(tv)).toBe(true);
    expect(store.pointer!.profile).toEqual(tv.stored());
  });

  it('refuses once a take has begun', async () => {
    const { clip, recordings } = build();
    const tv = ClipProfile.create('tv', 'DemoTV', { addToExport: 'true' })!;
    await recordings.startFresh('default', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 1);

    expect(await recordings.chooseProfile(tv)).toBe(false);
    expect(clip.profile.id).toBe(ClipProfile.DEFAULT.id);
  });
});

describe('Recordings — moving the draft to another project', () => {
  it('moves the draft and takes the project’s profile, before a take', async () => {
    const { clip, session, store, recordings } = build(id => id === 'default' || id === 'p2');
    const tv = ClipProfile.create('tv', 'DemoTV', { addToExport: 'true' })!;
    await recordings.startFresh('default', ClipProfile.DEFAULT);

    const outcome = await recordings.selectProject('p2', tv);

    expect(outcome).toEqual({ ok: true, projectId: 'p2' });
    expect(session.projectId).toBe('p2');
    expect(clip.profile.equals(tv)).toBe(true);
    expect(store.pointer!.projectId).toBe('p2');
    expect(store.pointer!.profile).toEqual(tv.stored());
  });

  it('refuses once a take has begun, or for a project that is not here', async () => {
    const { clip, recordings } = build(id => id === 'default');
    await recordings.startFresh('default', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 1);

    expect((await recordings.selectProject('default', ClipProfile.DEFAULT)).ok).toBe(false);
    expect((await recordings.selectProject('gone', ClipProfile.DEFAULT)).ok).toBe(false);
  });
});

describe('Recordings — opening another one', () => {
  it('flushes the recording it replaces before letting it go', async () => {
    const { clip, session, store, recordings } = build();
    await recordings.startFresh('default', ClipProfile.DEFAULT);
    clip.addTake(new Blob(['x']), 2);
    const current = session.recordingId;
    await store.saveTake(current, clip, 0, recordings.place()!);
    const before = store.calls.filter(call => call === `meta:${current}`).length;

    store.seed('next', snapshotWith(3), { projectId: 'default', profile: ClipProfile.DEFAULT.stored(), createdAt: 500 });
    await recordings.openRecording('next');

    expect(store.calls.filter(call => call === `meta:${current}`).length).toBe(before + 1);
    expect(session.recordingId).toBe('next');
  });
});
