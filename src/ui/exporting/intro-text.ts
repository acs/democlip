// The words on a title card, as text annotations of the picture.
//
// The card shows the clip's title and description over its first frame, and under them
// the day it was made and the app's name. They are drawn **as text annotations** — the
// app's own kind — so they look like every other line the app draws. This is where the
// lines become annotations: the title on a line of its own, the description broken into
// as many lines as it needs, the day line under both, the whole block centred on the
// picture.
//
// It measures with the renderer's own font, so a line is exactly as wide as it will be
// drawn — the same measurement the text kind uses, one place.

import { Span } from '../../domain/clip/Span.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import { measureTextWidth } from '../annotating/text-plugin.js';

const TITLE_H = 0.11;    // the title's font size, as a fraction of the picture's height
const DESC_H = 0.05;     // the description's
const STAMP_H = DESC_H / 2;  // the day line's: half the description's size
const MAX_W = 0.82;      // the widest a line may be, as a fraction of the width
const GAP = 0.045;       // between the title and the description, as a fraction of the height
const STAMP_GAP = 0.05;  // between the description and the day line
const LINE = 1.4;        // a line's advance, in its own font sizes

/**
 * The box the card's **logo** is fitted into, as fractions of the picture: above the words,
 * centred. The renderer fits the mark inside it, keeping its own proportions, so a wide logo
 * and a tall one both sit in the same place — and the box is as tall as it is wide, so a
 * portrait mark (Graditone's clef) is no smaller than a landscape one (DemoClip's camera).
 */
export const LOGO_BOX = { x: 0.39, y: 0.08, w: 0.22, h: 0.22 };

/** What the words keep clear above them when the card wears a logo. */
export const LOGO_SPACE = LOGO_BOX.y + LOGO_BOX.h + 0.05;

/** One line of the card: its words, its size, and the space above it. */
interface CardLine {
  text: string;
  size: number;
  spaceBefore: number;
}

/**
 * The title, the description and the day line as text annotations over the whole card —
 * each in fractions of the picture, the edges of the text exactly where they will be drawn.
 * `top` is what above them belongs to something else (the logo), so the words are stacked in
 * what is left rather than on the whole card.
 */
export function introText(
  title: string,
  description: string,
  stamp: string,
  picture: { w: number; h: number },
  top = 0,
): TextAnnotation[] {
  const lines = cardLines(title, description, stamp, picture);
  if (!lines.length) return [];

  // Measure each line and shrink it to the widest it may be, so even a word wider than
  // the picture still lands wholly on it.
  const measured = lines.map(line => {
    const width = measureTextWidth(line.text, line.size, picture);
    const k = width > MAX_W ? MAX_W / width : 1;
    return { text: line.text, height: line.size * k, width: width * k, spaceBefore: line.spaceBefore };
  });

  // Stack them, the whole block centred in what the logo leaves.
  let blockHeight = 0;
  for (const line of measured) blockHeight += line.spaceBefore + line.height * LINE;

  let y = top + ((1 - top) - blockHeight) / 2;
  const made: TextAnnotation[] = [];
  for (const line of measured) {
    y += line.spaceBefore;
    const annotation = TextAnnotation.create(Span.of(0, 1), {
      text: line.text, x: (1 - line.width) / 2, y, width: line.width, height: line.height,
    });
    if (annotation) made.push(annotation);
    y += line.height * LINE;
  }
  return made;
}

/** The card's lines, in the order they are read: the title, the description, the day. */
function cardLines(
  title: string,
  description: string,
  stamp: string,
  picture: { w: number; h: number },
): CardLine[] {
  const lines: CardLine[] = [];
  if (title.trim()) lines.push({ text: title, size: TITLE_H, spaceBefore: 0 });

  const words = wrap(description, DESC_H, picture);
  words.forEach((line, i) => {
    lines.push({ text: line, size: DESC_H, spaceBefore: i === 0 && lines.length > 0 ? GAP : 0 });
  });

  if (stamp.trim()) lines.push({ text: stamp, size: STAMP_H, spaceBefore: lines.length > 0 ? STAMP_GAP : 0 });
  return lines;
}

/** The words broken into lines no wider than `MAX_W`, by the words between them. */
function wrap(text: string, size: number, picture: { w: number; h: number }): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (measureTextWidth(candidate, size, picture) > MAX_W) { lines.push(line); line = words[i]; }
    else line = candidate;
  }
  lines.push(line);
  return lines;
}
