// The compositor: what a take actually records.
//
// It draws the crop of the screen and the webcam bubble, and mixes the audio. The
// bubble's drawing is injected by the composition root; the compositor imports no
// view module.

import type { CropRegion } from '../../domain/capture/CropRegion.js';

export interface CompositorInput {
  readonly screen: MediaStream | null;
  readonly webcam: MediaStream | null;
  readonly mic: MediaStream | null;
  readonly region: CropRegion;
  readonly audio: boolean;
  /**
   * The picture's own size in pixels. The recorded canvas is sized from it, because
   * the element the compositor draws from has no size until its first frame, which
   * is after the take has already opened.
   */
  readonly picture?: { readonly width: number; readonly height: number };
  /**
   * The element the app is already showing the picture in. Its current frame is drawn
   * as the take's first frame, so the canvas opens on a real picture rather than a
   * blank one while the compositor's own element waits for its first frame.
   */
  readonly pictureElement?: HTMLVideoElement;
  /** Draw the webcam bubble, if the view has one. */
  readonly drawBubble?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export interface CompositorSession {
  readonly stream: MediaStream;
  readonly hasAudio: boolean;
}

export interface CompositorPort {
  /** Draw the crop and the bubble, mix the audio, and return the stream to record. */
  open(input: CompositorInput): CompositorSession;
  close(): void;
}
