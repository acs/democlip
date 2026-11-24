// A timeline thumbnail: a small picture of one frame, at the picture's own shape.
//
// The strip's cells are laid out by the stylesheet and are not the picture's shape
// — a crop makes a picture whatever the drag was, and a portrait region is a
// perfectly ordinary one. Drawing that picture into a cell-sized bitmap of some
// other shape would stretch it, so the timeline would show something the clip does
// not hold. Instead the bitmap keeps the picture's aspect ratio and the stylesheet
// fits it to the cell (`object-fit: cover`), which crops rather than stretches.
//
// Both the strip the review builds and the strip the live timeline fills draw
// through here, so the two agree on the shape of a thumbnail.

const LONG_SIDE = 80;   // the bitmap's long side: enough for a cell a few dozen pixels across

/** The bitmap size for a picture: its own shape, its long side at LONG_SIDE. */
export function thumbBox(pictureW: number, pictureH: number): { w: number; h: number } {
  if (!(pictureW > 0) || !(pictureH > 0)) return { w: LONG_SIDE, h: Math.round(LONG_SIDE * 9 / 16) };
  const aspect = pictureW / pictureH;
  return aspect >= 1
    ? { w: LONG_SIDE, h: Math.max(1, Math.round(LONG_SIDE / aspect)) }
    : { w: Math.max(1, Math.round(LONG_SIDE * aspect)), h: LONG_SIDE };
}

/**
 * Draw the `sw`×`sh` region of a picture into a canvas shaped like it, and hand the
 * canvas back. The canvas is resized only when it is not already that shape, so a
 * frame that repeats the last one's shape costs no reallocation.
 */
export function drawThumb(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  sx: number, sy: number, sw: number, sh: number,
): HTMLCanvasElement {
  // A take with no picture — a **sound-only** stretch — has no frame to draw; its cell
  // is left empty rather than throwing over the zero it has no size for.
  if (!(sw > 0) || !(sh > 0)) {
    const blank = canvas.getContext('2d');
    if (blank) blank.clearRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  const { w, h } = thumbBox(sw, sh);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  return canvas;
}
