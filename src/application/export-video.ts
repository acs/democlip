// The export use case: decide what to write, encode it, hand it over.
//
// The plan is the domain's; the encoder only encodes it; the download only saves
// the bytes. A refusal is a value, not an exception.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportTarget } from '../domain/export/ExportTarget.js';
import type { AnnotationExport } from '../domain/clip/ExportPlan.js';
import type { IntroCard } from '../domain/clip/IntroCard.js';
import type { EncoderPort, ExportStats, FrameRendererPort } from './ports/EncoderPort.js';
import type { DownloadPort } from './ports/DownloadPort.js';
import type { ClockPort } from './ports/ClockPort.js';
import { planExport } from './export-clip.js';

export type ExportOutcome =
  | { kind: 'exported'; blob: Blob; stats: ExportStats; filename: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

export interface ExportDeps {
  readonly clip: Clip;
  readonly encoder: EncoderPort;
  readonly renderer: FrameRendererPort;
  readonly download: DownloadPort;
  readonly clock: ClockPort;
  readonly audio: () => boolean;
  readonly fadeSeconds: number;
  /** The picture the preview shows; the export takes its size from it. */
  readonly picture: () => { readonly width: number; readonly height: number };
}

/** How one export is asked for: where its annotations go, and how it reports progress. */
export interface ExportRunOptions {
  readonly annotations?: AnnotationExport;
  /** A title card at the head of the file, or null for none. */
  readonly intro?: IntroCard | null;
  readonly onProgress?: (source: number) => void;
  /**
   * The largest file the caller will take, in bytes. The export holds its bitrate under
   * it — and refuses, rather than write a file that misses it — when the encoder's own
   * floor cannot reach it.
   */
  readonly maxBytes?: number;
}

export class ExportVideo {
  constructor(private readonly deps: ExportDeps) {}

  async run(target: ExportTarget, options: ExportRunOptions = {}): Promise<ExportOutcome> {
    if (!this.deps.encoder.available()) {
      return { kind: 'refused', reason: 'This browser cannot write video — it needs Chrome 94+ or Firefox 130+.' };
    }
    const plan = planExport(this.deps.clip, {
      audio: this.deps.audio(),
      fadeSeconds: this.deps.fadeSeconds,
      annotations: options.annotations ?? 'drawn',
      intro: options.intro ?? null,
    });
    if (!plan) return { kind: 'refused', reason: 'There is nothing to export.' };
    const picture = this.deps.picture();
    if (options.maxBytes !== undefined
      && !this.deps.encoder.fitsBudget(target, plan.total, picture, options.maxBytes)) {
      return {
        kind: 'refused',
        reason: `this clip is too long to fit ${Math.round(options.maxBytes / 1_000_000)} MB — the app will not encode below the bitrate that keeps it watchable; cut it, or allow a larger file`,
      };
    }
    try {
      const encoded = await this.deps.encoder.encode(plan, this.deps.renderer, {
        target,
        onProgress: options.onProgress,
        width: picture.width,
        height: picture.height,
        maxBytes: options.maxBytes,
      });
      // The name is chosen here, so it is answered here: a caller that wants to tell
      // someone where the file went should not have to guess what it was called.
      const filename = `democlip-${this.deps.clock.now()}.${target}`;
      this.deps.download.save(encoded.blob, filename);
      return { kind: 'exported', blob: encoded.blob, stats: encoded.stats, filename };
    } catch (error) {
      return { kind: 'failed', reason: error instanceof Error ? error.message : 'the export failed' };
    }
  }
}
