// Watching the webcam bubble as it is drawn.
//
// The bubble is the only large circle two canvases are asked to draw: the **preview**
// draws it inside the recorded region, and the **compositor** draws it on the canvas the
// take is recorded from. Watching `arc` on both says where and how big the circle was
// drawn — the preview's own, and the one that goes into the take — and watching the
// `drawImage` that paints the camera says whether it was squashed into that square.

import type { Page } from '@playwright/test';

export interface BubbleArc {
  /** The canvas's id — `preview`, or `''` for the compositor's own. */
  id: string;
  cx: number;
  cy: number;
  r: number;
  w: number;
  h: number;
}

export interface WebcamDraw {
  id: string;
  dw: number;
  dh: number;
  sw: number;
  sh: number;
}

interface BubbleWindow {
  __bubbleArcs?: BubbleArc[];
  __bubbleDraws?: WebcamDraw[];
}

const LARGE = 60;   // the bubble is a large circle; a smaller arc (a crosshair) is not it

/** Install before `boot.goto()`, so the watchers are in place before the app draws. */
export async function watchBubble(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface Arc { id: string; cx: number; cy: number; r: number; w: number; h: number }
    interface Drawn { id: string; dw: number; dh: number; sw: number; sh: number }
    const win = window as unknown as { __bubbleArcs: Arc[]; __bubbleDraws: Drawn[] };
    win.__bubbleArcs = [];
    win.__bubbleDraws = [];
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D['arc']>) {
      const [cx, cy, r] = args;
      win.__bubbleArcs.push({ id: this.canvas.id, cx, cy, r, w: this.canvas.width, h: this.canvas.height });
      return arc.apply(this, args);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      const source = args[0];
      // The bubble draws the camera video into a square; the 5-arg form is (image, dx, dy, dw, dh).
      if (source instanceof HTMLVideoElement && args.length >= 5) {
        win.__bubbleDraws.push({ id: this.canvas.id, dw: args[3] as number, dh: args[4] as number, sw: source.videoWidth, sh: source.videoHeight });
      }
      return (drawImage as (...a: unknown[]) => void).apply(this, args);
    };
  });
}

/** The last bubble the live preview drew. Throws if it drew none. */
export async function previewBubble(page: Page): Promise<BubbleArc> {
  const arc = await page.evaluate((min) => {
    const all = (window as unknown as BubbleWindow).__bubbleArcs ?? [];
    return all.filter(one => one.id === 'preview' && one.r > min).at(-1) ?? null;
  }, LARGE);
  if (!arc) throw new Error('the preview drew no bubble');
  return arc;
}

/**
 * The last bubble the compositor drew on the canvas the take is recorded from, or null
 * if it has not drawn one yet. The compositor's canvas is anonymous and as big as the
 * recording, which is what tells it apart from the timeline's own small canvases.
 */
export async function compositedBubble(page: Page): Promise<BubbleArc | null> {
  return page.evaluate((min) => {
    const all = (window as unknown as BubbleWindow).__bubbleArcs ?? [];
    return all.filter(one => one.id !== 'preview' && one.w >= 600 && one.r > min).at(-1) ?? null;
  }, LARGE);
}

/** The last camera `drawImage` on the preview. Throws if it drew none. */
export async function lastWebcamDraw(page: Page): Promise<WebcamDraw> {
  const draw = await page.evaluate(() => {
    const all = (window as unknown as BubbleWindow).__bubbleDraws ?? [];
    return all.filter(one => one.id === 'preview').at(-1) ?? null;
  });
  if (!draw) throw new Error('the preview drew no camera');
  return draw;
}
