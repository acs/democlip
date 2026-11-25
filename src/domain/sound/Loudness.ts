// EBU R128 loudness, measured over samples.
//
// The rule the **sound boost** rests on: how loud a piece of sound is, on the scale
// broadcasters use, and how close its loudest sample comes to the top. It is arithmetic
// over samples — no browser, no audio context — so it is proved in node and asked by both
// the export and the review.
//
// ITU-R BS.1770: the sound is K-weighted (a high shelf, then a high pass), cut into 400 ms
// blocks that overlap by 75 %, and the blocks are gated twice — an absolute gate at
// −70 LUFS, then a relative one 10 LU below the average of what passed — before the average
// of what is left is the integrated loudness. The peak is the loudest sample.
//
// The blocks are accumulated as the sound is fed in, a chunk at a time, so nothing here
// keeps the whole clip's samples: a meter holds the last 400 ms and a list of block powers.
// That is what lets the caller decode one take at a time and drop it.

/** The loudness of a piece of sound, and how close its loudest sample comes to the top. */
export interface Measurement {
  /** Integrated loudness in LUFS, or `-Infinity` when nothing is above the gate. */
  readonly lufs: number;
  /** The loudest sample in dBFS, or `-Infinity` for silence. */
  readonly peakDb: number;
}

const ABSOLUTE_GATE_LUFS = -70;   // BS.1770: blocks quieter than this are not the programme
const RELATIVE_GATE_LU = 10;      // ...nor blocks this far below the average of the rest
const OFFSET = -0.691;            // the constant that turns K-weighted power into LUFS
const BLOCK_SECONDS = 0.4;
const OVERLAP = 0.75;

/** How many channels carry full weight: the microphone's one or two, never surround. */
const CHANNEL_WEIGHT = 1;

/** What a sample goes through: one section of the weighting, or the two in series. */
interface Filter {
  run(x: number): number;
}

/** One section of the K-weighting: a second-order IIR the sound is run through. */
class Biquad implements Filter {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** The two sections of the K-weighting, at a sample rate, per BS.1770's own prototype. */
function kWeighting(sampleRate: number): () => Filter {
  // The high shelf: the ear's own emphasis above the voice's range, in the reference
  // implementation's own form (the Vh/Vb prototype with its half-power exponent).
  const shelf = (() => {
    const K = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
    const Q = 0.7071752369554196;
    const Vh = 10 ** (3.999843853973347 / 20);
    const Vb = Vh ** 0.4996667741545416;
    const a0 = 1 + K / Q + K * K;
    return {
      b0: (Vh + (Vb * K) / Q + K * K) / a0,
      b1: (2 * (K * K - Vh)) / a0,
      b2: (Vh - (Vb * K) / Q + K * K) / a0,
      a1: (2 * (K * K - 1)) / a0,
      a2: (1 - K / Q + K * K) / a0,
    };
  })();
  // The high pass: the rumble and handling the standard keeps out of the measurement. Its
  // numerator is the reference's own [1, −2, 1], not normalized by a0.
  const high = (() => {
    const K = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
    const den = 1 + K / 0.5003270373238773 + K * K;
    return {
      b0: 1,
      b1: -2,
      b2: 1,
      a1: (2 * (K * K - 1)) / den,
      a2: (1 - K / 0.5003270373238773 + K * K) / den,
    };
  })();
  return () => {
    const first = new Biquad(shelf.b0, shelf.b1, shelf.b2, shelf.a1, shelf.a2);
    const second = new Biquad(high.b0, high.b1, high.b2, high.a1, high.a2);
    return { run: (x: number) => second.run(first.run(x)) };
  };
}

/**
 * The loudness of a piece of sound as it is fed in, one chunk at a time.
 *
 * A chunk is one take's kept stretch: the samples are K-weighted, each 400 ms window that
 * closes is measured, and only the window's power and the peak are kept — never the sound.
 * Channel count is fixed at construction, so a mono chunk played into two channels is
 * counted twice, exactly as the browser plays it and the export mixes it.
 */
export class LoudnessMeter {
  private readonly makeFilter: () => Filter;
  private readonly filters: Filter[];
  /** The last 400 ms of K-weighted samples per channel, as their squares, and their sum. */
  private readonly squares: Float32Array[];
  private readonly sums: number[];
  private readonly at: number[];
  private filled = 0;
  private samples = 0;
  private peak = 0;
  private readonly powers: number[] = [];
  private sinceBlock = 0;

  constructor(
    sampleRate: number,
    private readonly channels: number,
  ) {
    this.makeFilter = kWeighting(sampleRate);
    this.filters = Array.from({ length: channels }, () => this.makeFilter());
    const blockSize = Math.max(1, Math.round(BLOCK_SECONDS * sampleRate));
    this.squares = Array.from({ length: channels }, () => new Float32Array(blockSize));
    this.sums = Array.from({ length: channels }, () => 0);
    this.at = Array.from({ length: channels }, () => 0);
  }

  /** Feed one chunk: the same length of each channel, in order. */
  push(chunk: readonly Float32Array[]): void {
    const length = chunk[0]?.length ?? 0;
    const blockSize = this.squares[0]!.length;
    for (let i = 0; i < length; i++) {
      // The peak is the sound's own, before the weighting: what a sample reads in the file.
      for (let c = 0; c < this.channels; c++) {
        const raw = Math.abs(chunk[c]?.[i] ?? 0);
        if (raw > this.peak) this.peak = raw;
      }
      for (let c = 0; c < this.channels; c++) {
        const weighted = this.filters[c]!.run(chunk[c]?.[i] ?? 0);
        const square = weighted * weighted;
        const ring = this.squares[c]!;
        const at = this.at[c]!;
        this.sums[c] = this.sums[c]! + square - ring[at]!;
        ring[at] = square;
        this.at[c] = (at + 1) % blockSize;
      }
      this.samples++;
      if (this.filled < blockSize) this.filled++;
      this.sinceBlock++;
      // A window closes every 100 ms once the first 400 ms has been seen.
      const step = Math.max(1, Math.round(blockSize * (1 - OVERLAP)));
      if (this.samples >= blockSize && this.sinceBlock >= step) {
        this.sinceBlock = 0;
        this.measureWindow();
      }
    }
  }

  /** The measurement of everything fed in so far. */
  result(): Measurement {
    // A sound shorter than one window still has a loudness: the one window it does fill.
    if (!this.powers.length && this.filled > 0) this.measureWindow();
    return { lufs: this.integrate(), peakDb: this.peak > 0 ? 20 * Math.log10(this.peak) : -Infinity };
  }

  /** The power of the window now held, and its loudness in LUFS. */
  private measureWindow(): void {
    const blockSize = this.squares[0]!.length;
    const count = Math.min(this.filled, blockSize);
    if (count <= 0) return;
    let power = 0;
    for (let c = 0; c < this.channels; c++) power += CHANNEL_WEIGHT * (this.sums[c]! / count);
    if (power <= 0) return;
    this.powers.push(power);
  }

  /** The two gates, and the average of what they leave. */
  private integrate(): number {
    if (!this.powers.length) return -Infinity;
    const loudnessOf = (power: number) => OFFSET + 10 * Math.log10(power);
    const above = this.powers.filter(power => loudnessOf(power) > ABSOLUTE_GATE_LUFS);
    if (!above.length) return -Infinity;
    const mean = above.reduce((total, power) => total + power, 0) / above.length;
    const threshold = loudnessOf(mean) - RELATIVE_GATE_LU;
    const gated = above.filter(power => loudnessOf(power) > threshold);
    const kept = gated.length ? gated : above;
    return loudnessOf(kept.reduce((total, power) => total + power, 0) / kept.length);
  }
}

/** The measurement of one whole piece of sound, in one call. */
export function measure(channels: readonly Float32Array[], sampleRate: number): Measurement {
  const meter = new LoudnessMeter(sampleRate, Math.max(1, channels.length));
  meter.push(channels);
  return meter.result();
}
