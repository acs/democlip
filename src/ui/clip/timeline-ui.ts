// Timeline panel: time labels, size estimate and the thumbnail strip.
//
// The timeline shows the clip with its cuts taken out, so everything here is in
// timeline time — the labels and the strip are mapped through the kept-time
// mapping (clip.ts). The recording's own time is what playback and the export use.

import { clock, el } from '../dom.js';
import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { estimateSoundText, estimateWebmText } from './size-estimate.js';
import { keptLengthNow, keptOf, player, resizeReview, sourceOf } from './clip.js';
import { waveform } from './waveform.js';
import { drawThumb, thumbBox } from './thumbnail.js';

const COUNT = 22;         // thumbnail frames across the strip

// The timeline is a view of the clip and nothing else, so the clip saying what
// changed is the whole of the coupling: an approved or undone cut re-cuts the
// strip and the readouts, a new take only moves what is drawn from the model.
export function initTimeline(): void {
  session.clip.onChange(event => {
    if (event.type === 'cut-approved' || event.type === 'cut-undone') {
      void rebuildTimeline();     // the clip is a different length now
    }
    if (event.type === 'take-added' || event.type === 'property-changed') {
      resizeReview();             // a larger take, or the size set: the frame may move
    }
    updateTimeUI();
    updateSizeUI();
    waveform.draw();
  });
}

// The clip's own length in the header. The timeline changes length when a cut is
// approved or taken back, so the readout is drawn again.
export function updateTimeUI(): void {
  el.tClip.textContent = keptLengthNow().toFixed(2) + 's';
}

export function updateSizeUI(): void {
  if (!session.clip.total() || currentPhase() === 'idle') { el.tSize.textContent = '—'; return; }
  // Cuts are taken out, so they shrink the estimate too. A sound-only clip has no
  // picture to size the file by, and its export is the sound alone.
  el.tSize.textContent = session.clip.hasPicture()
    ? estimateWebmText(keptLengthNow(), el.cv.width, el.cv.height)
    : estimateSoundText(keptLengthNow());
}

// ── the export's progress ────────────────────────────────────────────────────
//
// The export is encoded offline, about ten times faster than the clip, and it
// says how far it has got as it writes: the playhead travels across the clip and
// the header counts down how much of it is left to write. `source` and `to` are
// times in the recording, and what is counted down is clip time rather than the
// wait — which is what the number beside "ENCODING" means.

// The chip says what the clip holds. The export takes it over while it runs and
// puts it back afterwards, so what it said is the export's own business and it is
// handed back to it, rather than kept here for whoever asks next.
export function beginEncoding(): string {
  const was = el.tCut.textContent ?? '';
  el.timeline.classList.add('encoding');
  el.tlLabel.textContent = 'Timeline · Export';
  el.tCut.textContent = 'ENCODING';
  el.tLive.classList.remove('on');
  return was;
}

// The clip is shown the way playback is, by the playhead travelling across it,
// with the time left in the header. `to` is where the export ends; the export runs
// at the clip's own speed, so what is left of it is what is left to wait.
export function encodingAt(source: number, to: number): void {
  const kept = Math.max(0.001, keptLengthNow());
  const head = keptOf(source), end = keptOf(to);
  el.playhead.style.left = ((head / kept) * 100).toFixed(2) + '%';
  el.tNow.textContent = head.toFixed(2) + 's';
  el.tCut.textContent = 'ENCODING · ' + clock(Math.max(0, end - head)) + ' left';
}

export function endEncoding(was: string): void {
  el.timeline.classList.remove('encoding');
  el.tlLabel.textContent = 'Timeline · Cut';
  el.tCut.textContent = was;
  updateTimeUI();              // the length and the head come back
}

// Everything that shows how long the clip is: the timeline changes length when a
// cut is approved or taken back, so it all has to be drawn again. The clip's
// length is the timeline's own readout — there is no separate clock.
export function rebuildTimeline(): void {
  updateTimeUI();
  updateSizeUI();
  waveform.draw();
  // A sound-only clip has no frames for the strip; the timeline shows its sound alone.
  if (session.clip.hasPicture()) void strip.build();
  else el.thumbs.replaceChildren();
}

// The thumbnail strip: the clip's own frames, taken by seeking the element through
// it. It is the one thing on this panel that takes time — twenty-two seeks — so it
// is an object with a lifetime, and a build is abandoned the moment it is
// superseded or the session ends. Nothing else may draw into cells that are no
// longer there, and a build must not go on moving the element over a clip that has
// been dropped.
//
// Each cell is a picture of the take the frame came from, at that take's own shape
// (thumbnail.ts): a cropped take is not 16:9, and stretching it into a fixed cell
// would show a picture the clip does not hold.
class Strip {
  private generation = 0;

  /** Build the strip from the clip. A build already running is abandoned. */
  async build(): Promise<void> {
    const mine = ++this.generation;
    el.thumbs.replaceChildren();
    const frames: Array<{ tc: HTMLCanvasElement }> = [];
    for (let i = 0; i < COUNT; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'thumb-frame';
      const tc = document.createElement('canvas');
      // Sized to the take in hand, so the first frame does not have to resize it;
      // each cell is resized again only if its own take turns out a different shape.
      const { w, h } = thumbBox(el.rv.videoWidth, el.rv.videoHeight);
      tc.width = w; tc.height = h;
      wrap.appendChild(tc);
      el.thumbs.appendChild(wrap);
      frames.push({ tc });
    }
    for (let i = 0; i < COUNT; i++) {
      if (mine !== this.generation) return;     // superseded, or the session ended
      await player.seek(sourceOf((i / COUNT) * keptLengthNow()));
      if (mine !== this.generation) return;
      drawThumb(frames[i].tc, el.rv, 0, 0, el.rv.videoWidth, el.rv.videoHeight);
    }
  }

  /** The session is over: whatever is being built is not wanted, and the cells go. */
  cancel(): void {
    this.generation++;
    el.thumbs.replaceChildren();
  }
}

export const strip = new Strip();
