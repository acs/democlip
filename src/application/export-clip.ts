// The export use case: what should be written, given the session.
//
// It reads the clip — the takes and what was cut out — and answers with a plan,
// which is a value. Everything after that needs a browser: demuxing, decoding, a
// canvas, an encoder. That half stays in src/offline-export.ts, behind
// `exportOffline(plan)`, and this half runs in node with a fake collection of takes.
//
// Only `ExportPlan` and the clip come in here: the fade length is the app's
// (src/ui/clip/fade.ts) and is handed over, so the domain stays free of the view.

import type { Clip } from '../domain/clip/Clip.js';
import { AnnotationSet } from '../domain/annotation/AnnotationSet.js';
import { ExportPlan, type ExportSettings } from '../domain/clip/ExportPlan.js';

// A hair off the end: a WebM's last frame is not decodable right at the end, so
// the export stops a moment short of it.
const END_MARGIN = 0.05;

export function planExport(clip: Clip, settings: ExportSettings): ExportPlan | null {
  const total = clip.total();
  const to = total - END_MARGIN;
  if (!clip.takes.count() || to <= 0) return null;

  const segments = clip.segmentsIn(0, to);
  if (!segments.length) return null;

  // A file that carries its annotations draws none of them: they travel beside it, and
  // drawing them in as well would put each of them in the picture twice over.
  const annotations = settings.annotations === 'carried' ? AnnotationSet.EMPTY : clip.annotations;
  return ExportPlan.of(segments, clip.takes.all(), to, clip.timeline(), settings, annotations);
}
