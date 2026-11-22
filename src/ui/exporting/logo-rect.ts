// Where a card's logo goes, and the rectangle it is drawn in.
//
// A logo is **scaled and never stretched**: a mark that has been deformed is a wrong mark, and it
// is the kind of thing a card can do quietly. So the rectangle is worked out here, in pixels,
// where both edges are the same kind of number — the mistake this module exists to prevent is
// comparing a fraction of the picture's *width* with a fraction of its *height*, which are
// different lengths, and stretching the mark to fit.
//
// A mark is drawn as tall as the row, whatever its shape, and only a very wide one is bounded by
// the picture's width instead. That is how a row of logos is read: the eye compares heights.
//
// It is free of the DOM, so the rule can be proved in node.

/** The card's logo row: how tall a mark is drawn, the widest it may be, and where it starts. */
export const LOGO_ROW = {
  /** The top of the row, as a fraction of the picture's height. */
  y: 0.09,
  /** How tall a mark is drawn, as a fraction of the picture's height. */
  h: 0.22,
  /** The widest a mark may be, as a fraction of the picture's width. */
  maxW: 0.3,
};

/** What the card's words keep clear above them, as a fraction of the picture's height. */
export const LOGO_SPACE = LOGO_ROW.y + LOGO_ROW.h + 0.05;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The rectangle a mark is drawn in, in pixels of a `picture` — as tall as the row, as wide as
 * its own proportions make it, bounded by the picture's width when it is very wide, and centred
 * across the picture. The mark's proportions come out exactly as they went in.
 */
export function logoRect(
  picture: { w: number; h: number },
  mark: { width: number; height: number },
): Rect {
  const aspect = mark.width / mark.height;
  let height = LOGO_ROW.h * picture.h;
  let width = height * aspect;

  const widest = LOGO_ROW.maxW * picture.w;
  if (width > widest) {
    width = widest;
    height = width / aspect;
  }

  const rowTop = LOGO_ROW.y * picture.h;
  const rowHeight = LOGO_ROW.h * picture.h;
  return {
    x: (picture.w - width) / 2,
    // Centred in the row, so a mark the width bounded sits in the same band as the rest.
    y: rowTop + (rowHeight - height) / 2,
    width,
    height,
  };
}
