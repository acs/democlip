// The frame renderer the encoder draws through: the annotations, the dissolve at a
// join, the card at the head of the file, and the preview. It lives in the view layer;
// the encoder imports no view.

import type { Frame, FrameRendererPort, IntroFrame } from '../../application/ports/EncoderPort.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { drawAnnotations } from '../annotating/annotation-layer.js';
import { DISSOLVE_S, dissolve } from '../clip/dissolve.js';
import { introText } from './intro-text.js';
import { el } from '../dom.js';

export class FrameRenderer implements FrameRendererPort {
  // The card's words are measured once, not on each of its frames.
  private card: { key: string; text: readonly Annotation[] } | null = null;

  hold(context: CanvasRenderingContext2D): void {
    dissolve.hold(context.canvas);
  }

  dissolve(context: CanvasRenderingContext2D, since: number): number | null {
    const held = dissolve.canvas();
    const alpha = dissolve.alpha(since);
    if (!held || alpha === null) return null;
    context.save();
    context.globalAlpha = 1;
    context.drawImage(held, 0, 0, context.canvas.width, context.canvas.height);
    context.restore();
    return alpha;
  }

  draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const w = context.canvas.width;
    const h = context.canvas.height;
    // The card at the head: its words, as text annotations. They are drawn at full
    // strength from the card's first frame — a card is read the moment it appears, and
    // its first frame is the poster a player and a file listing show.
    if (frame.intro) {
      drawAnnotations(context, w, h, this.cardText(frame.intro, w, h), null);
      return;
    }
    // An annotation dissolves in and out at the edges of its stretch, exactly as the
    // review draws it, so the file holds the same soft arrival and departure.
    drawAnnotations(context, w, h, frame.annotations, null, {
      at: frame.sourceTime, total: frame.recordingLength, seconds: DISSOLVE_S,
    });
  }

  preview(context: CanvasRenderingContext2D): void {
    const preview = el.cv.getContext('2d');
    if (!preview) return;
    preview.drawImage(context.canvas, 0, 0, el.cv.width, el.cv.height);
  }

  private cardText(intro: IntroFrame, w: number, h: number): readonly Annotation[] {
    const key = `${intro.title}\u0000${intro.description}\u0000${intro.stamp}\u0000${w}x${h}`;
    if (this.card?.key !== key) {
      this.card = { key, text: introText(intro.title, intro.description, intro.stamp, { w, h }) };
    }
    return this.card.text;
  }
}

export const frameRenderer = new FrameRenderer();
