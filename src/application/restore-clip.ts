// The restore use case: rebuild a kept clip after a reload.
//
// It announces nothing — a restore is a load, not a change — so the flow that calls
// it opens the review and sets every view up.

import type { Clip } from '../domain/clip/Clip.js';
import type { KeptClipPort } from './ports/KeptClipPort.js';

export type RestoreOutcome =
  | { kind: 'restored' }
  | { kind: 'empty' }
  | { kind: 'failed'; reason: string };

export interface RestoreDeps {
  readonly clip: Clip;
  readonly store: KeptClipPort;
}

export class RestoreClip {
  constructor(private readonly deps: RestoreDeps) {}

  async run(): Promise<RestoreOutcome> {
    const stored = await this.deps.store.load();
    if (!stored) return { kind: 'empty' };
    try {
      this.deps.clip.restore(stored);
      return { kind: 'restored' };
    } catch (error) {
      await this.deps.store.clear();
      return { kind: 'failed', reason: error instanceof Error ? error.message : 'the saved clip could not be rebuilt' };
    }
  }
}
