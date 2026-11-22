// Preview canvas rendering, the review-video seeking primitives and the live
// mirror loop.

import { el, ctx } from '../dom.js';
import { capture } from '../../infra/capture.js';
import { drawRegion } from './region.js';
import { drawWebcamOverlay } from './webcam.js';
import { dissolve } from '../clip/dissolve.js';
import type { Frame } from '../../domain/clip/ClipSize.js';

// What sits around a take whose picture is another shape than the clip's: the app's
// picture background, so the review and the file show the same bars.
const BACKGROUND = '#000';

export function drawGrid(): void {
  const light = document.documentElement.dataset.theme === 'light';
  ctx.clearRect(0, 0, el.cv.width, el.cv.height);
  ctx.fillStyle = light ? '#ECF0FA' : '#050508';
  ctx.fillRect(0, 0, el.cv.width, el.cv.height);
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const g = 90;
  for (let x = 0; x <= el.cv.width; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, el.cv.height); ctx.stroke(); }
  for (let y = 0; y <= el.cv.height; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(el.cv.width, y); ctx.stroke(); }
  const mx = el.cv.width / 2, my = el.cv.height / 2;
  ctx.strokeStyle = light ? 'rgba(229,62,62,0.14)' : 'rgba(229,62,62,0.08)';
  ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 62, my); ctx.lineTo(mx + 62, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my - 62); ctx.lineTo(mx, my + 62); ctx.stroke();
}

// Draw a frame on the preview. With a `frame` the take is drawn **fitted** into it —
// whole and centred, the clip's background around it; without one it fills the canvas,
// which is what the live mirror wants.
export function drawFrame(vid: HTMLVideoElement, frame?: Frame): void {
  if (!frame) { ctx.drawImage(vid, 0, 0, el.cv.width, el.cv.height); return; }
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, el.cv.width, el.cv.height);
  ctx.drawImage(vid, frame.x, frame.y, frame.width, frame.height);
}

// Draw the review clip's frame, dissolving from the frame held at the last join
// for the first moments of a new take — the picture's side of the faded seam.
export function drawClipFrame(vid: HTMLVideoElement, frame?: Frame): void {
  if (!dissolve.draw(ctx, vid, el.cv.width, el.cv.height, vid.currentTime, frame)) drawFrame(vid, frame);
}

export function seekTo(vid: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(res => {
    const fn = () => { vid.removeEventListener('seeked', fn); res(); };
    vid.addEventListener('seeked', fn);
    vid.currentTime = Math.min(Math.max(t, 0), vid.duration || 0);
  });
}

// A seek that gives up instead of waiting forever, reporting whether it landed.
// MediaRecorder WebM carries no duration in its header, and seeking such a file
// can stall; a stalled seek must never wedge playback or an export.
export function seekWithin(vid: HTMLVideoElement, t: number, ms = 2500): Promise<boolean> {
  return new Promise(res => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      vid.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      res(ok);
    };
    const onSeeked = () => finish(true);
    const timer = setTimeout(() => finish(false), ms);
    vid.addEventListener('seeked', onSeeked);
    vid.currentTime = Math.min(Math.max(t, 0), vid.duration || 0);
  });
}

// Live mirror: show the source that is live on the preview canvas. The screen
// carries the crop box and the webcam bubble; with the screen off the camera is
// the whole picture, so nothing is drawn over it.
let mirroring = false;
let frameId: number | null = null;

export function startMirror(): void {
  if (mirroring) return;             // already showing a live source
  mirroring = true;
  (function loop() {
    if (!mirroring) return;
    if (capture.sources.screen && capture.current() && el.sv.readyState >= 2) {
      // A frame that will not draw must not stop the preview: this loop is the only
      // thing painting it, and one throw here ends it for the rest of the session — the
      // picture freezes, and whatever was over it is never drawn again.
      try {
        drawFrame(el.sv);
        drawRegion();
        // Webcam overlay, inside the recording region (what will be recorded).
        const region = capture.region;
        drawWebcamOverlay(ctx, region.x * el.cv.width, region.y * el.cv.height,
                               region.w * el.cv.width, region.h * el.cv.height);
      } catch { /* the next frame will try again */ }
    } else if (capture.sources.webcam && el.wcv.readyState >= 2) {
      ctx.drawImage(el.wcv, 0, 0, el.cv.width, el.cv.height);
      el.cv.style.cursor = '';
    }
    frameId = requestAnimationFrame(loop);
  })();
}

export function stopMirror(): void {
  mirroring = false;
  if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
}
