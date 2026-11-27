// The text: the third kind, and the test of the seam.
//
// The section arms this kind, the user types a line in the app's own entry, and it is
// placed centred over the picture, in hand so the shared canvas can move and resize it at
// once. The box's height is the font size and its width is what the line measured at that
// size — both in fractions of the picture — so the same text lands the same place and
// size on the preview, on the export canvas and after a reload. A corner drag scales the
// box, and the text grows and shrinks with it; there is no free resize, because text is
// not a picture to stretch.
//
// It also says what can be changed after it is placed: its colour, and its words. The
// words are edited through the same entry the kind is created with, and the new words are
// measured here — with the renderer's font — and handed to `TextAnnotation.withWords`.
//
// Everything else — picking it, moving it, copying, deleting, undoing, saving,
// exporting — is the shared canvas's and the clip's. This file writes none of it.
//
// It is its own renderer as well as its plugin: one object, one id, like the arrow and
// the image.

import { TextAnnotation, type TextGeometry } from '../../domain/annotation/TextAnnotation.js';
import { isColour } from '../../domain/annotation/AnnotationColour.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { el } from '../dom.js';
import { t } from '../i18n/index.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type AnnotationProperty, type CreationContext,
} from './annotation-plugin.js';
import { textEntry } from './text-entry.js';

// How tall the text is by default, as a fraction of the picture's height.
const DEFAULT_HEIGHT = 0.08;
// And the widest it may be placed, so a long line still fits on the picture.
const MAX_WIDTH = 0.9;

const FONT_WEIGHT = '600';
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const OUTLINE = 'rgba(2,3,8,0.72)';   // a dark edge, so any palette colour reads over any picture

// A new line is made in the clip's annotation colour, red by default — the same colour a new
// arrow takes, so the two kinds do not start in different ones. The white below is what a text
// written before colours existed reads back as, not what a new one is made in.

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14"/><path d="M12 5v14"/><path d="M9 19h6"/></svg>';

/** The font a size is drawn — and measured — with, so the two cannot disagree. */
function fontFor(pixels: number): string {
  return `${FONT_WEIGHT} ${pixels}px ${FONT_FAMILY}`;
}

/** The width a line measures at a given font-size fraction, as a fraction of the picture. */
export function measureTextWidth(text: string, height: number, picture: { w: number; h: number }): number {
  if (!(picture.w > 0) || !(picture.h > 0)) return 0;
  const context = el.cv.getContext('2d');
  if (!context) return 0;
  const previous = context.font;
  context.font = fontFor(height * picture.h);
  const measured = context.measureText(text).width;
  context.font = previous;
  return measured / picture.w;
}

/**
 * The box a line needs at the default size, in fractions of the picture: its width
 * comes from measuring with the renderer's font, and its height is the font size. A
 * line too wide to fit is shrunk, keeping the two in step.
 *
 * Exported because the automation surface places a text the same way the kind does —
 * one rule, one place, so an agent's text and a person's land identically.
 */
export function measureText(
  text: string,
  picture: { w: number; h: number },
): { width: number; height: number } | null {
  const measured = measureTextWidth(text, DEFAULT_HEIGHT, picture);
  if (!(measured > 0)) return null;

  let width = measured;
  let height = DEFAULT_HEIGHT;
  if (width > MAX_WIDTH) {
    const k = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height *= k;
  }
  return { width, height };
}

/** The text kind in the view: its action, its look, and how a new one is made and changed. */
export class TextPlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = TextAnnotation.id;

  readonly action: AnnotationAction = {
    label: 'Text',
    title: 'Add text over this section',
    icon: ACTION_ICON,
  };

  /** What can be changed after it is placed: the colour, and the words. */
  readonly properties: readonly AnnotationProperty[] = [
    {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: annotation => (annotation instanceof TextAnnotation ? annotation.colour : TextAnnotation.DEFAULT_COLOUR),
      with: (annotation, value) =>
        annotation instanceof TextAnnotation && isColour(value) ? annotation.withColour(value) : null,
    },
    {
      id: 'words',
      label: 'Words',
      control: 'text',
      value: annotation => (annotation instanceof TextAnnotation ? annotation.geometry.text : ''),
      with: (annotation, value) => this.refit(annotation, value),
    },
  ];

  /** The text is its own renderer, so a kind is one object with one id. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  begin(ctx: CreationContext): void {
    ctx.say(t('annotation.text.armed'));
    void this.create(ctx);
  }

  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void {
    if (!(annotation instanceof TextAnnotation)) return;
    const geometry: TextGeometry = annotation.geometry;
    const size = geometry.height * h;
    if (!(size > 0)) return;
    ctx.save();
    ctx.font = fontFor(size);
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeStyle = OUTLINE;               // a dark edge, so it reads over any picture
    ctx.fillStyle = annotation.colour;
    ctx.strokeText(geometry.text, geometry.x * w, geometry.y * h);
    ctx.fillText(geometry.text, geometry.x * w, geometry.y * h);
    ctx.restore();
  }

  /** A new text: the one entry the app has for typing a line, then measure and place. */
  private async create(ctx: CreationContext): Promise<void> {
    const typed = await textEntry.ask('');
    if (typed === null) { ctx.cancel(t('annotation.text.noText')); return; }
    const text = typed.trim();
    if (!text) { ctx.cancel(t('annotation.text.noText')); return; }

    const size = measureText(text, ctx.picture);
    if (!size) { ctx.cancel(t('annotation.text.noFit')); return; }

    const annotation = TextAnnotation.create(ctx.span, {
      text,
      x: (1 - size.width) / 2,
      y: (1 - size.height) / 2,
      width: size.width,
      height: size.height,
    }, undefined, ctx.colour);
    if (!annotation) { ctx.cancel(t('annotation.text.noFit')); return; }
    ctx.commit(annotation);
  }

  /** The words property: measure the new line at the text's size, then refit its box. */
  private refit(annotation: Annotation, value: string): Annotation | null {
    if (!(annotation instanceof TextAnnotation)) return null;
    const words = value.trim();
    if (!words) return null;                  // nothing to say is not a value text can take
    const width = measureTextWidth(words, annotation.geometry.height, { w: el.cv.width, h: el.cv.height });
    return annotation.withWords(words, width);
  }
}

// One text kind: the section offers its action, and the layer draws it.
export const textPlugin = new TextPlugin();
registerRenderer(textPlugin);
registerPlugin(textPlugin);