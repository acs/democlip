// The view's lifetime: when the clip is cleared, every view that shows it ends.
//
// The session owns the clip and says when it is gone; this module is the view's
// answer to that one event. Each view keeps its own reset in its own module — the
// playback, the waveform, the strip, the gestures — and this module only wires the
// event to them. Adding a view means adding its reset here, never editing the
// session. An in-flight export or publish is not a view and is not stopped here.

import { session } from '../../session.js';
import { el } from '../dom.js';
import { playback } from '../clip/playback.js';
import { waveform } from '../clip/waveform.js';
import { strip } from '../clip/timeline-ui.js';
import { liveTimeline } from '../recording/live-timeline.js';
import { player } from '../clip/clip.js';
import { drag } from '../cutting/marks.js';
import { crop } from '../recording/region.js';
import { bubblePlacer } from '../recording/webcam.js';
import { canvas } from '../annotating/annotation-canvas.js';
import { clipboard } from '../annotating/annotation-clipboard.js';
import { clipPropertiesPanel } from '../clip/properties-panel.js';
import { images } from '../../infra/images.js';
import { selection } from '../cutting/selection.js';
import { exportMenu } from '../exporting/export-menu.js';
import { drawGrid } from '../recording/preview.js';

export function initViewLifetime(): void {
  session.clip.onChange(event => {
    if (event.type !== 'cleared') return;
    // Work in flight first: a strip being built, a gesture mid-drag, a copy held.
    liveTimeline.stop();
    strip.cancel();
    drag.cancel();
    crop.cancel();
    bubblePlacer.reset();      // the bubble's placement is the sitting's: New is the corner again
    canvas.cancel();
    clipboard.clear();
    clipPropertiesPanel.dismiss();   // the clip is gone: hide, and write nothing back
    void images.clear();      // the pictures and their decoded copies go with the clip
    selection.clear();
    exportMenu.close();
    // The element was holding a take that no longer exists.
    if (el.rv.src) el.rv.src = '';
    player.forget();
    el.timeline.classList.remove('on', 'sound-only');
    el.idleOv.classList.remove('gone');
    el.expStack.style.display = 'none';
    el.propsBtn.style.display = 'none';
    playback.reset();
    waveform.clear();
    drawGrid();
  });
}
