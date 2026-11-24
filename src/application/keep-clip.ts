// The keep use case: writing the clip down as it changes.
//
// It owns the event subscription and the debounce. A take is written at once; a cut
// is written after a pause; a cleared clip is let go. The store is a port.

import type { Clip } from '../domain/clip/Clip.js';
import type { KeptClipPort } from './ports/KeptClipPort.js';
import type { ClockPort, Timer } from './ports/ClockPort.js';

const SAVE_DELAY_MS = 250;

export type KeepOutcome =
  | { kind: 'saved' }
  | { kind: 'failed'; reason: string }
  | { kind: 'skipped' };

export interface KeepDeps {
  readonly clip: Clip;
  readonly store: KeptClipPort;
  readonly clock: ClockPort;
  readonly warn?: (error: unknown) => void;
}

export class KeepClip {
  private timer: Timer | undefined;

  constructor(private readonly deps: KeepDeps) {}

  /** Subscribe to the clip. Returns the unsubscribe function. */
  watch(): () => void {
    return this.deps.clip.onChange(event => {
      if (event.type === 'cleared') {
        this.timer?.cancel();
        this.timer = undefined;
        void this.deps.store.clear();
        return;
      }
      if (event.type === 'take-added') {
        void this.deps.store
          .saveTake(this.deps.clip, event.index)
          .catch(error => this.deps.warn?.(error));
        return;
      }
      this.scheduleMeta();
    });
  }

  /** Write the whole clip now. A sign-in waits on this; a failure refuses the sign-in. */
  async persist(): Promise<KeepOutcome> {
    this.timer?.cancel();
    this.timer = undefined;
    if (this.deps.clip.takes.isEmpty()) return { kind: 'skipped' };
    try {
      await this.deps.store.saveClip(this.deps.clip);
      return { kind: 'saved' };
    } catch (error) {
      return { kind: 'failed', reason: why(error) };
    }
  }

  /** The clip has gone somewhere. Let the kept copy go. */
  forget(): void {
    this.timer?.cancel();
    this.timer = undefined;
    void this.deps.store.clear();
  }

  private scheduleMeta(): void {
    this.timer?.cancel();
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = undefined;
      void this.deps.store
        .saveMeta(this.deps.clip)
        .catch(error => this.deps.warn?.(error));
    }, SAVE_DELAY_MS);
  }
}

function why(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return 'the browser has no room left for the recording';
  return error instanceof Error ? error.message : 'the clip store refused the write';
}
