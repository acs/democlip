// The import flow: the Import button, the file picker and the review.
//
// It sequences the browser work and reports the outcome. The rule — which files are taken
// in, and that a take needs a length — lives in the import use case and the domain. The
// files arrive as the picker's own change event, so nothing here draws a second picker.
//
// A file may arrive with its **sidecar**: the annotations an export wrote beside a video
// rather than drawing them in. They are chosen together — a page cannot look in a folder,
// so the person hands over both and the app sorts out which is which. A **sound-only** file
// comes in the same way: an audio export of a sound-only clip is a take like any other.

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { ImportTake } from '../../application/import-take.js';
import { TakeFile } from '../../domain/clip/TakeFile.js';
import { takeFile } from '../../infra/take-file.js';
import { readSidecar } from '../../infra/annotation-sidecar.js';
import { images } from '../../infra/images.js';
import { el, setStatus, toast } from '../dom.js';
import { openReview } from '../clip/review-flow.js';
import { syncWatermark } from '../clip/watermark.js';

const importTake = new ImportTake({
  clip: session.clip,
  files: takeFile,
  pictures: images,
  // A take with sound makes the clip one with sound — and a silent file never makes it
  // silent, since an earlier take may have carried the sound.
  setAudio: has => { if (has) session.audio = true; },
});

// A take in flight owns the clip, and an export is reading it: neither may be interrupted
// by a file arriving.
function busy(): boolean {
  const phase = currentPhase();
  return phase === 'starting' || phase === 'recording' || phase === 'encoding';
}

/** Ask for a video file, and the sidecar that may travel with it. */
export function chooseFile(): void {
  if (busy()) return;
  el.fileInput.value = '';         // so choosing the same file again is still a change
  el.fileInput.click();
}

/** Files were chosen: take the video in, and open the review on it. */
export async function onFileChosen(): Promise<void> {
  const chosen = Array.from(el.fileInput.files ?? []);
  el.fileInput.value = '';
  if (!chosen.length || busy()) return;

  // Which is which is the file's own business: the video is the one the app's own rule
  // takes, and the sidecar is the `.json` beside it — read as ours, or not read at all.
  const video = chosen.find(candidate => TakeFile.of(candidate.name, candidate.type) !== null);
  if (!video) {
    setStatus('Ready');
    toast('Only WebM and MP4 files can be imported.');
    return;
  }
  const written = chosen.find(candidate => candidate !== video && candidate.name.toLowerCase().endsWith('.json'));
  const sidecar = written ? readSidecar(await written.text()) : null;

  setStatus('Importing…');
  const outcome = await importTake.run({ name: video.name, type: video.type, blob: video }, sidecar);
  if (outcome.kind !== 'imported') {
    setStatus('Ready');
    toast(outcome.reason);
    return;
  }

  // The take is in the clip like any other, so the review opens on it: the strip, the
  // waveform and the export all follow from there. A **watermark** that came back with the
  // file — or the clip's own, if it wears a logo — is decoded before the review draws.
  await syncWatermark('picture');
  setPhase('review');
  await openReview(session.clip.takes.count() - 1, 0);
  setStatus('Ready');

  const carried = outcome.annotations;
  if (carried?.reason) toast(`Imported — ${carried.reason}`);
  else if (carried?.count) toast(`Imported, and ${carried.count === 1 ? '1 annotation came' : `${carried.count} annotations came`} back with it`);
}
