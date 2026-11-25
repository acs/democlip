import { describe, expect, it } from 'vitest';

import { Magnifier, DEFAULT_ZOOM } from '../../domain/annotation/Magnifier.js';
import { Span } from '../../domain/clip/Span.js';
import { pluginOf, propertiesOf } from './annotation-plugin.js';
import type { CreationContext } from './annotation-plugin.js';
import { magnifierPlugin, radiusOf } from './magnifier-plugin.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';

const WIDE = { w: 1280, h: 720 };

/** A creation context that answers the creation drags in order, and reports the outcome. */
function context(drags: Array<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>) {
  const said: string[] = [];
  const abandoned: string[] = [];
  let committed: Annotation | null = null;
  let resolve!: (one: Annotation) => void;
  const done = new Promise<Annotation>(done => { resolve = done; });
  let at = 0;
  const ctx: CreationContext = {
    span: Span.of(0.2, 0.4),
    picture: WIDE,
    colour: '#38a169',
    drag: async () => drags[Math.min(at++, drags.length - 1)] ?? null,
    draft: () => {},
    commit: annotation => { committed = annotation; resolve(annotation); },
    abandon: message => { abandoned.push(message); },
    cancel: message => { abandoned.push(message); },
    say: message => { said.push(message); },
  };
  return { ctx, said, abandoned, done, committed: () => committed };
}

describe('the magnifier plugin', () => {
  it('is registered, reads the picture, and offers its colour and its zoom', () => {
    const plugin = pluginOf('magnifier');
    expect(plugin?.action.label).toBe('Magnifier');
    expect(plugin?.renderer.readsPicture).toBe(true);
    expect(plugin?.properties?.map(property => property.id)).toEqual(['colour', 'zoom']);

    const zoom = plugin!.properties![1];
    expect(zoom.control).toBe('number');
    expect(zoom.suffix).toBe('×');
    expect(zoom.step).toBe(0.5);
    expect(zoom.min).toBe(1.5);
    expect(zoom.max).toBe(8);
  });

  it('makes one by a drag from the detail outward, in the clip’s colour, at the default zoom', async () => {
    const { ctx, said, done } = context([{ from: { x: 0.5, y: 0.5 }, to: { x: 0.7, y: 0.5 } }]);
    magnifierPlugin.begin(ctx);
    const made = await done;

    expect(made).toBeInstanceOf(Magnifier);
    const lens = made as Magnifier;
    expect(lens.geometry.x).toBe(0.5);
    expect(lens.geometry.y).toBe(0.5);
    expect(lens.geometry.radius).toBeCloseTo((0.2 * WIDE.w) / Math.min(WIDE.w, WIDE.h));
    expect(lens.geometry.zoom).toBe(DEFAULT_ZOOM);
    expect(lens.colour).toBe('#38a169');
    expect(said[0]).toContain('MAGNIFIER');
  });

  it('refuses a stray click and a circle too small, and stays armed for a wider drag', async () => {
    const { ctx, abandoned, done } = context([
      null,                                                        // a stray click
      { from: { x: 0.5, y: 0.5 }, to: { x: 0.5005, y: 0.5 } },     // not a lens
      { from: { x: 0.5, y: 0.5 }, to: { x: 0.7, y: 0.5 } },        // a lens
    ]);
    magnifierPlugin.begin(ctx);
    const made = await done;

    expect(made).toBeInstanceOf(Magnifier);
    expect(abandoned.length).toBe(2);
    expect(abandoned[0]).toContain('drag from the detail outward');
    expect(abandoned[1]).toContain('wider circle');
  });

  it('changes its rim colour and its zoom through the properties, and refuses a zoom outside the range', () => {
    const lens = Magnifier.create(Span.of(0.2, 0.4), { x: 0.5, y: 0.5, radius: 0.2, zoom: 2 })!;
    const [colour, zoom] = propertiesOf(lens);

    expect(colour.value(lens)).toBe(Magnifier.DEFAULT_COLOUR);
    expect(colour.with(lens, '#3182ce')).toBeInstanceOf(Magnifier);
    expect((colour.with(lens, '#3182ce') as Magnifier).colour).toBe('#3182ce');
    expect(colour.with(lens, 'nonsense')).toBeNull();

    expect(zoom.value(lens)).toBe('2');
    expect((zoom.with(lens, '3') as Magnifier).geometry.zoom).toBe(3);
    expect(zoom.with(lens, '9')).toBeNull();
    expect(zoom.with(lens, '0.5')).toBeNull();
    expect(zoom.with(lens, 'nonsense')).toBeNull();
  });

  it('turns a drag in the picture into a fraction of its shorter side', () => {
    expect(radiusOf(WIDE, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 })).toBeCloseTo((0.1 * 1280) / 720);
    expect(radiusOf({ w: 720, h: 1280 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })).toBeCloseTo((0.1 * 1280) / 720);
    expect(radiusOf({ w: 0, h: 0 }, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 })).toBe(0);
  });
});