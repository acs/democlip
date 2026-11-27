// The adoption: the previous version's one clip becomes a recording of the Default project.
//
// It is deliberately a use case of its own, because the one unacceptable outcome of this
// feature is losing the recording someone already had. The store writes the recording,
// its takes, its pictures and the open pointer in **one** transaction; only after that
// commits are the old stores cleared. A run that fails before the commit leaves the old
// data untouched, and a retry writes the same fixed id — so nothing is duplicated and
// nothing is lost.
//
// The adopted recording reads as the built-in Empty profile: the old clip carried its
// values as clip properties, and inventing a lock over them would be a lie. Its project
// is the Default project, which always exists.

import { ClipProfile } from '../domain/clip/ClipProfile.js';
import { Projects } from '../domain/project/Projects.js';
import type { OpenRecording, RecordingStorePort } from './ports/RecordingStorePort.js';

/** The one id an adopted recording has, so a retry overwrites rather than duplicates. */
export const ADOPTED_RECORDING_ID = 'adopted';

export type AdoptOutcome =
  | { kind: 'adopted'; recording: OpenRecording }
  | { kind: 'nothing' }
  | { kind: 'failed'; reason: string };

export interface AdoptDeps {
  readonly store: RecordingStorePort;
  readonly now: () => number;
  readonly warn?: (error: unknown) => void;
}

export class AdoptRecording {
  constructor(private readonly deps: AdoptDeps) {}

  async run(): Promise<AdoptOutcome> {
    try {
      // A pointer already there means the app has moved on: adoption is done, or there was
      // nothing to adopt and a draft has since been started.
      if (await this.deps.store.open()) return { kind: 'nothing' };
      // A recording already kept means the app has moved on too — the adopted one, or a new
      // one made after a draft. An old store left behind by a failed clear must not come back
      // as a second copy of a recording the person already has.
      if ((await this.deps.store.list()).length > 0) {
        await this.deps.store.clearLegacy();
        return { kind: 'nothing' };
      }
      const legacy = await this.deps.store.readLegacy();
      if (!legacy) return { kind: 'nothing' };

      const recording: OpenRecording = {
        recordingId: ADOPTED_RECORDING_ID,
        projectId: Projects.DEFAULT_ID,
        profile: ClipProfile.DEFAULT.stored(),
        createdAt: this.deps.now(),
      };
      await this.deps.store.adopt(ADOPTED_RECORDING_ID, legacy, recording);
      // The old bytes are only let go once the new record is committed. A failure here
      // leaves harmless old keys that the next start ignores.
      await this.deps.store.clearLegacy();
      return { kind: 'adopted', recording };
    } catch (error) {
      this.deps.warn?.(error);
      return { kind: 'failed', reason: why(error) };
    }
  }
}

function why(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return 'the browser has no room left for the recording';
  return error instanceof Error ? error.message : 'the recording could not be adopted';
}