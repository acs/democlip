// The watermark: the marks the clip wears over the whole of its picture.
//
// A clip that wears a **logo** wears it as a **watermark** — the same mark, over the whole clip
// rather than only on the card at its head — and under it, **20% smaller**, its **title** when it
// has one. Both are ordinary annotations of the kinds the app already has: the mark an **image
// annotation** whose picture is a file the app serves itself, the title a **line of text**. So
// they show on the timeline lane, can be picked, moved, resized and edited exactly as anything
// else the person places, are kept with the clip and are drawn into every export — and no kind
// has to know it is one.
//
// Which annotations are the watermark is the **clip's** own fact (`Clip.watermarks()`,
// `Clip.setWatermarks()`): it keeps their ids and writes them down with itself, so nothing inside
// a kind has to carry a marker. The **logo** and the **title** are the whole of the coupling —
// this module listens for them and makes the watermark follow.
//
// The two parts are **independent**, each following its own property: the mark is placed when the
// logo is set and taken away when it is cleared, the line when the title is. A clip with a title
// and no logo wears the line alone, in the corner. So a part the person takes away stays away —
// removing the title line is not undone by a change to the logo, nor by the clip being opened
// again — and the part is placed again only when its **own** property moves.
//
// A logo is a file the app serves, so its bytes are fetched from the app's own folder into the
// **picture store** under a name of its own (`ui/logos.ts`): the image kind draws pictures from
// there, so the mark is drawn by that kind rather than by one fitted to it.

import { session } from '../../session.js';
import { Span } from '../../domain/clip/Span.js';
import { ImageAnnotation } from '../../domain/annotation/ImageAnnotation.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { images } from '../../infra/images.js';
import { logoFile, logoPictureId } from '../logos.js';
import { placeWatermark, placeWatermarkTitle } from '../annotating/picture.js';
import { measureTextWidth } from '../annotating/text-plugin.js';

/** The ids the watermark is made with, so it is one set of annotations the clip keeps. */
const WATERMARK_ID = 'watermark';
const WATERMARK_TITLE_ID = 'watermark-title';

/** Which of the two properties moved, or `picture` when the clip has just got one to draw on. */
export type WatermarkChange = 'logo' | 'title' | 'picture';

// Bumped on every run, so a file that finishes loading after a newer change is dropped.
let seq = 0;

/** Make the clip's watermark follow its logo and its title. Called once, at startup. */
export function initWatermark(): void {
  session.clip.onChange(event => {
    if (event.type === 'property-changed' && event.id === 'logo') void syncWatermark('logo');
    else if (event.type === 'property-changed' && event.id === 'title') void syncWatermark('title');
    // A logo or a title fixed before there was a picture — by a profile — is placed once the
    // **first** take lands, because a watermark's size is a fraction of the clip's own picture.
    // A later take only lengthens the clip, which `Clip` itself keeps the marks spanning.
    else if (event.type === 'take-added' && event.index === 0) void syncWatermark('picture');
  });
}

/**
 * Put the clip's watermark where its **logo** and its **title** ask, or take a part away.
 *
 * `what` is the property that moved: the part it belongs to is placed or rebuilt, and the other
 * is left exactly as it is — so a part the person took away is not put back by a change to the
 * other one. `picture` is a clip that has just got a picture to draw on, or one being opened: the
 * watermark is placed only when the clip wears **none**, so a removal survives both.
 */
export async function syncWatermark(what: WatermarkChange): Promise<void> {
  const mine = ++seq;
  const name = session.clip.properties.get('logo');
  const title = session.clip.properties.get('title').trim();
  const worn = session.clip.watermarks();
  const wornMark = worn.find((one): one is ImageAnnotation => one instanceof ImageAnnotation) ?? null;
  const wornLine = worn.find((one): one is TextAnnotation => one instanceof TextAnnotation) ?? null;

  // The mark's picture: the app's own file, fetched once into the picture store under its name.
  // It is fetched even when nothing is placed, so a mark restored from a reload draws.
  let imageId: string | null = null;
  if (name) {
    imageId = logoPictureId(name);
    if (!images.get(imageId)) {
      const file = logoFile(name);
      if (file) {
        try {
          await images.put(imageId, await (await fetch(file)).blob());
        } catch {
          imageId = null;                        // a mark that will not load leaves no mark
        }
      } else {
        imageId = null;
      }
    }
    // Overtaken while the file loaded, or the logo changed under us.
    if (mine !== seq || session.clip.properties.get('logo') !== name) return;
  }

  // A clip that already wears one keeps it: what is missing was taken away, or was never wanted.
  if (what === 'picture' && worn.length > 0) return;

  const size = session.clip.size();
  if (!size) return;                             // no picture yet: placed when the first take lands
  const picture = { w: size.width, h: size.height };

  // The mark: placed when the logo moved, kept where the person put it when it did not.
  let mark: ImageAnnotation | null = null;
  if (what === 'title') {
    mark = wornMark;
  } else if (imageId) {
    const source = images.get(imageId) as HTMLImageElement | null;
    const aspect = source && source.naturalWidth > 0 && source.naturalHeight > 0
      ? source.naturalWidth / source.naturalHeight
      : 0;
    if (aspect > 0) {
      mark = wornMark && wornMark.geometry.imageId === imageId
        ? wornMark
        : ImageAnnotation.create(Span.of(0, 1), placeWatermark(imageId, aspect, picture), WATERMARK_ID);
    }
  }

  // And the title: its words follow the title and its place follows the mark, so it is placed
  // afresh when either of them moves — kept as it is only when the title moved and says the same
  // words. A line the person took away is not placed at all.
  let line: TextAnnotation | null = null;
  if (title && (what !== 'logo' || wornLine)) {
    const kept = what !== 'logo' && wornLine && wornLine.geometry.text === title ? wornLine : null;
    line = kept ?? TextAnnotation.create(
      Span.of(0, 1),
      placeWatermarkTitle(title, mark?.geometry ?? null, (text, height) => measureTextWidth(text, height, picture)),
      WATERMARK_TITLE_ID,
    );
  }

  const next: Annotation[] = [];
  if (mark) next.push(mark);
  if (line) next.push(line);
  session.clip.setWatermarks(next);
}
