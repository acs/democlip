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

// Bumped on every run, so a file that finishes loading after a newer change is dropped.
let seq = 0;

/** Make the clip's watermark follow its logo and its title. Called once, at startup. */
export function initWatermark(): void {
  session.clip.onChange(event => {
    if (event.type === 'property-changed' && (event.id === 'logo' || event.id === 'title')) {
      void syncWatermark(true);
    }
    // A logo or a title fixed before there was a picture — by a profile — is placed once the
    // **first** take lands, because a watermark's size is a fraction of the clip's own picture.
    // A later take only lengthens the clip, which `Clip` itself keeps the marks spanning.
    else if (event.type === 'take-added' && event.index === 0) void syncWatermark(false);
  });
}

/**
 * Put the clip's watermark where its **logo** and **title** ask, or — when the logo has just been
 * cleared — take it away. Safe at any time: a mark or a line already right keeps the place the
 * person gave it, and a clip with no picture yet waits for the first take.
 *
 * `remove` is true only for a change to the clip's own **logo** or **title**: a watermark that
 * came with an imported file, with no property behind it, is the person's and is left alone by a
 * restore or a take.
 */
export async function syncWatermark(remove: boolean): Promise<void> {
  const mine = ++seq;
  const name = session.clip.properties.get('logo');
  const title = session.clip.properties.get('title').trim();
  const worn = session.clip.watermarks();
  const wornMark = worn.find((one): one is ImageAnnotation => one instanceof ImageAnnotation);
  const wornTitle = worn.find((one): one is TextAnnotation => one instanceof TextAnnotation);

  if (!name) {
    if (remove) session.clip.setWatermarks([]);
    return;
  }

  const size = session.clip.size();
  if (!size) return;                             // no picture yet: placed when the first take lands
  const picture = { w: size.width, h: size.height };

  // The mark's picture: the app's own file, fetched once into the picture store under its name.
  const imageId = logoPictureId(name);
  if (!images.get(imageId)) {
    const file = logoFile(name);
    if (!file) return;
    try {
      await images.put(imageId, await (await fetch(file)).blob());
    } catch {
      return;                                    // a mark that will not load leaves no watermark
    }
  }
  // Overtaken while the file loaded, or the logo changed under us.
  if (mine !== seq || session.clip.properties.get('logo') !== name) return;

  const source = images.get(imageId) as HTMLImageElement | null;
  if (!source || !(source.naturalWidth > 0) || !(source.naturalHeight > 0)) return;
  const imageAspect = source.naturalWidth / source.naturalHeight;

  // The mark: kept where the person put it when it is the same mark, made afresh when it is not.
  const mark = wornMark && wornMark.geometry.imageId === imageId
    ? wornMark
    : ImageAnnotation.create(Span.of(0, 1), placeWatermark(imageId, imageAspect, picture), WATERMARK_ID);
  if (!mark) return;

  const next: Annotation[] = [mark];
  if (title) {
    // And the clip's title under it, 20% smaller — kept where it is when it says the same words.
    const kept = wornTitle && wornTitle.geometry.text === title ? wornTitle : null;
    const line = kept ?? TextAnnotation.create(
      Span.of(0, 1),
      placeWatermarkTitle(title, mark.geometry, (text, height) => measureTextWidth(text, height, picture)),
      WATERMARK_TITLE_ID,
    );
    if (line) next.push(line);
  }
  session.clip.setWatermarks(next);
}
