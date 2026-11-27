import { describe, expect, it } from 'vitest';

import { AdoptRecording, ADOPTED_RECORDING_ID } from './adopt-recording.js';
import { ClipProfile } from '../domain/clip/ClipProfile.js';
import { Projects } from '../domain/project/Projects.js';
import type { LegacyRecording, OpenRecording, RecordingPlace, RecordingStorePort } from './ports/RecordingStorePort.js';

class FakeStore {
  pointer: OpenRecording | null = null;
  legacy: LegacyRecording | null = null;
  adopted: { id: string; place: RecordingPlace } | null = null;
  cleared = 0;
  fail = false;

  async open(): Promise<OpenRecording | null> { return this.pointer; }
  async list() {
    return this.adopted ? [{ id: this.adopted.id, projectId: this.adopted.place.projectId, profile: this.adopted.place.profile, createdAt: this.adopted.place.createdAt, duration: 3, count: 1, title: '' }] : [];
  }
  async readLegacy(): Promise<LegacyRecording | null> { return this.legacy; }
  async adopt(id: string, _legacy: LegacyRecording, place: RecordingPlace): Promise<void> {
    if (this.fail) throw Object.assign(new Error('no room'), { name: 'QuotaExceededError' });
    this.adopted = { id, place };
    this.pointer = { recordingId: id, ...place };
    this.legacy = null;
  }
  async clearLegacy(): Promise<void> { this.cleared++; this.legacy = null; }
}

const portOf = (store: FakeStore) => store as unknown as RecordingStorePort;

const legacyClip = (): LegacyRecording => ({
  snapshot: {
    takes: [{ blob: new Blob(['x']), duration: 3 }],
    cuts: [{ s: 0.1, e: 0.2 }],
    annotations: [],
    properties: { title: 'Kept' },
  },
  images: [],
});

const build = () => {
  const store = new FakeStore();
  const adopt = new AdoptRecording({ store: portOf(store), now: () => 1_234 });
  return { store, adopt };
};

describe('AdoptRecording', () => {
  it('adopts the previous clip into the Default project, under the free profile', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();

    const outcome = await adopt.run();

    expect(outcome).toEqual({
      kind: 'adopted',
      recording: {
        recordingId: ADOPTED_RECORDING_ID,
        projectId: Projects.DEFAULT_ID,
        profile: ClipProfile.DEFAULT.stored(),
        createdAt: 1_234,
      },
    });
    expect(store.adopted!.id).toBe(ADOPTED_RECORDING_ID);
    expect(store.pointer!.recordingId).toBe(ADOPTED_RECORDING_ID);
    expect(store.cleared).toBe(1);
  });

  it('does nothing when the app already has a recording open', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();
    store.pointer = { recordingId: 'r1', projectId: 'default', profile: ClipProfile.DEFAULT.stored(), createdAt: 1 };

    expect(await adopt.run()).toEqual({ kind: 'nothing' });
    expect(store.adopted).toBeNull();
    expect(store.cleared).toBe(0);
  });

  it('does nothing when there is nothing to adopt', async () => {
    const { adopt } = build();

    expect(await adopt.run()).toEqual({ kind: 'nothing' });
  });

  it('does not adopt again when a recording is already kept but no pointer is open', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();
    await adopt.run();
    store.pointer = null;                 // a session ended after the adoption
    store.legacy = legacyClip();          // a failed clear left the old keys behind

    expect(await adopt.run()).toEqual({ kind: 'nothing' });
    expect(store.cleared).toBe(2);
    expect(store.adopted!.id).toBe(ADOPTED_RECORDING_ID);
  });

  it('is idempotent: a second run finds the pointer and leaves everything alone', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();
    await adopt.run();

    expect(await adopt.run()).toEqual({ kind: 'nothing' });
    expect(store.cleared).toBe(1);
  });

  it('leaves the old clip in place when the write fails', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();
    store.fail = true;

    const outcome = await adopt.run();

    expect(outcome.kind).toBe('failed');
    expect(store.legacy).not.toBeNull();
    expect(store.cleared).toBe(0);
    expect(store.pointer).toBeNull();
  });

  it('says the browser had no room when the quota is the cause', async () => {
    const { store, adopt } = build();
    store.legacy = legacyClip();
    store.fail = true;

    expect(await adopt.run()).toEqual({
      kind: 'failed',
      reason: 'the browser has no room left for the recording',
    });
  });
});