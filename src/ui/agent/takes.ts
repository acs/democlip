// The surface's recording operations: the sources, and the takes.
//
// They go through the app's own flows, so a take an agent starts arrives exactly as a
// person's does — the phase, the preview, the badge, the take itself. Turning a
// source **off** is the app's own toggle and is offered here.
//
// Turning the **screen** source on is deliberately absent: it opens the browser's
// picker, which the browser only grants to a hand, so the server delivers that one
// press as a real input event. Choosing *what* is shared is the person's, and the
// surface says so rather than pretending.

import type { Clip } from '../../domain/clip/Clip.js';
import type { Result, SourceState, TakeSummary } from './surface.js';

export type SourceName = 'screen' | 'webcam' | 'microphone';

export const SOURCE_NAMES: readonly SourceName[] = ['screen', 'webcam', 'microphone'];

/** What the surface needs of the app's recording flow. */
export interface Recording {
  /** Start a take; refused by the app when no source is on. */
  readonly start: () => void;
  /** Stop the take in flight; the app opens the review when it lands. */
  readonly stop: () => Promise<void>;
  /** Is there a source to record — a picture, or the microphone on its own? */
  readonly canRecord: () => boolean;
  /** Which of the three sources are on. */
  readonly sources: () => SourceState;
  /** Turn a source off, through the app's own toggle. */
  readonly turnOff: (source: SourceName) => Promise<void>;
  /** Turn a source on, through the app's own toggle. Not the screen. */
  readonly turnOn: (source: SourceName) => Promise<void>;
}

export interface Takes {
  sources(): SourceState;
  start(): Result;
  stop(): Promise<Result<{ take: TakeSummary }>>;
  turnSourceOn(source: string): Promise<Result<{ sources: SourceState }>>;
  turnSourceOff(source: string): Promise<Result<{ sources: SourceState }>>;
}

export function createTakes(clip: Clip, recording: Recording): Takes {
  return {
    sources: () => recording.sources(),

    start() {
      if (!recording.canRecord()) {
        return { ok: false, reason: 'turn on the screen, the webcam or the microphone first — a take needs a source' };
      }
      recording.start();
      return { ok: true };
    },

    async stop() {
      const before = clip.takes.count();
      await recording.stop();
      const after = clip.takes.count();
      const take = after > before ? clip.takes.at(after - 1) : undefined;
      if (!take) return { ok: false, reason: 'no take arrived — there was none in flight' };
      return { ok: true, take: { index: after - 1, seconds: take.duration } };
    },

    async turnSourceOn(source) {
      const name = asSource(source);
      if (!name) return { ok: false, reason: `there is no source called ${source}` };
      if (name === 'screen') {
        return {
          ok: false,
          reason: "choosing what is shared is the person's, in the browser's own picker — the server delivers that press",
        };
      }
      await recording.turnOn(name);
      return { ok: true, sources: recording.sources() };
    },

    async turnSourceOff(source) {
      const name = asSource(source);
      if (!name) return { ok: false, reason: `there is no source called ${source}` };
      await recording.turnOff(name);
      return { ok: true, sources: recording.sources() };
    },
  };
}

function asSource(value: string): SourceName | null {
  return (SOURCE_NAMES as readonly string[]).includes(value) ? (value as SourceName) : null;
}
