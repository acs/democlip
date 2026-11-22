// The frame renderer the encoder draws through: the annotations, the dissolve at a
// join, the card at the head of the file — its words and its logo — and the preview. It lives
// in the view layer; the encoder imports no view.

import type { Frame, FrameRendererPort, IntroFrame } from '../../application/ports/EncoderPort.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import type { IntroCard } from '../../domain/clip/IntroCard.js';
import { drawAnnotations } from '../annotating/annotation-layer.js';
import { DISSOLVE_S, dissolve } from '../clip/dissolve.js';
import { introText, LOGO_BOX, LOGO_SPACE } from './intro-text.js';
import { loadLogo, logoImage } from './logo-image.js';
import { el } from '../dom.js';

export class FrameRenderer implements FrameRendererPort {
  // The card's words are measured once, not on each of its frames.
  private card: { key: string; text: readonly Annotation[] } | null = null;

  /**
   * Load what the card needs before its first frame is encoded: a logo is a file, and the
   * card's first frame has to wear it rather than wait for it. Called by the flows that
   * export or publish; nothing to do for a clip with no logo.
   */
  async prepare(intro: IntroCard | null): Promise<void> {
    await loadLogo(intro?.logo ?? '');
  }

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
    // The card at the head: its logo, and its words as text annotations. Both are drawn at
    // full strength from the card's first frame — a card is read the moment it appears, and
    // its first frame is the poster a player and a file listing show.
    if (frame.intro) {
      this.drawLogo(context, frame.intro, w, h);
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

  /**
   * The clip's logo, fitted inside its box and centred in it, keeping the mark's own
   * proportions — with a dark shadow under it so a pale logo still reads over a pale picture,
   * which is the same reason the card's words are drawn with a dark edge.
   */
  private drawLogo(context: CanvasRenderingContext2D, intro: IntroFrame, w: number, h: number): void {
    const image = intro.logo ? logoImage(intro.logo) : null;
    if (!image || !image.width || !image.height) return;

    const aspect = image.width / image.height;
    const width = Math.min(LOGO_BOX.w, LOGO_BOX.h * aspect);
    const height = width / aspect;
    const at = {
      x: LOGO_BOX.x + (LOGO_BOX.w - width) / 2,
      y: LOGO_BOX.y + (LOGO_BOX.h - height) / 2,
    };
    context.save();
    context.shadowColor = 'rgba(2,3,8,0.72)';
    context.shadowBlur = Math.max(2, h * 0.02);
    context.drawImage(image, at.x * w, at.y * h, width * w, height * h);
    context.restore();
  }

  private cardText(intro: IntroFrame, w: number, h: number): readonly Annotation[] {
    const key = `${intro.title}\u0000${intro.description}\u0000${intro.stamp}\u0000${intro.logo}\u0000${w}x${h}`;
    if (this.card?.key !== key) {
      this.card = {
        key,
        // With a logo above them, the words are stacked in what is left of the card rather
        // than over the whole of it.
        text: introText(intro.title, intro.description, intro.stamp, { w, h }, intro.logo ? LOGO_SPACE : 0),
      };
    }
    return this.card.text;
  }
}

export const frameRenderer = new FrameRenderer();
