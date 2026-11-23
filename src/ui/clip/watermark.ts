// The watermark: the mark the clip wears over the whole of its picture.
//
// A clip that wears a **logo** wears it as a **watermark** too — the same mark, over the whole
// clip rather than only on the card at its head. It is one of the clip's own annotations: an
// **image annotation** whose picture is a file the app serves itself, spanning the whole clip,
// placed small in the top-right corner. Because it is an annotation it shows on the timeline
// lane, can be moved and resized, is kept with the clip and is drawn into every export, exactly
// as a picture the person placed is.
//
// The **logo property** is the whole of the coupling: this module listens for it and makes the
// watermark follow — placed when the logo is chosen, taken away when it is cleared. It goes in
// through `Clip.setWatermark`, a load rather than the person's edit, so the one **undo** takes
// back the **logo** and the watermark follows the logo it is left with.
//
// A logo is a file the app serves, not bytes the person chose, so its picture is the **name**
// (`ui/logos.ts`) and the annotation layer resolves it; nothing is uploaded and nothing is
// stored.

import { session } from '../../session.js';
import { Span } from '../../domain/clip/Span.js';
import { ImageAnnotation } from '../../domain/annotation/ImageAnnotation.js';
import { loadLogo, logoImage } from '../exporting/logo-image.js';
import { placeWatermark } from '../annotating/picture.js';

/** The id the watermark is made with, so it is one annotation the clip keeps, not a new one each time. */
const WATERMARK_ID = 'watermark';

// Bumped on every run, so a file that finishes loading after a newer change is dropped.
let seq = 0;

/** Make the clip's watermark follow its logo. Called once, at startup. */
export function initWatermark(): void {
  session.clip.onChange(event => {
    if (event.type === 'property-changed' && event.id === 'logo') void syncWatermark(true);
    // A logo fixed before there was a picture — by a profile — is placed once the **first**
    // take lands, because a watermark's size is a fraction of the clip's own picture. A later
    // take only lengthens the clip, which `Clip` itself keeps the mark spanning.
    else if (event.type === 'take-added' && event.index === 0) void syncWatermark(false);
  });
}

/**
 * Put the clip's watermark where its **logo** asks, or — when the logo has just been cleared —
 * take it away. Safe at any time: a clip already wearing the right mark keeps it where the
 * person put it, and a clip with no picture yet waits for the first take.
 *
 * `remove` is true only for a change to the clip's own **logo**: a watermark that came with an
 * imported file, with no logo property behind it, is the person's and is left alone by a
 * restore or a take.
 */
export async function syncWatermark(remove: boolean): Promise<void> {
  const mine = ++seq;
  const name = session.clip.properties.get('logo');
  const worn = session.clip.watermark();
  const wornLogo = worn instanceof ImageAnnotation ? worn.geometry.logo : undefined;

  // A watermark's picture is a file the app serves: decode it, so the mark draws — whether it
  // is the clip's own or one that came back with an imported file.
  if (wornLogo) await loadLogo(wornLogo);
  if (mine !== seq) return;                      // overtaken: a newer change is in charge

  if (!name) {
    if (remove) session.clip.setWatermark(null);
    return;
  }

  await loadLogo(name);
  // Overtaken while the file loaded, or the logo changed under us.
  if (mine !== seq || session.clip.properties.get('logo') !== name) return;
  if (wornLogo === name) return;                 // already worn, where the person put it

  const size = session.clip.size();
  if (!size) return;                             // no picture yet: placed when the first take lands
  const image = logoImage(name);
  if (!image || !(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return;

  const annotation = ImageAnnotation.create(
    Span.of(0, 1),
    placeWatermark(name, image.naturalWidth / image.naturalHeight, { w: size.width, h: size.height }),
    WATERMARK_ID,
  );
  if (annotation) session.clip.setWatermark(annotation);
}
