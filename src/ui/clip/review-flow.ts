// Opening the review: the player, the strip, the waveform, the marks and the lane.
//
// A take just finished or a clip was restored. The review opens on the whole joined
// clip. A restore announces nothing, so this flow sets every view up.

import { el } from '../dom.js';
import { session } from '../../session.js';
import { player, resizeReview } from './clip.js';
import { playback } from './playback.js';
import { waveform } from './waveform.js';
import { strip } from './timeline-ui.js';
import { renderMarks } from '../cutting/marks.js';
import { renderLane } from '../annotating/annotation-lane.js';
import { updateSizeUI, updateTimeUI } from './timeline-ui.js';
import { stopMirror } from '../recording/preview.js';

export async function openReview(loadIndex: number, park: number): Promise<void> {
  // The preview belongs to the clip from here, so the live source has to let go of
  // it: the mirror runs on its own animation frame, and while it is going it paints
  // the screen or the webcam over every frame the review draws — the recording stops
  // and the picture carries on showing what the camera sees.
  stopMirror();
  playback.reset();
  await player.load(loadIndex);
  resizeReview();       // the canvas is the clip size, not the take's own
  updateTimeUI();
  updateSizeUI();
  renderMarks();
  renderLane();
  el.idleOv.classList.add('gone');
  void waveform.build(session.clip.takes.all());
  void strip.build().then(() => playback.seek(park));
  el.timeline.classList.add('on');
  el.btnExp.style.display = '';
  el.propsBtn.style.display = '';
}
