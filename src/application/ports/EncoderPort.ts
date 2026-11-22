// Encoding a plan into a file, named without the browser.

import type { ExportPlan } from '../../domain/clip/ExportPlan.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import type { ExportTarget } from '../../domain/export/ExportTarget.js';

export interface ExportStats {
  readonly bytes: number;
  readonly seconds: number;
  readonly frames: number;
  readonly realtime: number;
}

export interface EncodedVideo {
  readonly blob: Blob;
  readonly stats: ExportStats;
}

/** The title card shown at the head of the file, on the frame of it a moment falls in. */
export interface IntroFrame {
  readonly title: string;
  readonly description: string;
  /** How long the whole card is, in seconds. */
  readonly seconds: number;
  /** How far into the card this frame is, in seconds. */
  readonly at: number;
}

export interface Frame {
  readonly sourceTime: number;
  readonly outputTime: number;
  /** What is drawn over the picture at this moment. */
  readonly annotations: readonly Annotation[];
  /** The recording's own length, which the annotations' stretches are fractions of. */
  readonly recordingLength: number;
  /** Set on the frames of the card at the head of the file, which holds no clip picture. */
  readonly intro?: IntroFrame | null;
}

export interface EncodeOptions {
  readonly target: ExportTarget;
  readonly maxBytes?: number;
  readonly onProgress?: (source: number) => void;
  /** The picture the preview shows; the encoder takes its size from it. */
  readonly width?: number;
  readonly height?: number;
}

/** Draws what the encoder cannot: the annotations, the dissolve and the preview. */
export interface FrameRendererPort {
  /** Draw the annotations for a frame onto the encoder's canvas. */
  draw(context: CanvasRenderingContext2D, frame: Frame): void;
  /** Show the frame on the preview canvas. */
  preview(context: CanvasRenderingContext2D): void;
  /** Hold the frame on the encoder's canvas for a dissolve. */
  hold(context: CanvasRenderingContext2D): void;
  /**
   * Draw the held frame, and return the alpha the new frame should be drawn at.
   * Null when there is nothing to dissolve.
   */
  dissolve(context: CanvasRenderingContext2D, since: number): number | null;
}

export interface EncoderPort {
  /** Whether this browser can encode at all. */
  available(): boolean;
  /**
   * Whether a file this long can be written within this many bytes at this picture.
   * False means the encoder's own bitrate floor cannot reach the budget, so the caller
   * should refuse rather than write a file that misses it.
   */
  fitsBudget(
    target: ExportTarget,
    seconds: number,
    picture: { readonly width: number; readonly height: number },
    maxBytes: number,
  ): boolean;
  /** Encode the plan. The renderer draws the annotations and the preview. */
  encode(plan: ExportPlan, renderer: FrameRendererPort, options: EncodeOptions): Promise<EncodedVideo>;
}
