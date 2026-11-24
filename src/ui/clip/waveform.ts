// The audio track shown under the video thumbnails: a waveform of the recorded
// clip, visible only when the recording has audio. It is drawn in timeline time,
// so a cut stretch takes up no width and what is left closes up over it.
//
// The bars come from a decode of the recording, which is read-only: the file, the
// playback and the export are untouched by it. See PEAK_RATE below.
//
// The bars themselves are the clip's sound as it stands, so they live on this
// object with the lifetime of the clip they were decoded from: the session clears
// them, the review builds them again, and the live timeline carries them into a
// take that is still being recorded.

import { session } from '../../session.js';
import type { Take } from '../../domain/clip/Take.js';
import { el } from '../dom.js';
import { keptLengthNow, keptOf } from './clip.js';

const BUCKETS = 600;          // horizontal resolution of the waveform

// The rate the audio is decoded at, to draw it. The bars only need the envelope,
// and 4 kHz of it reads the same as full bandwidth for anything anyone records —
// music and speech keep their shape, only the very top end flattens a little.
// Worth keeping low: it is the difference between ~345 KB and ~63 KB for every
// second of recording held in the tab while a strip is drawn. Raise it to 16000
// if a strip ever looks too flat.
const PEAK_RATE = 8000;

export class Waveform {
  private peaks: Float32Array | null = null;

  clear(): void {
    this.peaks = null;
    el.waveform.style.display = 'none';
    el.waveform.getContext('2d')?.clearRect(0, 0, el.waveform.width, el.waveform.height);
  }

  // The bars as they stand. The live timeline carries them into a new take, so the
  // clip's sound stays on screen under the one being recorded.
  current(): Float32Array | null {
    return this.peaks;
  }

  async build(takes: readonly Take[]): Promise<void> {
    if (!takes.length || !takes.some(take => take.hasAudio)) { this.clear(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.clear(); return; }

    // Decoding is an extra copy of the audio in memory — about 345 KB for every
    // second of it at the context's own rate — and it is only ever used to draw
    // 600 bars. So it is decoded slowly and one take at a time: each take's copy is
    // dropped before the next is decoded, into the memory the last one gave back.
    let ctx: AudioContext;
    try { ctx = new Ctx({ sampleRate: PEAK_RATE }); }
    catch { ctx = new Ctx(); }                    // a rate it will not take: its own

    const total = takes.reduce((n, take) => n + take.duration, 0);
    if (!(total > 0)) { void ctx.close(); this.clear(); return; }

    try {
      // One recording per press of Record: each gets as many bars as its share of
      // the clip, so the strip lines up with the whole of it.
      const out: number[] = [];
      for (const take of takes) {
        const bars = Math.max(1, Math.round(BUCKETS * (take.duration / total)));
        // A take with no sound of its own — an imported video — is bars of
        // silence, not a reason to drop the whole waveform.
        const audio = await decodeOrNull(ctx, take.blob);
        out.push(...(audio ? computePeaks(audio, bars) : new Float32Array(bars)));
      }
      if (!out.length) { this.clear(); return; }
      this.peaks = Float32Array.from(out);
      el.waveform.style.display = '';
      this.draw();
    } catch (err) {
      console.warn('DemoClip: could not decode audio for the waveform —', err);
      this.clear();
    } finally {
      void ctx.close();
    }
  }

  draw(): void {
    const peaks = this.peaks;
    const cv = el.waveform;
    if (!peaks || cv.style.display === 'none') return;  const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300;
    const h = cv.clientHeight || 34;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const light = document.documentElement.dataset.theme === 'light';
    const wave  = light ? 'rgba(59,127,255,0.55)'  : 'rgba(96,148,255,0.7)';

    // The bars are drawn in timeline time: a cut stretch has no width on screen,
    // so its bars are left out and the rest closes up over it.
    const kept = keptLengthNow();
    if (!(kept > 0)) return;
    const gone = session.clip.cuts.scaled(session.clip.total());   // the cuts, in seconds
    const step = session.clip.total() / peaks.length;
    const bw = Math.max(0.7, (w / kept) * step);

    const mid = h / 2;
    ctx.fillStyle = wave;
    for (let i = 0; i < peaks.length; i++) {
      const at = (i + 0.5) * step;                       // when that bar was heard
      if (gone.contains(at)) continue;                   // not in the clip any more
      const barH = Math.max(1, peaks[i] * (h - 4));
      ctx.fillRect((keptOf(at) / kept) * w - bw / 2, mid - barH / 2, bw, barH);
    }
  }
}

export const waveform = new Waveform();

/** A take's sound, or null when it has none (an imported video, a silent file). */
async function decodeOrNull(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer | null> {
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

function computePeaks(audio: AudioBuffer, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const n = audio.length;
  const step = n / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(Math.floor((i + 1) * step), n);
    let max = 0;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
    }
    out[i] = max;
  }
  return out;
}
