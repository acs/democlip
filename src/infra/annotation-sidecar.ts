// The sidecar as a file: the app's own shape, written beside the video.
//
// The file is what travels — out through a downloads folder, past whatever works on the
// video, and back — so it is plain JSON a person can open and read, carrying a version so
// that a sidecar of another shape is left alone rather than half-understood. A picture's
// bytes have nowhere to live in JSON, so they are base64, which is what a `data:` URL
// already is.
//
// The name is the video's own name and `.json`, so a sidecar is found by looking beside
// the file it belongs to: that is the whole of the convention, and the import relies on it.

import { AnnotationSidecar, type SidecarPicture } from '../domain/clip/AnnotationSidecar.js';
import type { StoredAnnotation } from '../domain/annotation/Annotation.js';

/** The shape of the file itself. A sidecar of another version is not ours to read. */
export const SIDECAR_FORMAT = 1;

interface WrittenPicture {
  readonly id: string;
  readonly type: string;
  readonly data: string;
}

interface WrittenSidecar {
  readonly version: number;
  readonly length: number;
  readonly annotations: readonly StoredAnnotation[];
  readonly pictures?: readonly WrittenPicture[];
}

/**
 * What a sidecar for a file is called: the file's own name with its extension replaced by
 * `.democlip.json`. So `democlip-1755021992.webm` is written with
 * `democlip-1755021992.democlip.json` beside it — one name, one timestamp, two files that
 * plainly belong together. The video keeps its extension, so nothing has to guess what kind
 * of file it is.
 */
export function sidecarNameFor(file: string): string {
  const dot = file.lastIndexOf('.');
  return `${dot > 0 ? file.slice(0, dot) : file}.democlip.json`;
}

/** The sidecar as the file's own text. */
export async function writeSidecar(sidecar: AnnotationSidecar): Promise<string> {
  const pictures: WrittenPicture[] = [];
  for (const picture of sidecar.pictures) {
    pictures.push({
      id: picture.id,
      type: picture.blob.type || 'image/png',
      data: bytesToBase64(new Uint8Array(await picture.blob.arrayBuffer())),
    });
  }
  const written: WrittenSidecar = {
    version: SIDECAR_FORMAT,
    length: Math.round(sidecar.length * 1000) / 1000,
    annotations: sidecar.stored,
    ...(pictures.length ? { pictures } : {}),
  };
  return JSON.stringify(written, null, 2);
}

/** What the text holds, or null when it is not a sidecar this version can read. */
export function readSidecar(text: string): AnnotationSidecar | null {
  let written: Partial<WrittenSidecar>;
  try {
    written = JSON.parse(text) as Partial<WrittenSidecar>;
  } catch {
    return null;
  }
  if (!written || written.version !== SIDECAR_FORMAT) return null;
  if (typeof written.length !== 'number' || !(written.length > 0)) return null;
  if (!Array.isArray(written.annotations)) return null;

  const pictures: SidecarPicture[] = [];
  for (const picture of written.pictures ?? []) {
    if (!picture || typeof picture.id !== 'string' || typeof picture.data !== 'string') continue;
    pictures.push({
      id: picture.id,
      blob: new Blob([base64ToBytes(picture.data)], { type: picture.type || 'image/png' }),
    });
  }
  return AnnotationSidecar.of(written.length, written.annotations, pictures);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
