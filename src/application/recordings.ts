// The recordings use case: opening one, starting a draft, finishing a session, and
// organising them between projects.
//
// It owns the two facts the domain cannot know — which recording the sitting is on, and
// how a recording is written down — and it asks the store for both. The rules about what
// a recording is stay with `Clip`; the rules about a book of projects stay with
// `Projects`; what is here is the sequence.
//
// A recording is **finished** when it is not the open one. That is not a flag to keep in
// step: the open pointer is the only record of "in progress", so the overview cannot
// disagree with the session.

import type { Clip } from '../domain/clip/Clip.js';
import type { ClipProfile } from '../domain/clip/ClipProfile.js';
import type { Session } from '../domain/session/Session.js';
import type {
  RecordingHeader,
  RecordingPlace,
  RecordingStorePort,
} from './ports/RecordingStorePort.js';

export type RecordingState = 'in-progress' | 'finished';

/** A recording as a list shows it: its header facts, and whether its session is open. */
export interface RecordingSummary extends RecordingHeader {
  readonly state: RecordingState;
}

/** What a project's overview counts. */
export interface RecordingProgress {
  readonly total: number;
  readonly finished: number;
  readonly inProgress: number;
}

/** What an operation answers: the change, or a reason it was refused. */
export type RecordingsResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export interface RecordingsDeps {
  readonly store: RecordingStorePort;
  readonly clip: Clip;
  readonly session: Session;
  /** A fresh id for a new draft — the caller's source, so the use case holds no random one. */
  readonly newId: () => string;
  readonly now: () => number;
  /** Does a project with this id exist? The project book's answer, handed in. */
  readonly hasProject: (id: string) => boolean;
  /** Something went wrong that the person need not be stopped for. */
  readonly warn?: (error: unknown) => void;
}

export class Recordings {
  /** When this recording's first take landed; 0 until it does. */
  private createdAt = 0;

  constructor(private readonly deps: RecordingsDeps) {}

  /**
   * Begin a new draft in a project, under a profile. The session must already be over,
   * or empty — an ending is the caller's business, because a view may be watching it.
   */
  async startFresh(projectId: string, profile: ClipProfile): Promise<void> {
    const recordingId = this.deps.newId();
    this.deps.session.open(recordingId, projectId);
    // A clip that already holds takes is one the app came back to; it keeps its own
    // snapshot, and its takes are written under the draft's id rather than dropped.
    if (this.deps.clip.takes.isEmpty()) this.deps.clip.chooseProfile(profile);
    this.createdAt = this.deps.clip.takes.isEmpty() ? 0 : this.deps.now();
    const place: RecordingPlace = {
      projectId,
      profile: this.deps.clip.profile.stored(),
      createdAt: this.createdAt,
    };
    try {
      if (!this.deps.clip.takes.isEmpty()) {
        await this.deps.store.saveAll(recordingId, this.deps.clip, place);
      }
      await this.deps.store.setOpen({ recordingId, ...place });
    } catch (error) {
      this.deps.warn?.(error);
    }
  }

  /**
   * The recording the sitting is on, as a write needs it — or null when there is none.
   * The first take is what fixes when the recording was made.
   */
  place(): RecordingPlace | null {
    const recordingId = this.deps.session.recordingId;
    const projectId = this.deps.session.projectId;
    if (!recordingId || !projectId) return null;
    return {
      projectId,
      profile: this.deps.clip.profile.stored(),
      createdAt: this.ensureCreatedAt(),
    };
  }

  /** Open a recording in this sitting: it resumes as a session, takes included. */
  async openRecording(recordingId: string): Promise<RecordingsResult<{ title: string }>> {
    const loaded = await this.deps.store.load(recordingId);
    if (!loaded) return { ok: false, reason: 'that recording is not here' };
    // The recording about to be replaced is flushed before it is let go: a cut made in the
    // last moment must not be lost because another recording was opened over it.
    const current = this.deps.session.recordingId;
    const place = this.place();
    if (current && place && !this.deps.clip.takes.isEmpty()) {
      await this.deps.store.saveMeta(current, this.deps.clip, place).catch(error => this.deps.warn?.(error));
    }
    if (!this.deps.clip.takes.isEmpty()) this.deps.session.end();
    this.deps.clip.restore(loaded.snapshot);
    this.deps.session.open(recordingId, loaded.projectId);
    this.createdAt = loaded.createdAt;
    await this.deps.store.setOpen({
      recordingId,
      projectId: loaded.projectId,
      // The snapshot is what the clip was made under; it is the one in force after a reload.
      profile: this.deps.clip.profile.stored(),
      createdAt: loaded.createdAt,
    });
    return { ok: true, title: loaded.title };
  }

  /**
   * The session is over: flush the small half, drop the open pointer, and finish.
   *
   * The recording stays — finished — with its bytes and its pictures. `keepClip` leaves the
   * clip on screen, as an export does: it is a finished recording, no longer being kept, and
   * the next New starts the draft that follows.
   */
  async finish(options: { keepClip?: boolean } = {}): Promise<void> {
    const recordingId = this.deps.session.recordingId;
    const place = this.place();
    if (recordingId && place && !this.deps.clip.takes.isEmpty()) {
      try {
        await this.deps.store.saveMeta(recordingId, this.deps.clip, place);
      } catch (error) {
        this.deps.warn?.(error);
      }
    }
    await this.deps.store.clearOpen();
    if (options.keepClip) this.deps.session.close();
    else this.deps.session.end();
    this.createdAt = 0;
  }

  /** Every recording, in the order they were made. */
  async list(): Promise<RecordingSummary[]> {
    return (await this.deps.store.list()).map(header => this.summaryOf(header));
  }

  /** A project's recordings, in the order they were made. */
  async listProject(projectId: string): Promise<RecordingSummary[]> {
    return (await this.list()).filter(recording => recording.projectId === projectId);
  }

  /** A project's counts: how many it holds, how many finished, how many still open. */
  progressFor(recordings: readonly RecordingSummary[]): RecordingProgress {
    const finished = recordings.filter(recording => recording.state === 'finished').length;
    return {
      total: recordings.length,
      finished,
      inProgress: recordings.length - finished,
    };
  }

  /** Move a recording to another project. */
  async move(recordingId: string, projectId: string): Promise<RecordingsResult<{ projectId: string }>> {
    if (!this.deps.hasProject(projectId)) return { ok: false, reason: `there is no project called ${projectId}` };
    const header = (await this.deps.store.list()).find(recording => recording.id === recordingId);
    if (!header) return { ok: false, reason: 'that recording is not here' };
    if (header.projectId === projectId) return { ok: true, projectId };
    if (recordingId === this.deps.session.recordingId) {
      return {
        ok: false,
        reason: 'the recording being made keeps its project until the session ends',
      };
    }
    await this.deps.store.setProject(recordingId, projectId);
    return { ok: true, projectId };
  }

  /**
   * Destroy a recording for good, wherever it lives. Deleting the open one ends the sitting,
   * so nothing is left pointing at bytes that are gone.
   */
  async delete(recordingId: string): Promise<RecordingsResult> {
    const header = (await this.deps.store.list()).find(recording => recording.id === recordingId);
    if (!header) return { ok: false, reason: 'that recording is not here' };
    if (recordingId === this.deps.session.recordingId) {
      await this.deps.store.clearOpen();
      this.deps.session.end();
      this.createdAt = 0;
    }
    await this.deps.store.delete(recordingId);
    return { ok: true };
  }

  /** When the recording being made was started; the first take fixes it. */
  private ensureCreatedAt(): number {
    if (!this.createdAt) this.createdAt = this.deps.now();
    return this.createdAt;
  }

  /**
   * Choose the profile the open draft is made under. It is the clip's own rule — only
   * before a take — and the pointer is written with it, so a reload comes back to the same
   * profile rather than to the project's default.
   */
  async chooseProfile(profile: ClipProfile): Promise<boolean> {
    const changed = this.deps.clip.chooseProfile(profile);
    if (!changed) {
      // Choosing what is already in force is no change to the clip, but the pointer may
      // still need the project (a project selected with the same profile).
      if (this.deps.clip.takes.isEmpty()) await this.writePointer(profile);
      return false;
    }
    await this.writePointer(profile);
    return true;
  }

  /**
   * Move the open draft to another project, under that project's default profile. Only
   * before it begins to capture: from a take on, the recording keeps its project until the
   * session ends, and may be moved afterwards.
   */
  async selectProject(projectId: string, profile: ClipProfile): Promise<RecordingsResult<{ projectId: string }>> {
    if (!this.deps.hasProject(projectId)) return { ok: false, reason: `there is no project called ${projectId}` };
    if (this.deps.session.hasCaptured || !this.deps.clip.takes.isEmpty()) {
      return { ok: false, reason: 'the recording being made keeps its project until the session ends' };
    }
    const recordingId = this.deps.session.recordingId;
    if (!recordingId) return { ok: false, reason: 'there is no draft to move' };
    this.deps.session.open(recordingId, projectId);
    await this.chooseProfile(profile);
    return { ok: true, projectId };
  }

  private async writePointer(profile: ClipProfile): Promise<void> {
    const recordingId = this.deps.session.recordingId;
    const projectId = this.deps.session.projectId;
    if (!recordingId || !projectId) return;
    try {
      await this.deps.store.setOpen({
        recordingId,
        projectId,
        profile: profile.stored(),
        createdAt: this.createdAt,
      });
    } catch (error) {
      this.deps.warn?.(error);
    }
  }

  private summaryOf(header: RecordingHeader): RecordingSummary {
    const open = header.id === this.deps.session.recordingId && header.count > 0;
    return { ...header, state: open ? 'in-progress' : 'finished' };
  }
}