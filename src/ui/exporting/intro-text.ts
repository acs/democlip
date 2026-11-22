// The words on a title card, as text annotations of the picture.
//
// The card at the head of an export shows the clip's title and description over its first
// frame, and they are drawn **as text annotations** — the app's own kind — so they look
// like every other line the app draws and dissolve in and out the same way. This is where
// the two become annotations: the title on a line of its own, the description broken into
// as many lines as it needs, the whole block centred on the picture.
//
// It measures with the renderer's own font, so a line is exactly as wide as it will be
// drawn — the same measurement the text kind uses, one place.

import { Span } from '../../domain/clip/Span.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import { measureTextWidth } from '../annotating/text-plugin.js';

const TITLE_H = 0.11;    // the title's font size, as a fraction of the picture's height
const DESC_H = 0.05;     // the description's
const MAX_W = 0.82;      // the widest a line may be, as a fraction of the width
const GAP = 0.045;       // between the title and the description, as a fraction of the height
const LINE = 1.4;        // a line's advance, in its own font sizes

/**
 * The title and the description as text annotations over the whole card — each in
 * fractions of the picture, the edges of the text exactly where they will be drawn.
 */
export function introText(
  title: string,
  description: string,
  picture: { w: number; h: number },
): TextAnnotation[] {
  const blocks: Array<{ text: string; size: number }> = [];
  if (title.trim()) blocks.push({ text: title, size: TITLE_H });
  for (const line of wrap(description, DESC_H, picture)) blocks.push({ text: line, size: DESC_H });
  if (!blocks.length) return [];

  // Measure each line and shrink it to the widest it may be, so even a word wider than
  // the picture still lands wholly on it.
  const lines = blocks.map(block => {
    const measured = measureTextWidth(block.text, block.size, picture);
    const k = measured > MAX_W ? MAX_W / measured : 1;
    return { text: block.text, height: block.size * k, width: measured * k };
  });

  // Stack them, the whole block centred on the picture.
  const gap = blocks[0].size === TITLE_H && lines.length > 1 ? GAP : 0;
  let blockHeight = gap;
  for (const line of lines) blockHeight += line.height * LINE;

  let y = (1 - blockHeight) / 2;
  const made: TextAnnotation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const annotation = TextAnnotation.create(Span.of(0, 1), {
      text: line.text, x: (1 - line.width) / 2, y, width: line.width, height: line.height,
    });
    if (annotation) made.push(annotation);
    y += line.height * LINE + (i === 0 ? gap : 0);
  }
  return made;
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
