// The picture at a join, dissolved rather than cut.
//
// The sound is faded either side of a join (fade.ts); the picture is dissolved
// the same way, so a take does not cut into the next. As a take runs out its
// last frame is held, and over the first moments of the next take that frame is
// blended out while the new frames come in — a short cross-dissolve, as long as
// the sound's fade.
//
// The preview and the export draw through the same blend, so what is seen while
// reviewing is what ends up in the file.
//
// The held frame is the state of one join, so it lives on this object: the join
// that held it spends it (`draw`), and the export lets go of it when it is over
// (`clear`), which is what keeps a dissolve from outliving the join it was taken
// for.

import { el } from '../dom.js';
import { ClipSize } from '../../domain/clip/ClipSize.js';
import type { Frame } from '../../domain/clip/ClipSize.js';

export const DISSOLVE_S = 0.08;   // how long the dissolve lasts, in seconds

/** The picture size of a frame source, or null when it has none yet. */
function pictureOf(source: CanvasImageSource): { width: number; height: number } | null {
  if (source instanceof HTMLVideoElement) {
    return source.videoWidth > 0 ? { width: source.videoWidth, height: source.videoHeight } : null;
  }
  if (source instanceof HTMLCanvasElement) return { width: source.width, height: source.height };
  return null;
}

/** The rectangle a source is drawn into: fitted whole and centred, or the whole canvas. */
function fitIn(width: number, height: number, picture: { width: number; height: number } | null): Frame {
  const full: Frame = { x: 0, y: 0, width, height };
  const size = ClipSize.of(width, height);
  return size && picture ? size.frameFor(picture) : full;
}

export class Dissolve {
  private held: HTMLCanvasElement | null = null;   // the frame the last take ended on

  // Hold a frame to dissolve away from. The frames come from wherever the export
  // is drawing them: the video element when it plays the clip through in real
  // time, the export's own canvas when it encodes offline.
  hold(source: CanvasImageSource): void {
    const w = el.cv.width, h = el.cv.height;
    if (!w || !h) return;
    if (!this.held) this.held = document.createElement('canvas');
    this.held.width = w; this.held.height = h;
    const g = this.held.getContext('2d');
    if (!g) { this.held = null; return; }
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const fit = fitIn(w, h, pictureOf(source));
    try { g.drawImage(source, fit.x, fit.y, fit.width, fit.height); } catch { this.held = null; }
  }

  // Hold the frame the take in hand is ending on.
  holdFrame(): void {
    this.hold(el.rv);
  }

  // Forget the held frame: a dissolve must not outlive the join it was taken for.
  clear(): void {
    this.held = null;
  }

  // The held frame, for a caller that composites it itself — the offline export
  // draws the held frame and then the new one over it, which is the same blend.
  canvas(): HTMLCanvasElement | null {
    return this.held;
  }

  // How much of the new take to show `since` seconds into it: 0 at the join, rising
  // to 1 as the dissolve finishes, and null when there is nothing to dissolve.
  alpha(since: number): number | null {
    if (!this.held || !(since >= 0) || since >= DISSOLVE_S) return null;
    return Math.max(0, Math.min(1, since / DISSOLVE_S));
  }

  // Draw the frame of `vid` into `g`, dissolving from the held frame for the first
  // DISSOLVE_S of a take — `since` being how long that take has been running, so a
  // seek into the middle of one draws plainly. The held frame is dropped once the
  // dissolve is over, so it is used for one join only. Returns whether it drew the
  // dissolve; otherwise the caller draws the plain frame itself.
  draw(
    g: CanvasRenderingContext2D, vid: HTMLVideoElement, w: number, h: number, since: number, into?: Frame,
  ): boolean {
    const held = this.held;
    if (!held) return false;
    const k = this.alpha(since);
    if (k === null) {
      if (since >= DISSOLVE_S) this.held = null;      // spent on this join
      return false;
    }
    g.save();
    g.globalAlpha = 1;
    g.drawImage(held, 0, 0, w, h);        // the frame being left behind
    g.globalAlpha = k;
    if (into) g.drawImage(vid, into.x, into.y, into.width, into.height);
    else g.drawImage(vid, 0, 0, w, h);    // the new take coming in over it
    g.restore();
    return true;
  }
}

export const dissolve = new Dissolve();
