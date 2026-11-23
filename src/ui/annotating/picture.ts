// Preparing a picture, and placing it, for both ways one arrives.
//
// The kind's own action chooses a picture through a picker, a paste or a drop; an agent
// is handed the picture the person put on their clipboard. The picture is the same
// either way, so the measurement and the placement are the same code: a picture is
// downscaled once if it is far bigger than the recording (the clip and the frame cost
// stay bounded), and it lands centred at a default width keeping its own proportions.
// Re-encoding the *picture* is not re-encoding the recording (spec FR-017).
//
// It lives in the view, beside the kinds, because it touches an `Image` and a canvas;
// `src/domain/` holds the shape, not the bytes.

import type { ImageGeometry } from '../../domain/annotation/ImageAnnotation.js';

/** A picture, measured and — when it was too big — made smaller, ready to keep. */
export interface PreparedPicture {
  readonly blob: Blob;
  /** The picture's own pixel width ÷ height. */
  readonly imageAspect: number;
}

/** Where a new picture goes, when it is not to go centred at the default width. */
export interface Placement {
  /** The rect's left edge, as a fraction of the picture's width. Default: centred. */
  readonly x?: number;
  /** The rect's top edge, as a fraction of the picture's height. Default: centred. */
  readonly y?: number;
  /** How wide, as a fraction of the recording's width. Default `PLACED_WIDTH`. */
  readonly width?: number;
}

/** A picture is kept at most twice the clip's picture, so a zoom-in later is not soft. */
const MAX_SCALE = 2;

/** How wide a picture is placed, as a fraction of the recording's width. */
export const PLACED_WIDTH = 0.4;

/** Decode a picture, measure it, and downscale it once if it is far too big. */
export async function preparePicture(blob: Blob, picture: { w: number; h: number }): Promise<PreparedPicture | null> {
  const image = await decode(blob);
  if (!image) return null;
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!(iw > 0) || !(ih > 0)) return null;

  const maxW = Math.max(1, picture.w) * MAX_SCALE;
  const maxH = Math.max(1, picture.h) * MAX_SCALE;
  if (iw <= maxW && ih <= maxH) return { blob, imageAspect: iw / ih };

  const scale = Math.min(maxW / iw, maxH / ih);
  const cw = Math.max(1, Math.round(iw * scale));
  const ch = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const context = canvas.getContext('2d');
  if (!context) return { blob, imageAspect: iw / ih };
  context.drawImage(image, 0, 0, cw, ch);
  const smaller = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  return smaller ? { blob: smaller, imageAspect: cw / ch } : { blob, imageAspect: iw / ih };
}

/**
 * The geometry to place a prepared picture with: its own proportions kept, centred
 * unless told where, and made smaller rather than taller than the recording when a
 * width that would not fit is asked for. Only the picture's own aspect is needed, so a
 * caller that measured one another way — a **logo** the app serves — places it the same.
 */
export function placePicture(
  imageId: string,
  prepared: { readonly imageAspect: number },
  picture: { w: number; h: number },
  placement: Placement = {},
): ImageGeometry {
  const pictureAspect = (picture.w || 1) / (picture.h || 1);
  const asked = placement.width;
  const wanted = typeof asked === 'number' && Number.isFinite(asked) && asked > 0
    ? Math.min(1, asked)
    : PLACED_WIDTH;
  let width = wanted;
  let height = (width * pictureAspect) / prepared.imageAspect;
  if (height > 1) { height = 1; width = (height * prepared.imageAspect) / pictureAspect; }
  const x = typeof placement.x === 'number' && Number.isFinite(placement.x) ? placement.x : (1 - width) / 2;
  const y = typeof placement.y === 'number' && Number.isFinite(placement.y) ? placement.y : (1 - height) / 2;
  return {
    imageId,
    // Pulled inside the picture here as well as in the kind, so the geometry handed on
    // is the one that will be drawn rather than a rect the kind quietly corrects.
    x: Math.min(Math.max(0, x), 1 - width),
    y: Math.min(Math.max(0, y), 1 - height),
    width,
    height,
    imageAspect: prepared.imageAspect,
    pictureAspect,
  };
}

/**
 * Where the clip's **watermark** sits: small, in the top-right corner, a margin in from the
 * edge — as wide as the row, and no taller than `maxHeight`, so a tall mark does not run down
 * the picture. A mark is **scaled, never stretched**, whatever its shape.
 */
export const WATERMARK = { width: 0.07, maxHeight: 0.09, margin: 0.03 };

/**
 * The geometry for a **logo** drawn as the clip's **watermark**: an image whose picture is a
 * file the app serves itself (`ui/logos.ts`) rather than bytes the person chose — so the
 * picture is the logo's **name**, and its own proportions are kept.
 */
export function placeWatermark(
  logo: string,
  imageAspect: number,
  picture: { w: number; h: number },
): ImageGeometry {
  const pictureAspect = (picture.w || 1) / (picture.h || 1);
  // As wide as the row, unless that would make it taller than the corner may hold.
  let width = WATERMARK.width;
  if ((width * pictureAspect) / imageAspect > WATERMARK.maxHeight) {
    width = (WATERMARK.maxHeight * imageAspect) / pictureAspect;
  }
  const placed = placePicture('', { imageAspect }, picture, {
    x: 1 - WATERMARK.margin - width,
    y: WATERMARK.margin,
    width,
  });
  return { ...placed, logo };
}

function decode(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    image.src = url;
  });
}