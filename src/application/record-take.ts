// The record use case: one press of Record.
//
// It owns the sequence of a take — sources, mix, record, stop, take added — and
// draws nothing. A take needs a source: a picture, or the microphone alone, which
// gives a **sound-only** take. A refusal is a value, not an exception; the flow
// reports it.

import type { Clip } from '../domain/clip/Clip.js';
import type { Take } from '../domain/clip/Take.js';
import type { SourceSet } from '../domain/capture/SourceSet.js';
import type { CropRegion } from '../domain/capture/CropRegion.js';
import type { CapturePort } from './ports/CapturePort.js';
import type { WebcamPort } from './ports/WebcamPort.js';
import type { MicrophonePort } from './ports/MicrophonePort.js';
import type { CompositorPort } from './ports/CompositorPort.js';
import type { TakeRecorderPort } from './ports/TakeRecorderPort.js';
import type { TakeProbePort } from './ports/TakeProbePort.js';
import type { ClockPort } from './ports/ClockPort.js';

export type RecordOutcome =
  | { kind: 'started'; stream: MediaStream }
  | { kind: 'stopped'; take: Take }
  | { kind: 'refused'; reason: string };

export interface RecordDeps {
  readonly clip: Clip;
  readonly capture: CapturePort;
  readonly webcam: WebcamPort;
  readonly mic: MicrophonePort;
  readonly compositor: CompositorPort;
  readonly recorder: TakeRecorderPort;
  readonly probe: TakeProbePort;
  readonly clock: ClockPort;
  readonly sources: () => SourceSet;
  readonly region: () => CropRegion;
  /** The picture's own size, for a take that has to be drawn on a canvas. */
  readonly picture?: () => { readonly width: number; readonly height: number };
  /** The element the picture is already shown in, for the compositor's first frame. */
  readonly pictureElement?: () => HTMLVideoElement;
  readonly drawBubble?: (context: CanvasRenderingContext2D) => void;
  readonly setAudio?: (hasAudio: boolean) => void;
}

export class RecordTake {
  private startedAt = 0;

  constructor(private readonly deps: RecordDeps) {}

  start(): RecordOutcome {
    const sources = this.deps.sources();
    if (!sources.canRecord) {
      return { kind: 'refused', reason: 'A take needs a source: turn on the screen, the webcam or the microphone.' };
    }
    const screen = this.deps.capture.current();
    const webcam = this.deps.webcam.current();
    const mic = this.deps.mic.current();
    // A take with no picture is the microphone's: there is no canvas to draw on and no
    // element to take a first frame from, so the compositor is handed neither.
    const picture = sources.hasPicture ? this.deps.picture?.() : undefined;
    const composed = this.deps.compositor.open({
      screen: screen?.stream ?? null,
      webcam,
      mic,
      region: this.deps.region(),
      audio: true,
      picture,
      pictureElement: picture ? this.deps.pictureElement?.() : undefined,
      drawBubble: picture ? this.deps.drawBubble : undefined,
    });
    if (!composed.stream.getTracks().length) {
      this.deps.compositor.close();
      return { kind: 'refused', reason: 'Nothing came from the sources: check the microphone and try again.' };
    }
    this.deps.recorder.start(composed.stream);
    this.startedAt = this.deps.clock.now();
    this.deps.setAudio?.(composed.hasAudio);
    return { kind: 'started', stream: composed.stream };
  }

  async stop(): Promise<RecordOutcome> {
    const blob = await this.deps.recorder.stop();
    this.deps.compositor.close();
    const wall = Math.max(0.1, (this.deps.clock.now() - this.startedAt) / 1000);
    const measured = await this.deps.probe.measure(blob).catch(() => null);
    // A blob the browser would not measure comes back as a length of 0, not as a
    // failure — and a take cannot be built without a length, so the wall clock stands in.
    const duration = measured && measured.duration > 0 ? measured.duration : wall;
    const take = this.deps.clip.addTake(blob, duration, measured?.picture ?? null);
    return { kind: 'stopped', take };
  }
}
