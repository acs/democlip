import { describe, expect, it } from 'vitest';

import { ExportPlan, type ExportSettings } from './ExportPlan.js';
import { Take } from './Take.js';
import { IntroCard } from './IntroCard.js';
import { TimelineMap } from './TimelineMap.js';
import { Span } from './Span.js';
import { AnnotationSet } from '../annotation/AnnotationSet.js';
import { Arrow } from '../annotation/Arrow.js';
import { SoundAnnotation } from '../annotation/SoundAnnotation.js';

// Two 5s takes, so the clip is 10s and a join falls halfway along it. They carry a
// picture, as a recorded or imported take does; the sound-only case has takes of its own.
const takes = [
  Take.of(1, new Blob(['x']), 'blob:1', 5, { width: 1280, height: 720 }, true),
  Take.of(2, new Blob(['x']), 'blob:2', 5, { width: 1280, height: 720 }, true),
];
const soundOnlyTakes = [
  Take.of(1, new Blob(['x']), 'blob:1', 5),
  Take.of(2, new Blob(['x']), 'blob:2', 5),
];

// What a clip of those takes says when 3s-4s was cut out: three kept stretches,
// the last one in the second take, and the join where the takes meet.
const parts = () => ({
  map: TimelineMap.forClip([{ s: 0.3, e: 0.4 }], 10),
  segments: [
    { takeIndex: 0, from: 0, to: 3 },
    { takeIndex: 0, from: 4, to: 5 },
    { takeIndex: 1, from: 5, to: 10 },
  ],
});

const planOf = (settings: ExportSettings = { fadeSeconds: 0.08, annotations: 'drawn' }): ExportPlan =>
  ExportPlan.of(parts().segments, takes, 10, parts().map, settings);

const arrow = (id: string, s: number, e: number): Arrow => {
  const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, id);
  if (!made) throw new Error('the test arrow should be usable');
  return made;
};

const sound = (id: string, s: number, e: number, name = 'chime'): SoundAnnotation => {
  const made = SoundAnnotation.create(Span.of(s, e), name, id);
  if (!made) throw new Error('the test sound should be usable');
  return made;
};

describe('the plan’s sound annotations', () => {
  it('answers where a sound lands in the file, in its own seconds — one entry per kept part', () => {
    // A sound over 2s…6s of the recording, with 3s…4s cut out: three kept parts, so three
    // soundings, each resuming the sound where the last left off.
    const plan = ExportPlan.of(parts().segments, takes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, null, false, [sound('s1', 0.2, 0.6)]);
    expect(plan.soundings()).toEqual([
      { sound: 'chime', at: 2, from: 0, length: 1 },
      { sound: 'chime', at: 3, from: 2, length: 1 },
      { sound: 'chime', at: 4, from: 3, length: 1 },
    ]);
  });

  it('answers nothing for a sound whose whole stretch is cut away', () => {
    const plan = ExportPlan.of(parts().segments, takes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, null, false, [sound('s1', 0.3, 0.4)]);
    expect(plan.soundings()).toEqual([]);
  });

  it('gives a clip whose takes are silent sound to write when it holds a sound', () => {
    const withSound = ExportPlan.of(parts().segments, soundOnlyTakes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, null, false, [sound('s1', 0.2, 0.6)]);
    expect(withSound.audio).toBe(true);
    const without = ExportPlan.of(parts().segments, soundOnlyTakes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' });
    expect(without.audio).toBe(false);
  });
});

describe('ExportPlan', () => {
  it('places the kept stretches end to end, closing the cut', () => {
    const plan = planOf();
    expect(plan.pieces.map(p => [p.takeIndex, p.at])).toEqual([[0, 0], [0, 3], [1, 4]]);
    expect(plan.total).toBeCloseTo(9);          // 10s of recording, 1s of it cut out
  });

  it('says which stretch of each take to decode, in the take’s own seconds', () => {
    expect(planOf().steps.map(s => [s.takeIndex, s.localTo]))
      .toEqual([[0, 5], [1, 5]]);
  });

  it('gives each kept stretch in its own take’s seconds, which is what a single-take decoder indexes by', () => {
    // A piece's times are the **recording's**: the second take's stretch runs 5s…10s of the
    // clip, and 0s…5s of that take. Reading the first against the second take's buffer lands
    // past its end — which is how a clip of two takes came to be measured by its first alone.
    expect(planOf().localPieces()).toEqual([
      { takeIndex: 0, from: 0, to: 3, at: 0 },
      { takeIndex: 0, from: 4, to: 5, at: 3 },
      { takeIndex: 1, from: 0, to: 5, at: 4 },
    ]);
  });

  it('keeps the file’s own time out of the takes’ seconds, card or no card', () => {
    // `at` is where a stretch lands in the file, so a card at the head pushes it along; `from`
    // and `to` are the take's own either way, since the card is not part of any take.
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const plan = ExportPlan.of(
      parts().segments, takes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, intro,
    );
    expect(plan.localPieces().map(piece => piece.at)).toEqual([3, 6, 7]);
    expect(plan.localPieces().map(piece => [piece.from, piece.to])).toEqual([[0, 3], [4, 5], [0, 5]]);
  });

  it('marks the join where one take follows another, and nowhere else', () => {
    const plan = planOf();
    expect(plan.steps.map(s => s.joinAt)).toEqual([null, 4]);
    expect(plan.pieces.map((_, i) => plan.joinsPrev(i))).toEqual([false, false, true]);
    expect(plan.pieces.map((_, i) => plan.joinsNext(i))).toEqual([false, true, false]);
  });

  it('maps a moment of the recording to the file, a cut included', () => {
    const plan = planOf();
    expect(plan.outputTimeOf(2)).toBeCloseTo(2);
    expect(plan.outputTimeOf(4)).toBeCloseTo(3);      // where the second stretch begins
    expect(plan.outputTimeOf(3.5)).toBeCloseTo(3);    // inside the cut: the time before it
    expect(plan.outputTimeOf(9)).toBeCloseTo(8);
  });

  it('knows where each take begins on the recording', () => {
    expect(planOf().startOf(1)).toBeCloseTo(5);
  });

  it('stops each take where the export ends', () => {
    const { map } = parts();
    const plan = ExportPlan.of(
      [{ takeIndex: 1, from: 5, to: 8 }], takes, 8, map,
      { fadeSeconds: 0.08, annotations: 'drawn' });
    expect(plan.pieces.map(p => p.at)).toEqual([0]);
    expect(plan.total).toBeCloseTo(3);
    expect(plan.steps[0].joinAt).toBeNull();          // one take only: nothing to join to
    expect(plan.steps[0].localTo).toBeCloseTo(3);     // 5s into the take is 3s of it
    expect(plan.outputTimeOf(6)).toBeCloseTo(5);      // 6s in is 5s kept, cut included
  });

  it('carries what an export needs that is not the clip', () => {
    const plan = planOf({ fadeSeconds: 0.5, annotations: 'drawn' });
    expect(plan.audio).toBe(true);          // the kept takes carry sound
    expect(plan.fadeSeconds).toBe(0.5);
  });

  it('says whether the file holds a picture — a sound-only clip holds none', () => {
    expect(planOf().soundOnly).toBe(false);

    const soundOnly = ExportPlan.of(parts().segments, soundOnlyTakes, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' });
    expect(soundOnly.soundOnly).toBe(true);
    expect(soundOnly.audio).toBe(false);

    // One take with a picture among sound-only ones is enough: the stretch with no
    // picture is written as black.
    const mixed = [Take.of(1, new Blob(['x']), 'blob:1', 5), takes[1]];
    const plan = ExportPlan.of(parts().segments, mixed, 10, parts().map,
      { fadeSeconds: 0.08, annotations: 'drawn' });
    expect(plan.soundOnly).toBe(false);
    expect(plan.audio).toBe(true);
  });

  it('pushes the clip along by the title card at the head', () => {
    const { map, segments } = parts();
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const plan = ExportPlan.of(segments, takes, 10, map, { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, intro);

    expect(plan.intro).toBe(intro);
    expect(plan.introSeconds).toBe(3);
    expect(plan.pieces.map(p => p.at)).toEqual([3, 6, 7]);   // each kept stretch, three later
    expect(plan.total).toBeCloseTo(12);                      // 9s of clip and 3s of card
    expect(plan.steps.map(s => s.joinAt)).toEqual([null, 7]); // the first join is on the clip too
    expect(plan.outputTimeOf(2)).toBeCloseTo(5);              // a moment of the clip, three in
  });

  it('has no card, and pushes nothing, when the export has none', () => {
    const plan = planOf();
    expect(plan.intro).toBeNull();
    expect(plan.introSeconds).toBe(0);
    expect(plan.total).toBeCloseTo(9);
  });

  it('puts no card on a sound-only file, which has no picture to draw it on', () => {
    const { map, segments } = parts();
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const plan = ExportPlan.of(segments, soundOnlyTakes, 10, map,
      { fadeSeconds: 0.08, annotations: 'drawn' }, AnnotationSet.EMPTY, intro);

    expect(plan.soundOnly).toBe(true);
    expect(plan.intro).toBeNull();
    expect(plan.introSeconds).toBe(0);
    expect(plan.pieces[0].at).toBe(0);          // the sound is not pushed along
    expect(plan.total).toBeCloseTo(9);
  });

  it('shows the annotations through the same mapping the review uses', () => {
    const { map, segments } = parts();                    // 3s-4s cut out of 10s
    // Added in the reverse of their draw order, so the order asserted below is the
    // set's (by where each stretch starts) and not the order they were added in.
    const annotations = AnnotationSet.EMPTY.add(arrow('b', 0.5, 0.9)).add(arrow('a', 0.1, 0.6));
    const plan = ExportPlan.of(segments, takes, 10, map, { fadeSeconds: 0.08, annotations: 'drawn' }, annotations);

    expect(plan.annotationsAt(5.5).map(a => a.id)).toEqual(['a', 'b']);   // 5s-6s: both
    expect(plan.annotationsAt(3.5)).toEqual([]);                          // inside the cut
    expect(plan.annotationsAt(8.5).map(a => a.id)).toEqual(['b']);        // only the later one
  });
});
