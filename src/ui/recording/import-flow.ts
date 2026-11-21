// The import flow: the Import button, the file picker and the review.
//
// It sequences the browser work and reports the outcome. The rule — which files are
// taken in, and that a take needs a length — lives in the import use case and the
// domain. The file arrives as the picker's own change event, so nothing here draws a
// second picker.

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { ImportTake } from '../../application/import-take.js';
import { takeFile } from '../../infra/take-file.js';
import { el, setStatus, toast } from '../dom.js';
import { openReview } from '../clip/review-flow.js';

const importTake = new ImportTake({
  clip: session.clip,
  files: takeFile,
  // A take with sound makes the clip one with sound — and a silent file never makes
  // it silent, since an earlier take may have carried the sound.
  setAudio: has => { if (has) session.audio = true; },
});

// A take in flight owns the clip, and an export is reading it: neither may be
// interrupted by a file arriving.
function busy(): boolean {
  const phase = currentPhase();
  return phase === 'starting' || phase === 'recording' || phase === 'encoding';
}

/** Ask for a video file. The picker is the browser's; the choice comes back as change. */
export function chooseFile(): void {
  if (busy()) return;
  el.fileInput.value = '';         // so choosing the same file again is still a change
  el.fileInput.click();
}

/** A file was chosen: take it in, and open the review on it. */
export async function onFileChosen(): Promise<void> {
  const file = el.fileInput.files?.[0];
  el.fileInput.value = '';
  if (!file || busy()) return;

  setStatus('proc', 'Importing…');
  const outcome = await importTake.run({ name: file.name, type: file.type, blob: file });
  if (outcome.kind !== 'imported') {
    setStatus('ready', 'Ready');
    toast(outcome.reason);
    return;
  }

  // The take is in the clip like any other, so the review opens on it: the strip,
  // the waveform and the export all follow from there.
  setPhase('review');
  await openReview(session.clip.takes.count() - 1, 0);
  setStatus('ready', 'Ready');
}
