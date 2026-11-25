// Making an annotation of a kind, from data alone.
//
// The kinds whose shape *is* data can be made by an agent: an arrow's two points, a
// text's words, and an image's rect plus the picture's own bytes — which the server
// reads from the person's clipboard, because a browser will not hand a picture to a
// page that no hand has touched. A kind that needs something the agent cannot supply
// says so rather than making something wrong.
//
// A text is measured with the kind's own measurement, and an image is prepared and
// placed by the kind's own code, so an agent's annotation lands at the same size, place
// and colour as a person's would: the arrow and the text are made in the colour the
// clip's own annotation colour names.
//
// An image is the one maker that is slow — it decodes the picture and keeps it in the
// store before the clip takes the annotation — so a maker may answer with a promise.

import { Arrow } from '../../domain/annotation/Arrow.js';
import { ImageAnnotation } from '../../domain/annotation/ImageAnnotation.js';
import { newAnnotationId } from '../../domain/annotation/Annotation.js';
import { SoundAnnotation } from '../../domain/annotation/SoundAnnotation.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import { DEFAULT_STOCK_SOUND, STOCK_SOUNDS } from '../../domain/sound/StockSounds.js';
import type { AnnotationColour } from '../../domain/annotation/AnnotationColour.js';
import type { Span } from '../../domain/clip/Span.js';
import { images } from '../../infra/images.js';
import { el } from '../dom.js';
import { measureText, measureTextWidth } from '../annotating/text-plugin.js';
import { placePicture, preparePicture } from '../annotating/picture.js';
import type { Made, MakeAnnotation } from './edit.js';
import type { AnnotationParams } from './surface.js';

const MAX_HEIGHT = 0.4;   // a text may not be so tall it swallows the picture

export const makeAnnotation: MakeAnnotation = (kind, params, span, colour) => {
  if (kind === Arrow.id) return makeArrow(params, span, colour);
  if (kind === TextAnnotation.id) return makeText(params, span, colour);
  if (kind === ImageAnnotation.id) return makeImage(params, span);
  if (kind === SoundAnnotation.id) return makeSound(params, span);
  return {
    reason: `the app cannot make a ${kind} from data alone`,
  };
};

function makeArrow(params: AnnotationParams, span: Span, colour: AnnotationColour): Made {
  const from = pointIn(params, 'from');
  const to = pointIn(params, 'to');
  if (!from || !to) {
    return { reason: 'an arrow needs a "from" and a "to", each { x, y } as a fraction of the picture' };
  }
  const arrow = Arrow.create(span, from, to, undefined, colour);
  if (!arrow) return { reason: 'an arrow needs two different points inside the picture' };
  return { annotation: arrow };
}

function makeText(params: AnnotationParams, span: Span, colour: AnnotationColour): Made {
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text) return { reason: 'a text needs words' };

  const picture = { w: el.cv.width, h: el.cv.height };
  const wanted = typeof params.height === 'number' && params.height > 0
    ? Math.min(params.height, MAX_HEIGHT)
    : null;

  // The same measurement the kind uses when a person makes one, so the two agree.
  const box = wanted === null
    ? measureText(text, picture)
    : { width: measureTextWidth(text, wanted, picture), height: wanted };
  if (!box || !(box.width > 0)) return { reason: 'that text could not be measured on this picture' };

  const x = fractionIn(params, 'x') ?? (1 - box.width) / 2;
  const y = fractionIn(params, 'y') ?? (1 - box.height) / 2;
  const annotation = TextAnnotation.create(span, { text, x, y, width: box.width, height: box.height }, undefined, colour);
  if (!annotation) return { reason: 'a text needs a box inside the picture' };
  return { annotation };
}

function makeSound(params: AnnotationParams, span: Span): Made {
  const wanted = typeof params.sound === 'string' && params.sound ? params.sound : DEFAULT_STOCK_SOUND;
  const annotation = SoundAnnotation.create(span, wanted);
  if (!annotation) {
    return { reason: `a sound must be one the app has: ${STOCK_SOUNDS.map(s => s.name).join(', ')}` };
  }
  return { annotation };
}

async function makeImage(params: AnnotationParams, span: Span): Promise<Made> {
  const blob = pictureIn(params.picture);
  if (!blob) {
    return { reason: 'an image needs a "picture", given as { type: "image/png", data } with the bytes base64' };
  }

  const picture = { w: el.cv.width, h: el.cv.height };
  const prepared = await preparePicture(blob, picture);
  if (!prepared) return { reason: 'that picture could not be read' };

  // The same store and the same placement the kind's own action uses: one picture,
  // written once, drawn from the decoded copy.
  const imageId = newAnnotationId();
  try {
    await images.put(imageId, prepared.blob);
  } catch {
    return { reason: 'that picture could not be kept' };
  }

  const annotation = ImageAnnotation.create(span, placePicture(imageId, prepared, picture, {
    x: fractionIn(params, 'x') ?? undefined,
    y: fractionIn(params, 'y') ?? undefined,
    width: fractionIn(params, 'width') ?? undefined,
  }));
  if (!annotation) return { reason: 'that picture did not fit the recording' };
  return { annotation };
}

/** The picture's bytes, as `{ type, data }` with the data base64; null when not one. */
function pictureIn(value: unknown): Blob | null {
  if (!value || typeof value !== 'object') return null;
  const { type, data } = value as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || !type.startsWith('image/')) return null;
  if (typeof data !== 'string' || data.length === 0) return null;
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
  return new Blob([bytes], { type });
}

/** A `{ x, y }` argument, as fractions of the picture, or null when it is not one. */
function pointIn(params: AnnotationParams, key: string): { x: number; y: number } | null {
  const value = params[key];
  if (!value || typeof value !== 'object') return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** A fraction argument, clamped inside the picture, or null when it is not a number. */
function fractionIn(params: AnnotationParams, key: string): number | null {
  const value = params[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}