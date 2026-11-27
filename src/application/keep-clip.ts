// The keep use case: writing the recording down as it changes.
//
// It owns the event subscription and the debounce. A take is written at once, with the
// pointer that says which recording it belongs to; a cut is written after a pause. The
// store is a port, and the place — the open recording's id and the facts that go beside
// it — is the recordings use case's answer.
//
// Nothing is cleared when the clip is: a session ending finishes the recording, and that
// is the recordings use case's act, not a side effect of the clip going away.

import type { Clip } from '../domain/clip/Clip.js';
import type { RecordingPlace, RecordingStorePort } from './ports/RecordingStorePort.js';
import type { ClockPort, Timer } from './ports/ClockPort.js';

const SAVE_DELAY_MS = 250;

export type KeepOutcome =
  | { kind: 'saved' }
  | { kind: 'failed'; reason: string }
  | { kind: 'skipped' };

/** Where a change to the clip is written. */
export interface KeepTarget {
  readonly recordingId: string;
  readonly place: RecordingPlace;
}

export interface KeepDeps {
  readonly clip: Clip;
  readonly store: RecordingStorePort;
  readonly clock: ClockPort;
  /** The recording the sitting is on, or null when there is none. */
  readonly place: () => KeepTarget | null;
  readonly warn?: (error: unknown) => void;
}

export class KeepClip {
  private timer: Timer | undefined;

  constructor(private readonly deps: KeepDeps) {}

  /** Subscribe to the clip. Returns the unsubscribe function. */
  watch(): () => void {
    return this.deps.clip.onChange(event => {
      const target = this.deps.place();
      // A session ending is not a deletion, and a clip nobody is on has nowhere to go.
      if (event.type === 'cleared' || !target) {
        this.timer?.cancel();
        this.timer = undefined;
        return;
      }
      if (event.type === 'take-added') {
        void this.deps.store
          .saveTake(target.recordingId, this.deps.clip, event.index, target.place)
          .catch(error => this.deps.warn?.(error));
        return;
      }
      // A profile chosen on an empty draft moves the pointer, and the recordings use case
      // writes that; it is not a change to the small half. Everything else is.
      if (event.type === 'profile-changed') return;
      this.scheduleMeta();
    });
  }

  /** Write the whole recording now. A sign-in waits on this; a failure refuses the sign-in. */
  async persist(): Promise<KeepOutcome> {
    this.timer?.cancel();
    this.timer = undefined;
    const target = this.deps.place();
    if (!target) return { kind: 'skipped' };
    if (this.deps.clip.takes.isEmpty()) return { kind: 'skipped' };
    try {
      await this.deps.store.saveAll(target.recordingId, this.deps.clip, target.place);
      return { kind: 'saved' };
    } catch (error) {
      return { kind: 'failed', reason: why(error) };
    }
  }

  private scheduleMeta(): void {
    this.timer?.cancel();
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = undefined;
      const at = this.deps.place();
      if (!at) return;
      void this.deps.store
        .saveMeta(at.recordingId, this.deps.clip, at.place)
        .catch(error => this.deps.warn?.(error));
    }, SAVE_DELAY_MS);
  }
}

function why(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return 'the browser has no room left for the recording';
  return error instanceof Error ? error.message : 'the recording store refused the write';
}