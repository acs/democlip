// Where an export takes the first frame it needs from a file: the sample at a moment, or
// the file's own first sample when that moment cannot be named.
//
// A file's first video timestamp is not always a time a lookup can name. An MP4 with an
// edit list — B-frames, encoder priming — can start slightly before zero, and asking for
// that moment finds nothing. The frame is still there, so a miss falls back to the first
// sample the track yields: a card wants the first frame, however it is found.

/** Just enough of a sample sink for the rule above — MediaBunny's own satisfies it. */
export interface SampleSink<T> {
  getSample(timestamp: number): Promise<T | null>;
  samples(startTimestamp?: number): AsyncIterable<T>;
}

/**
 * The sample at `at`, or the file's first sample when `at` names nothing. Null only when
 * the track has no sample at all.
 */
export async function firstPresentedSample<T>(sink: SampleSink<T>, at: number): Promise<T | null> {
  const atTime = await sink.getSample(at);
  if (atTime) return atTime;
  for await (const sample of sink.samples()) return sample;
  return null;
}
