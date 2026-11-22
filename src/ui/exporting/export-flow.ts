// The export flow: the Export button, the status line and the phase.
//
// It sequences the browser work and reports the outcome. What to write and how to
// encode it belong to the export use case and the encoder adapter.

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { ExportVideo } from '../../application/export-video.js';
import { AnnotationSidecar } from '../../domain/clip/AnnotationSidecar.js';
import { encoder } from '../../infra/offline-encoder.js';
import { downloadPort } from '../../infra/download.js';
import { sidecarNameFor, writeSidecar } from '../../infra/annotation-sidecar.js';
import { clock } from '../../infra/clock.js';
import { images } from '../../infra/images.js';
import { frameRenderer } from './frame-renderer.js';
import { introFor } from './intro.js';
import { el, setStatus, toast } from '../dom.js';
import { beginEncoding, endEncoding, encodingAt } from '../clip/timeline-ui.js';
import { playback } from '../clip/playback.js';
import { keep } from '../keeping/keep.js';
import { FADE_S } from '../clip/fade.js';
import type { ExportTarget } from '../../domain/export/ExportTarget.js';
import type { AnnotationExport } from '../../domain/clip/ExportPlan.js';

const exportVideo = new ExportVideo({
  clip: session.clip,
  encoder,
  renderer: frameRenderer,
  download: downloadPort,
  clock,
  audio: () => session.audio,
  fadeSeconds: FADE_S,
  // The clip's own size: the export canvas is this, and each take is drawn fitted
  // into it. Falls back to the preview canvas if the clip somehow has no size yet.
  picture: () => session.clip.size() ?? { width: el.cv.width, height: el.cv.height },
});

/**
 * What an export came to. The buttons only toast it; the automation surface answers
 * with it, so an agent can be told what happened rather than guessing from a toast.
 */
export type ExportResult =
  | { kind: 'exported'; bytes: number; filename: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

export async function doExport(target: ExportTarget = 'webm', annotations: AnnotationExport = 'drawn'): Promise<ExportResult> {
  if (currentPhase() !== 'review') {
    return { kind: 'refused', reason: 'the clip is not in the review, so there is nothing to export' };
  }
  playback.pause();
  setPhase('encoding');
  el.recBtn.disabled = true;
  el.btnExp.disabled = true;
  el.btnNew.disabled = true;
  el.playBtn.disabled = true;
  setStatus('proc', 'Encoding…');
  const wasCut = beginEncoding();
  // The export draws frames in a tight loop, so it waits once, here, for every picture
  // an image annotation needs to be decoded. A picture not decoded draws nothing.
  await images.ready();
  // Whether the clip asks for a title card at the head of the file — its own property,
  // read once here and handed to the export, which carries it in the plan.
  const intro = introFor(session.clip);
  const outcome = await exportVideo.run(target, {
    annotations,
    intro,
    onProgress: source => encodingAt(source, session.clip.total()),
  });
  if (outcome.kind === 'exported') {
    // A file that carries its annotations does not hold them: they are written beside it,
    // under the file's own name, so a clip that goes out to be worked on comes back with
    // them. Written before the clip is forgotten, since the pictures travel too.
    if (annotations === 'carried') await saveSidecar(outcome.filename, intro?.seconds ?? 0);
    keep.forget();
    setStatus('ready', 'Export complete');
    toast(annotations === 'carried'
      ? `Saved ${Math.round(outcome.stats.bytes / 1024)} KB, and the annotations beside it`
      : `Saved ${Math.round(outcome.stats.bytes / 1024)} KB`);
  } else if (outcome.kind === 'refused') {
    setStatus('ready', 'Cannot encode here');
    toast(outcome.reason);
  } else {
    setStatus('ready', 'Export failed');
    toast(outcome.reason);
  }
  setPhase('review');
  el.recBtn.disabled = false;
  el.btnExp.disabled = false;
  el.btnNew.disabled = false;
  el.playBtn.disabled = false;
  endEncoding(wasCut);
  playback.pause();

  if (outcome.kind === 'exported') {
    return { kind: 'exported', bytes: outcome.stats.bytes, filename: outcome.filename };
  }
  return { kind: outcome.kind, reason: outcome.reason };
}

/**
 * Write the clip's annotations beside the file the export just wrote, under the file's own
 * name and `.json`.
 *
 * It is a second download, because the browser is the only way the app has to put a file
 * on the machine — and a browser may ask the person to allow more than one. Every picture
 * the clip kept goes with it: a picture is bytes, not numbers, and the store they live in
 * is let go with the clip.
 */
async function saveSidecar(forFile: string, introSeconds: number): Promise<void> {
  const sidecar = AnnotationSidecar.of(
    session.clip.keptLength() + introSeconds,
    session.clip.annotationsAsExported(introSeconds),
    await images.all(),
  );
  downloadPort.save(new Blob([await writeSidecar(sidecar)], { type: 'application/json' }), sidecarNameFor(forFile));
}
