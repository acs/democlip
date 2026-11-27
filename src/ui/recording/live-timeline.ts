// The timeline while a take is being recorded.
//
// Pressing Record shows the timeline straight away and fills it in as the take
// goes: the cells span the clip plus a little room ahead of the recording, so
// they compress as the take grows; cells over time already recorded show the
// picture that was on screen then, and the rest are left empty. The waveform
// grows with the sound being recorded.
//
// Nothing is decoded and nothing is read back from the recording itself — a
// half-written WebM cannot be decoded or seeked. The frames are the preview's
// own picture of the screen (the same crop and webcam the recorder is given) and
// the levels are sampled from the stream being recorded, through the same gains,
// so what is shown is what is going in. On stop the review rebuilds all of it
// from the file, exactly.
//
// The state is the take in progress — the frames kept so far, the levels heard,
// the meter — so it lives on this object rather than in module variables: `start`
// begins a take and lets go of whatever the last one left behind, and `stop`
// clears it. That is what lets a session begin again empty, in the same page.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { capture } from '../../infra/capture.js';
import { clock, el } from '../dom.js';
import { t } from '../i18n/index.js';
import { drawWebcamOverlay } from './webcam.js';
import { keptLengthNow, keptOf } from '../clip/clip.js';
import { waveform } from '../clip/waveform.js';
import { drawThumb, thumbBox } from '../clip/thumbnail.js';

const CELLS     = 22;     // the same strip the review builds
const SAMPLE_MS = 80;     // how often the audio is read
const DRAW_MS   = 250;    // how often the strip and the waveform are repainted
const PER_CELL  = 2;      // frames kept per cell, so a relayout has one to pick
const MIN_SPAN  = 20;     // seconds of room the strip assumes a take will need
const SLACK     = 1.25;   // ...and how much it leaves ahead of the recording head

export class LiveTimeline {
  private tick = 0;
  private sources: HTMLCanvasElement[] = [];      // what the review strip was showing
  private frames: { t: number; c: HTMLCanvasElement }[] = [];   // the take, as it goes
  private lastCapture = -1;
  private prevKept = 0;                           // timeline length of the clip before this take
  private echo: Float32Array | null = null;       // the clip's own waveform, carried over
  private samples: number[] = [];                 // levels heard so far in this take
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Uint8Array(0);                // the analyser's, once it starts
  private lastDraw = 0;
  private startedAt = 0;

  /** A take is starting: the strip is drawn for a clip that is about to grow. */
  start(recStream: MediaStream | null): void {
    this.stop();
    this.prevKept = keptLengthNow();
    this.echo = waveform.current();
    this.sources = copyStrip();
    this.frames = [];
    this.lastCapture = -1;
    this.samples = [];
    this.startMeter(recStream);
    buildStrip();
    // A sound-only take has no pictures to fill the cells with: the waveform takes the
    // room the strip would have had, as it does in the review.
    el.timeline.classList.toggle('sound-only', !capture.sources.screen && !capture.sources.webcam);
    el.timeline.classList.add('on', 'recording');
    el.tlLabel.textContent = t('timeline.label');
    el.tLive.classList.add('on');
    el.tLiveTime.textContent = '00:00';
    el.tCut.textContent = '';
    el.waveform.style.display = 'none';
    this.lastDraw = 0;
    this.startedAt = Date.now();
    this.tick = window.setInterval(() => this.onTick(), SAMPLE_MS);
    this.onTick();
  }

  /** The take is over, or the session is: nothing here is kept. */
  stop(): void {
    if (this.tick) { clearInterval(this.tick); this.tick = 0; }
    if (this.audioCtx) { void this.audioCtx.close(); this.audioCtx = null; }
    this.analyser = null;
    this.buf = new Uint8Array(0);
    el.timeline.classList.remove('recording');
    el.tlLabel.textContent = t('timeline.label');
    el.tLive.classList.remove('on');
    el.waveform.style.display = 'none';
  }

  // ── the tick ───────────────────────────────────────────────────────────────

  private onTick(): void {
    if (currentPhase() !== 'recording') { this.stop(); return; }

    this.readAudio();
    const elapsed = this.elapsedSeconds();
    const head = this.prevKept + elapsed;
    // How much of the clip the cells are spread over: what has been recorded plus
    // room for the take to run on, so the strip fills up rather than jumping.
    const span = head + Math.max(MIN_SPAN, elapsed * SLACK);
    const step = span / CELLS / PER_CELL;

    if (elapsed - this.lastCapture >= step) { this.lastCapture = elapsed; this.frames.push({ t: head, c: this.grab() }); }

    if (Date.now() - this.lastDraw < DRAW_MS) return;
    this.lastDraw = Date.now();
    this.paintStrip(span, head);
    this.paintWave(span);
    el.playhead.style.left = ((head / span) * 100).toFixed(2) + '%';
    el.tLiveTime.textContent = clock(elapsed);
    // No size is shown while a take records: the figure belongs to the Export button, which is
    // not on screen until the clip is in the review (`view-lifetime.ts`), and the review sets its
    // own when it opens (`review-flow.ts`).
  }

  private elapsedSeconds(): number {
    return Math.max(0, (Date.now() - this.startedAt) / 1000);
  }

  // The picture going into the recording right now: the share, cropped to the
  // region, with the webcam bubble on it — or the camera alone, cropped to the
  // region too, when the screen is off. What the recorder is being fed, at the
  // shape it is being fed at.
  private grab(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    try {
      if (capture.sources.screen && capture.current()) {
        if (el.sv.readyState < 2) return c;
        const r = capture.region;
        const sx = Math.round(r.x * capture.width), sy = Math.round(r.y * capture.height);
        const sw = Math.max(1, Math.round(r.w * capture.width)), sh = Math.max(1, Math.round(r.h * capture.height));
        drawThumb(c, el.sv, sx, sy, sw, sh);
        const ctx = c.getContext('2d');
        if (ctx) drawWebcamOverlay(ctx, 0, 0, c.width, c.height);
      } else if (capture.sources.webcam && el.wcv.readyState >= 2) {
        const r = capture.region;
        const vw = el.wcv.videoWidth, vh = el.wcv.videoHeight;
        drawThumb(c, el.wcv, Math.round(r.x * vw), Math.round(r.y * vh),
                  Math.max(1, Math.round(r.w * vw)), Math.max(1, Math.round(r.h * vh)));
      }
    } catch { /* a frame that is not ready — the next tick will have it */ }
    return c;
  }

  // ── painting ───────────────────────────────────────────────────────────────

  private paintStrip(span: number, head: number): void {
    for (let i = 0; i < CELLS; i++) {
      const canvas = cellCanvas(i);
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) continue;

      // the middle of the time this cell stands for
      const mid = (((i + 0.5) / CELLS) * span);
      // The frame's own shape decides the cell's, so a cropped take is not
      // stretched into the last cell's shape; a cell with nothing yet is cleared.
      const frame = mid > head ? null : (mid < this.prevKept ? this.sourceNear(mid) : this.takeNear(mid));
      if (frame && frame.width && frame.height) drawThumb(canvas, frame, 0, 0, frame.width, frame.height);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // The clip's own waveform before the recording head, then the sound of the take
  // as it is heard — both laid out over the same span, so they compress together.
  private paintWave(span: number): void {
    const cv = el.waveform;
    if (!this.echo && !this.samples.length) { cv.style.display = 'none'; return; }
    cv.style.display = '';
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 34;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const light = document.documentElement.dataset.theme === 'light';
    ctx.fillStyle = light ? 'rgba(59,127,255,0.55)' : 'rgba(96,148,255,0.7)';
    const mid = h / 2;
    const bar = (peak: number, when: number, bw: number) => {
      const barH = Math.max(1, Math.min(peak, 1) * (h - 4));
      ctx.fillRect((when / span) * w, mid - barH / 2, bw, barH);
    };

    if (this.echo && this.echo.length) {
      // every bar of the clip so far, over the recording's own time — at the level the clip
      // is heard at, which is the boost's when the clip is boosted. The take being recorded
      // has no boost yet: it has not been measured, and the review will measure it once it is.
      const echoGain = waveform.gainNow();
      const gone = session.clip.cuts.scaled(session.clip.total());
      const step = session.clip.total() / this.echo.length;
      const bw = Math.max(0.7, (w / span) * step);
      for (let i = 0; i < this.echo.length; i++) {
        const at = (i + 0.5) * step;
        if (gone.contains(at)) continue;                   // cut away: not in the clip
        bar(this.echo[i] * echoGain, keptOf(at), bw);
      }
    }

    const bw = Math.max(1, (w * SAMPLE_MS) / 1000 / span);
    for (let k = 0; k < this.samples.length; k++) {
      bar(this.samples[k], this.prevKept + (k * SAMPLE_MS) / 1000, bw);   // when it was heard
    }
  }

  // ── the pieces behind it ───────────────────────────────────────────────────

  // The nearest saved frame to a time, in either half of the clip.
  private sourceNear(time: number): HTMLCanvasElement | null {
    if (!this.sources.length || this.prevKept <= 0) return null;
    const per = this.prevKept / this.sources.length;
    const list = this.sources.map((c, i) => ({ t: (i + 0.5) * per, c }));
    return nearest(list, time);
  }

  private takeNear(time: number): HTMLCanvasElement | null {
    return this.frames.length ? nearest(this.frames, time) : null;
  }

  // Levels straight off the stream being recorded, so they carry the same mic
  // boost and system trim the recorder applies.
  private startMeter(stream: MediaStream | null): void {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.audioCtx = new Ctx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.audioCtx.createMediaStreamSource(new MediaStream([track])).connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);
      void this.audioCtx.resume();
    } catch {
      this.audioCtx = null; this.analyser = null; this.buf = new Uint8Array(0);
    }
  }

  private readAudio(): void {
    if (!this.analyser || !this.buf.length) return;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
    this.samples.push(Math.min(1, Math.sqrt(sum / this.buf.length) * 3));
  }
}

// ── helpers that hold nothing ──────────────────────────────────────────────

function blank(): HTMLCanvasElement {
  const { w, h } = thumbBox(16, 9);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Keep what the review strip was showing, to draw the cells over the clip. Each
// copied frame keeps its own shape, so a cropped clip's cells are not stretched.
function copyStrip(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (const frame of Array.from(el.thumbs.children)) {
    const src = frame.querySelector('canvas');
    if (!src) continue;
    out.push(drawThumb(document.createElement('canvas'), src, 0, 0, src.width, src.height));
  }
  return out;
}

// The nearest saved frame to a time, in either half of the clip.
function nearest(list: { t: number; c: HTMLCanvasElement }[], time: number): HTMLCanvasElement | null {
  let best: HTMLCanvasElement | null = null, bestGap = Infinity;
  for (const f of list) {
    const gap = Math.abs(f.t - time);
    if (gap < bestGap) { bestGap = gap; best = f.c; }
  }
  return best;
}

function buildStrip(): void {
  if (el.thumbs.children.length === CELLS && el.thumbs.querySelector('canvas')) return;
  el.thumbs.replaceChildren();
  for (let i = 0; i < CELLS; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-frame';
    wrap.appendChild(blank());
    el.thumbs.appendChild(wrap);
  }
}

function cellCanvas(i: number): HTMLCanvasElement | null {
  const frame = el.thumbs.children[i];
  return frame ? frame.querySelector('canvas') : null;
}

export const liveTimeline = new LiveTimeline();
