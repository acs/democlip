// Rectangular crop region drawn over the live capture.
//
// The region is always shown as a red box over the preview — by default it
// covers the whole source. Drag to select a smaller region (only it is
// recorded); a plain click resets back to the full source. The overlay is
// painted straight onto the preview canvas, so it can never end up in the
// recording (which reads from the source <video>).

import { currentPhase } from '../../state.js';
import { capture } from '../../infra/capture.js';
import { CropRegion } from '../../domain/capture/CropRegion.js';
import { el, ctx } from '../dom.js';

export const FULL = CropRegion.FULL;

/** A rectangle of the picture, in fractions — the committed region, or one being dragged. */
export interface FractionRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function isFullRegion(r: FractionRect): boolean {
  return r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1;
}

const MIN_PX = 16;               // below this a pointer gesture counts as a click

/** A box in canvas pixels, which is what a gesture is measured in. */
type Box = { x: number; y: number; w: number; h: number };

// The crop gesture in flight: where the pointer went down, and where it is now.
// It belongs to the interaction and to nothing else, so it lives on an object
// with a lifetime — and the session ends that lifetime, because a drag must not
// outlive the session it was cropping.
class CropDrag {
  private live = false;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;

  get active(): boolean {
    return this.live;
  }

  // A gesture begins where the pointer landed.
  begin(x: number, y: number): void {
    this.live = true;
    this.fromX = this.toX = x;
    this.fromY = this.toY = y;
  }

  // ...and the box follows the pointer.
  move(x: number, y: number): void {
    this.toX = x;
    this.toY = y;
  }

  // The pointer came up: the box it made, and the gesture is over.
  end(): Box {
    const box = this.box();
    this.live = false;
    return box;
  }

  // The box as it stands, in canvas pixels.
  box(): Box {
    return {
      x: Math.min(this.fromX, this.toX), y: Math.min(this.fromY, this.toY),
      w: Math.abs(this.toX - this.fromX), h: Math.abs(this.toY - this.fromY),
    };
  }

  // The session is over: nothing is being dragged.
  cancel(): void {
    this.live = false;
  }
}

export const crop = new CropDrag();

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function initRegion(): void {
  el.cv.addEventListener('pointerdown', onDown);
  el.cv.addEventListener('pointermove', onMove);
  el.cv.addEventListener('pointerup', onUp);
  el.cv.addEventListener('pointercancel', onUp);
}

// Back to the whole source.
export function clearRegion(): void {
  capture.setRegion(CropRegion.FULL);
}

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const r = el.cv.getBoundingClientRect();
  return {
    x: clamp((e.clientX - r.left) / r.width  * el.cv.width,  0, el.cv.width),
    y: clamp((e.clientY - r.top)  / r.height * el.cv.height, 0, el.cv.height),
  };
}

function onDown(e: PointerEvent): void {
  // A crop is a crop of the screen: with the screen off there is nothing to crop.
  if (currentPhase() !== 'live' || !capture.sources.screen) return;
  const p = toCanvas(e);
  crop.begin(p.x, p.y);
  try { el.cv.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  e.preventDefault();
}

function onMove(e: PointerEvent): void {
  if (!crop.active) return;
  const p = toCanvas(e);
  crop.move(p.x, p.y);
}

function onUp(e: PointerEvent): void {
  if (!crop.active) return;
  const box = crop.end();
  try { el.cv.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

  if (box.w < MIN_PX || box.h < MIN_PX) { clearRegion(); return; }   // a click → full source

  capture.setRegion(CropRegion.from(box.x / el.cv.width, box.y / el.cv.height, box.w / el.cv.width, box.h / el.cv.height));
}

// A small, consistent on-screen font size, whatever the capture resolution.
function fontPx(): number {
  const W  = el.cv.width;
  const cw = el.cv.clientWidth || W;
  const cssPx = Math.max(9, Math.min(11, Math.round(cw / 95)));
  return Math.max(8, Math.round(cssPx * W / cw));
}

// Painted by the live mirror loop on the preview canvas.
export function drawRegion(): void {
  const visible = currentPhase() === 'live' || currentPhase() === 'recording';
  el.cv.style.cursor = currentPhase() === 'live' ? 'crosshair' : '';
  if (!visible) return;

  const W = el.cv.width, H = el.cv.height;
  const fs = fontPx();

  // What to outline: the committed crop, or the box being dragged. The drag is a plain
  // rectangle, not the validating value object — a press before the pointer has moved is
  // a bare point, and `CropRegion` refuses an empty one. That throw used to escape the
  // preview's loop and stop it drawing for the rest of the session: the box vanished,
  // the crosshair stayed, and the crop still landed, because the gesture itself was fine.
  let rect: FractionRect = capture.region;
  if (crop.active) {
    const box = crop.box();
    if (box.w > 0 && box.h > 0) rect = { x: box.x / W, y: box.y / H, w: box.w / W, h: box.h / H };
  }

  const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
  const lw = Math.max(1.5, W / 480);
  const full = isFullRegion(rect);

  ctx.save();
  // Dim everything outside the region (empty for the full region).
  ctx.fillStyle = 'rgba(2,3,8,0.62)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x, y, w, h);
  ctx.fill('evenodd');

  // Red box, inset a hair so the stroke is never clipped at the edges. While
  // recording it breathes between red and the background with a soft glow.
  const pulse = currentPhase() === 'recording' ? 0.5 + 0.5 * Math.sin(performance.now() / 450) : 1;
  const alpha = 0.22 + 0.78 * pulse;

  const ix = x + lw / 2, iy = y + lw / 2, iw = Math.max(0, w - lw), ih = Math.max(0, h - lw);
  ctx.save();
  ctx.strokeStyle = `rgba(229,62,62,${alpha.toFixed(3)})`;
  ctx.fillStyle   = `rgba(229,62,62,${alpha.toFixed(3)})`;
  ctx.lineWidth = lw;
  ctx.shadowColor = `rgba(229,62,62,${(alpha * 0.9).toFixed(3)})`;
  ctx.shadowBlur = lw * (3 + 7 * pulse);
  ctx.strokeRect(ix, iy, iw, ih);

  // Corner ticks, pulsing with it.
  const t = lw * 4;
  for (const [px, py] of [[ix, iy], [ix + iw, iy], [ix, iy + ih], [ix + iw, iy + ih]]) {
    ctx.fillRect(px - t / 2, py - lw / 2, t, lw);
    ctx.fillRect(px - lw / 2, py - t / 2, lw, t);
  }
  ctx.restore();

  // Size readout — small, tucked outside the top-right corner.
  sizeBadge(
    `${Math.round(rect.w * capture.width)} × ${Math.round(rect.h * capture.height)}`,
    x + w, y, W, fs,
  );

  if (currentPhase() === 'live') hint(full ? 'Drag to record a region' : 'Click to reset to the full screen', W, H, fs);
  ctx.restore();
}

function sizeBadge(text: string, right: number, top: number, W: number, fs: number): void {
  ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const bw = tw + fs * 1.1, bh = fs * 1.8;

  const bx = clamp(right - bw, 2, Math.max(2, W - bw - 2));   // right-aligned to the box
  let by = top - bh - fs * 0.35;                              // above the box (outside)
  if (by < 2) by = top + fs * 0.35;                           // no room above → tuck inside

  ctx.fillStyle = 'rgba(6,7,16,0.82)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(228,230,240,0.95)';
  ctx.fillText(text, bx + fs * 0.55, by + bh / 2);
}

function hint(text: string, W: number, H: number, fs: number): void {
  const hfs = Math.round(fs * 1.25);
  ctx.font = `${hfs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - tw / 2 - hfs, H - hfs * 3.4, tw + hfs * 2, hfs * 2);
  ctx.fillStyle = 'rgba(228,230,240,0.85)';
  ctx.fillText(text, W / 2, H - hfs * 2.4);
}
