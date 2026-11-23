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
// Each part follows its **own** property, so a part the person takes away stays away: removing
// the title line is not undone by a change to the logo, nor by the clip being opened again. The
// line is placed again only when the **title** changes, the mark only when the **logo** does —
// and clearing the logo takes the whole watermark away, since the mark is what it hangs on.
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
 * other one. `picture` is a clip that has just got a picture to draw on, or one being opened: a
 * watermark is placed only when the clip wears **none**, so a removal survives both.
 *
 * A clip with no logo wears no watermark at all; clearing the logo takes it away.
 */
export async function syncWatermark(what: WatermarkChange): Promise<void> {
  const mine = ++seq;
  const name = session.clip.properties.get('logo');
  const title = session.clip.properties.get('title').trim();
  const worn = session.clip.watermarks();
  const wornMark = worn.find((one): one is ImageAnnotation => one instanceof ImageAnnotation) ?? null;
  const wornLine = worn.find((one): one is TextAnnotation => one instanceof TextAnnotation) ?? null;

  if (!name) {
    if (what === 'logo') session.clip.setWatermarks([]);
    return;
  }

  // The mark's picture: the app's own file, fetched once into the picture store under its name.
  // It is fetched even when nothing is placed, so a mark restored from a reload draws.
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

  // A clip that already wears one keeps it: what is missing was taken away, or was never wanted.
  if (what === 'picture' && worn.length > 0) return;

  const size = session.clip.size();
  if (!size) return;                             // no picture yet: placed when the first take lands
  const picture = { w: size.width, h: size.height };
  const source = images.get(imageId) as HTMLImageElement | null;
  if (!source || !(source.naturalWidth > 0) || !(source.naturalHeight > 0)) return;
  const imageAspect = source.naturalWidth / source.naturalHeight;

  // The mark: placed when the logo moved, kept where the person put it when it did not.
  const mark = what === 'title' && !wornMark
    ? null
    : wornMark && wornMark.geometry.imageId === imageId
      ? wornMark
      : ImageAnnotation.create(Span.of(0, 1), placeWatermark(imageId, imageAspect, picture), WATERMARK_ID);

  const next: Annotation[] = [];
  if (mark) next.push(mark);

  // And the title under it: placed when the title moved, kept when it did not. It hangs on the
  // mark, so there is no line without one.
  if (mark && title && (what !== 'logo' || wornLine)) {
    const line = wornLine && wornLine.geometry.text === title
      ? wornLine
      : TextAnnotation.create(
        Span.of(0, 1),
        placeWatermarkTitle(title, mark.geometry, (text, height) => measureTextWidth(text, height, picture)),
        WATERMARK_TITLE_ID,
      );
    if (line) next.push(line);
  }

  session.clip.setWatermarks(next);
}
