// The app's stock sounds, and how the synthesis makes them.
//
// A demo tool, not application code. It writes the 16-bit PCM WAVs the app serves
// (`web/public/sounds/`), and — because the sounds are entirely synthesised, nothing is
// recorded or downloaded — it is also the honest answer to "how are the sounds made?".
//
//   node tools/make-sounds.ts shipped       # regenerate the app's stock sounds in web/public/sounds/
//   node tools/make-sounds.ts from <file>   # derive a clap and a "wow" from a recording (any audio
//                                           # ffmpeg can open: WebM, MP4, WAV, MP3…) into sounds/derived/
//
// Everything is deterministic (a fixed PRNG), so the same command writes the same bytes.
// It is run by Node's own TypeScript support (type stripping), so it needs no build step.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A mono signal: samples in [-1, 1]. */
type Samples = Float32Array;

/** A maker for one sound, at the app's rate. */
type Maker = () => Samples;

/** Which biquad a filter is. */
type BiquadKind = 'lp' | 'hp' | 'bp';

const SR = 48_000;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = join(root, 'web/public/sounds');
const DERIVED = join(SHIPPED, 'derived');

// ── wav i/o (16-bit PCM, mono) ───────────────────────────────────────────────

function writeWav(path: string, samples: Samples): number {
  mkdirSync(dirname(path), { recursive: true });
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, b);
  return n;
}

/** A 16-bit PCM WAV, as samples, and its rate. */
function readWav(path: string): { samples: Samples; sr: number } {
  const b = readFileSync(path);
  const bits = b.readUInt16LE(34), ch = b.readUInt16LE(22), sr = b.readUInt32LE(24);
  const data = 44;
  const frames = Math.floor((b.length - data) / (ch * bits / 8));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const at = data + i * ch * (bits / 8);
    out[i] = bits === 16 ? b.readInt16LE(at) / 32768 : b.readInt32LE(at) / 2147483648;
  }
  return { samples: out, sr: sr || SR };
}

/** Any audio ffmpeg can open → mono 48 kHz samples, in memory. */
function decodeWithFfmpeg(path: string): Samples {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path, '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', String(SR), '-',
  ], { maxBuffer: 1 << 30 });
  const out = new Float32Array(Math.floor(raw.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
}

// ── small dsp ────────────────────────────────────────────────────────────────

/** A deterministic noise source, so a sound is reproducible. */
function noise(seed0 = 1337): () => number {
  let seed = seed0;
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
}

/** RBJ biquads. `kind` is 'lp' | 'hp' | 'bp'; `gain` only matters for the band. */
function biquad(x: Samples, kind: BiquadKind, f0: number, Q: number, gain = 1): Samples {
  const w = 2 * Math.PI * f0 / SR, al = Math.sin(w) / (2 * Q), cs = Math.cos(w);
  let b0: number, b1: number, b2: number;
  if (kind === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
  else if (kind === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
  else { b0 = al * gain; b1 = 0; b2 = -al * gain; }
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const v = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

const at = (t: number): number => Math.round(t * SR);

/** Normalise to a peak, softly, so nothing clips. */
function finish(x: Samples, peak = 0.86): Samples {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  const g = p > 0 ? (peak / p) : 1;
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * g * 1.1);
  p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  const g2 = p > 0 ? peak / p : 1;
  for (let i = 0; i < x.length; i++) x[i] *= g2;
  // A few milliseconds of fade at the very end, so no sound ever ends on a click — the longer
  // musical tail (such as the gong's) is the sound's own, above.
  const fade = Math.min(x.length, at(0.004));
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  return x;
}

// ── the shipped sounds ───────────────────────────────────────────────────────

/** A gong: inharmonic partials, each decaying at its own rate, plus a noise strike. */
function gong(): Samples {
  const rnd = noise();
  const total = at(3.4);                       // longer, so the ring has room to die away
  const out = new Float32Array(total);
  const partials: ReadonlyArray<readonly [number, number, number]> = [
    [164, 1, 1.35], [232, 0.6, 1.1], [349, 0.45, 0.85], [523, 0.3, 0.62],
    [701, 0.22, 0.46], [988, 0.15, 0.36], [1319, 0.1, 0.28],
  ];
  const release = at(0.8);                     // the tail: a cosine decay to true silence
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let v = 0;
    for (const [f, a, d] of partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
    // The last stretch is brought down to zero smoothly, so the final is the gong ringing out
    // rather than the file stopping while it is still sounding.
    const left = total - i;
    const rel = left < release ? 0.5 * (1 + Math.cos(Math.PI * (1 - left / release))) : 1;
    out[i] = (v + Math.exp(-t / 0.01) * 0.5 * rnd()) * rel;
  }
  return finish(out, 0.9);
}

// ── the stock sounds ─────────────────────────────────────────────────────────

/** A whoosh: noise through a one-pole band whose cutoff sweeps up and back. */
function whoosh(): Samples {
  const rnd = noise();
  const total = at(0.7);
  const x = new Float32Array(total);
  for (let i = 0; i < total; i++) x[i] = rnd();
  const hp = biquad(x, 'hp', 300, 0.7);
  const out = new Float32Array(total);
  let y = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const f = 500 + 3500 * Math.sin(Math.PI * (t / 0.7));   // the band rises, then falls
    const a = 1 - Math.exp(-2 * Math.PI * f / SR);          // one-pole low-pass at f
    y += a * (hp[i] - y);
    out[i] = y * Math.sin(Math.PI * (t / 0.7));
  }
  return finish(out, 0.7);
}

/** A riser: a tone and its noise climbing, with a swell — a build-up. */
function riser(): Samples {
  const rnd = noise();
  const total = at(1.2);
  const out = new Float32Array(total);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const f = 180 * Math.pow(3000 / 180, t / 1.2);
    phase += 2 * Math.PI * f / SR;
    const env = Math.pow(t / 1.2, 1.6);
    out[i] = (Math.sin(phase) * 0.7 + rnd() * 0.5) * env;
  }
  return finish(out, 0.82);
}

/** A chime: a few harmonic partials, each ringing out at its own rate — a bell. */
function chime(): Samples {
  const total = at(1.3);
  const out = new Float32Array(total);
  const partials: ReadonlyArray<readonly [number, number, number]> = [
    [880, 1, 1.1], [1760, 0.5, 0.7], [2640, 0.3, 0.45], [3520, 0.16, 0.28], [5280, 0.08, 0.16],
  ];
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let v = 0;
    for (const [f, a, d] of partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
    out[i] = v;
  }
  return finish(out, 0.8);
}

/** A "wow": a tone that rises and falls with a wobble — a cartoon wow, not a voice. */
function wow(): Samples {
  const total = at(0.85);
  const out = new Float32Array(total);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const bend = 300 + 700 * Math.sin(Math.PI * (t / 0.85)) ** 2;
    const wobble = 1 + 0.05 * Math.sin(2 * Math.PI * 7 * t);
    phase += 2 * Math.PI * bend * wobble / SR;
    out[i] = Math.sin(phase) * Math.sin(Math.PI * (t / 0.85)) ** 0.6;
  }
  return finish(out, 0.8);
}

/** A pluck: a short noise burst through a comb — a Karplus–Strong string. */
function pluck(): Samples {
  const rnd = noise();
  const total = at(1.0);
  const out = new Float32Array(total);
  const delay = Math.round(SR / 220);
  const buf = new Float32Array(delay);
  for (let i = 0; i < delay; i++) buf[i] = rnd();
  for (let i = 0; i < total; i++) {
    const v = buf[i % delay];
    out[i] = v;
    buf[i % delay] = (v + buf[(i + 1) % delay]) * 0.5 * 0.996;
  }
  return finish(biquad(out, 'lp', 6000, 0.7), 0.8);
}

/** A thud: a low tone falling fast, with a click — an impact. */
function thud(): Samples {
  const total = at(0.45);
  const out = new Float32Array(total);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const f = 45 + 60 * Math.exp(-t / 0.06);
    phase += 2 * Math.PI * f / SR;
    out[i] = Math.sin(phase) * Math.exp(-t / 0.14);
  }
  out[0] += 0.8;
  return finish(out, 0.85);
}

const STOCK: Readonly<Record<string, Maker>> = { chime, gong, pluck, riser, thud, whoosh, wow };

// ── deriving sounds from a recording ─────────────────────────────────────────

/** The loudest 60 ms onset in a recording, as a grain to build a clap's body from. */
function loudestGrain(x: Samples, len: number): Samples {
  const win = at(0.02);
  let best = 0, bestAt = 0;
  for (let i = 0; i + win < x.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j++) e += x[i + j] * x[i + j];
    if (e > best) { best = e; bestAt = i; }
  }
  const grain = new Float32Array(len);
  for (let i = 0; i < len; i++) grain[i] = x[Math.min(x.length - 1, bestAt + (i % at(0.02)))];
  return grain;
}

/** A clap whose timbre is the recording's: the recording's loudest onset, fluttered and tailed. */
function clapFrom(x: Samples): Samples {
  const grain = biquad(loudestGrain(x, at(0.06)), 'hp', 180, 0.7);
  const total = at(0.5);
  const bursts: ReadonlyArray<readonly [number, number, number]> = [
    [0, 1.0, 0.012], [0.008, 0.8, 0.014], [0.017, 0.62, 0.016], [0.027, 0.46, 0.018],
  ];
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let env = 0;
    for (const [tk, a, tau] of bursts) if (t >= tk) env += a * Math.exp(-(t - tk) / tau);
    out[i] = grain[i % grain.length] * (env + 0.14 * Math.exp(-t / 0.12));
  }
  return finish(biquad(out, 'lp', 5000, 0.7));
}

/** A "wow" from a recording's own voice: the loudest sustained stretch, glided up then down. */
function wowFrom(x: Samples): Samples {
  const total = at(0.9);
  const out = new Float32Array(total);
  // The loudest sustained stretch — a word, not the silence before it.
  const win = at(0.05);
  let best = 0, bestAt = 0;
  for (let i = 0; i + win < x.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j++) e += x[i + j] * x[i + j];
    if (e > best) { best = e; bestAt = i; }
  }
  const from = Math.max(0, bestAt - at(0.03));
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    // An intonation: the pitch rises, then settles lower — the “wow!” contour — with a slow
    // wobble. Resampling carries the pitch; a human “wow” needs a real voice, which is the point.
    const rate = 1 + 0.16 * Math.sin(Math.PI * (t / 0.9)) - 0.12 * (t / 0.9) + 0.03 * Math.sin(2 * Math.PI * 3 * t);
    const pos = Math.min(x.length - 1, Math.max(0, from + Math.round(i * rate)));
    out[i] = x[pos] * Math.sin(Math.PI * (t / 0.9)) ** 0.7;
  }
  return finish(out, 0.82);
}

// ── the commands ─────────────────────────────────────────────────────────────

const [command = 'shipped', arg] = process.argv.slice(2);
const report = (path: string, n: number): void => console.log(`${path.replace(root + '/', '')}  ${(n / SR).toFixed(2)}s`);

if (command === 'shipped') {
  // The app's stock sounds — the seven the app ships.
  for (const [name, make] of Object.entries(STOCK)) {
    report(join(SHIPPED, `${name}.wav`), writeWav(join(SHIPPED, `${name}.wav`), make()));
  }
} else if (command === 'from') {
  if (!arg) { console.error('usage: node tools/make-sounds.ts from <file>'); process.exit(1); }
  const x: Samples = arg.endsWith('.wav') ? readWav(arg).samples : decodeWithFfmpeg(arg);
  report(join(DERIVED, 'clap-from-recording.wav'), writeWav(join(DERIVED, 'clap-from-recording.wav'), clapFrom(x)));
  report(join(DERIVED, 'wow-from-recording.wav'), writeWav(join(DERIVED, 'wow-from-recording.wav'), wowFrom(x)));
} else {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}