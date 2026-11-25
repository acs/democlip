// The sound boost at the browser's edge: the decode, the measurement, and the one gain.
//
// The rule is the domain's — `Loudness` measures, `SoundBoost.gainFor` turns the two numbers
// into a gain — and this module is the browser's half of it: decoding the **kept** stretches
// of the takes and turning them into the number both the export and the review apply. Both
// call it, over the same kept sound, so what is heard is what the file carries.
//
// The stretches are the plan's `localPieces()`: a take's own seconds, which is what its decoded
// buffer is indexed by. Reading a piece's **recording** times against one take's buffer is the
// mistake this seam exists to make impossible — it lands past the end of every take but the
// first, and a clip of two takes would then be measured by its first alone.
//
// It decodes one take at a time and keeps only what the meter accumulates — never the whole
// clip's samples — so a long clip does not have to fit in memory to be measured. The answer
// is cached against the **sound**: a take added or a cut approved measures again, while
// switching the boost off and on reuses it.

import { LoudnessMeter, type Measurement } from '../domain/sound/Loudness.js';
import { gainFor } from '../domain/sound/SoundBoost.js';
import type { ExportPlan, LocalPiece } from '../domain/clip/ExportPlan.js';

/** The rate the measurement is taken at, the same one the export mixes at. */
const SAMPLE_RATE = 48_000;

/** The channels the measurement counts: what the browser plays and the export writes. */
const CHANNELS = 2;

/**
 * The loudness and the peak of the sound an export keeps, from takes already decoded. The
 * export calls this with the buffers it mixed from, so it measures the same samples the
 * review does without decoding anything a second time.
 *
 * `pieces` is `ExportPlan.localPieces()` — each stretch in its **own take's** seconds.
 */
export function measureKept(
  decoded: ReadonlyMap<number, AudioBuffer | null>,
  pieces: readonly LocalPiece[],
): Measurement {
  const meter = new LoudnessMeter(SAMPLE_RATE, CHANNELS);
  for (const piece of pieces) {
    const buffer = decoded.get(piece.takeIndex);
    if (!buffer) continue;                       // a take with no sound is silence at the join
    const from = Math.max(0, Math.round(piece.from * buffer.sampleRate));
    const to = Math.min(buffer.length, Math.round(piece.to * buffer.sampleRate));
    if (!(to > from)) continue;
    const chunk: Float32Array[] = [];
    for (let c = 0; c < CHANNELS; c++) {
      // A mono take is heard through both channels, so it is measured the way it is played
      // and mixed rather than as one channel of a stereo file.
      chunk.push(buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)).subarray(from, to));
    }
    meter.push(chunk);
  }
  return meter.result();
}

/** The gain a measurement asks for, in the form a `GainNode` or a multiply takes. */
export function gainOf(measurement: Measurement): number {
  return gainFor(measurement.lufs, measurement.peakDb);
}

/**
 * The gain the clip's kept sound is boosted by, or `1` when the switch is off, when there is
 * nothing to measure, or when the sound will not decode. Decodes the takes it needs, one at a
 * time, and holds the measurement for the sound it was taken from.
 */
export async function boostGain(plan: ExportPlan, boost: boolean): Promise<number> {
  if (!boost || !plan.pieces.length) return 1;
  return gainOf(await measurementFor(plan));
}

/** The measurements already taken, by the sound they were taken from. */
const cache = new Map<string, Promise<Measurement>>();

function measurementFor(plan: ExportPlan): Promise<Measurement> {
  const key = keyFor(plan);
  let pending = cache.get(key);
  if (!pending) {
    pending = measureFromTakes(plan);
    cache.set(key, pending);
  }
  return pending;
}

/**
 * A key for the sound being measured: which stretches of which takes, and how long each take
 * is. A take added or a cut approved changes it and so measures again; the switch is not part
 * of it, because the switch does not change what the sound measures.
 */
function keyFor(plan: ExportPlan): string {
  return plan.pieces.map(piece => `${piece.takeIndex}:${piece.from.toFixed(3)}:${piece.to.toFixed(3)}`).join('|')
    + '#' + plan.takes.map(take => `${take.duration.toFixed(3)}:${take.blob.size}`).join(',');
}

/** Decode the takes the plan needs, one at a time, and measure the stretches it keeps. */
async function measureFromTakes(plan: ExportPlan): Promise<Measurement> {
  const context = new OfflineAudioContext(CHANNELS, 1, SAMPLE_RATE);
  const decoded = new Map<number, AudioBuffer | null>();
  try {
    for (const piece of plan.pieces) {
      if (decoded.has(piece.takeIndex)) continue;
      decoded.set(piece.takeIndex, await decodeOrNull(context, plan.takes[piece.takeIndex]));
    }
  } catch {
    // A context the browser will not give, or a decode that threw: measure what arrived.
  }
  return measureKept(decoded, plan.localPieces());
}

/** A take's sound, or null when it has none — the same rule the export's own decode follows. */
async function decodeOrNull(context: BaseAudioContext, take: { blob: Blob } | undefined): Promise<AudioBuffer | null> {
  if (!take) return null;
  try {
    return await context.decodeAudioData(await take.blob.arrayBuffer());
  } catch {
    return null;
  }
}
