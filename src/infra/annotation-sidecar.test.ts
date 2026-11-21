import { describe, expect, it } from 'vitest';

import { readSidecar, sidecarNameFor, writeSidecar } from './annotation-sidecar.js';
import { AnnotationSidecar } from '../domain/clip/AnnotationSidecar.js';
import { Arrow } from '../domain/annotation/Arrow.js';
import { Span } from '../domain/clip/Span.js';
import type { StoredAnnotation } from '../domain/annotation/Annotation.js';

/** A real arrow, written down the way a clip writes one down. */
function arrow(s: number, e: number): StoredAnnotation {
  const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.2 }, { x: 0.6, y: 0.7 });
  if (!made) throw new Error('the test could not make an arrow');
  return made.stored();
}

describe('a sidecar as a file', () => {
  it('is the file\u2019s own name with the extension replaced', () => {
    expect(sidecarNameFor('democlip-1755021992.webm')).toBe('democlip-1755021992.democlip.json');
    expect(sidecarNameFor('clip.mp4')).toBe('clip.democlip.json');
    expect(sidecarNameFor('no-extension')).toBe('no-extension.democlip.json');
  });

  it('reads back what it wrote, length and annotations together', async () => {
    const stored = arrow(0.25, 0.5);

    const text = await writeSidecar(AnnotationSidecar.of(4, [stored]));
    const read = readSidecar(text);

    expect(read?.length).toBe(4);
    const [annotation] = read!.forLength(4)!.all;
    expect(annotation.id).toBe(stored.id);
    expect(annotation.kind).toBe('arrow');
    expect(annotation.span.s).toBeCloseTo(0.25);
  });

  it('is a file a person can read: plain JSON, and shaped like the app', async () => {
    const text = await writeSidecar(AnnotationSidecar.of(4, [arrow(0.25, 0.5)]));

    const written = JSON.parse(text) as Record<string, unknown>;
    expect(written.version).toBe(1);
    expect(written.length).toBe(4);
    expect(Array.isArray(written.annotations)).toBe(true);
    // Nothing to carry a picture for, so nothing about pictures is written.
    expect(written.pictures).toBeUndefined();
  });

  it('carries a picture\u2019s bytes out and back, unchanged', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const picture = { id: 'im-1', blob: new Blob([bytes], { type: 'image/png' }) };

    const text = await writeSidecar(AnnotationSidecar.of(4, [arrow(0.1, 0.2)], [picture]));
    const read = readSidecar(text)!;

    expect(read.pictures).toHaveLength(1);
    expect(read.pictures[0].id).toBe('im-1');
    expect(read.pictures[0].blob.type).toBe('image/png');
    expect(new Uint8Array(await read.pictures[0].blob.arrayBuffer())).toEqual(bytes);
  });

  it('reads anything that is not a sidecar of this version as none of ours', () => {
    expect(readSidecar('not json at all')).toBeNull();
    expect(readSidecar('{"hello":"world"}')).toBeNull();
    expect(readSidecar(JSON.stringify({ version: 99, length: 4, annotations: [] }))).toBeNull();
    expect(readSidecar(JSON.stringify({ version: 1, annotations: [] }))).toBeNull();
    expect(readSidecar(JSON.stringify({ version: 1, length: 0, annotations: [] }))).toBeNull();
    expect(readSidecar(JSON.stringify({ version: 1, length: 4 }))).toBeNull();
  });
});
