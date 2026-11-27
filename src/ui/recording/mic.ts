// Microphone capture with a level (VU) meter.
//
// A header toggle starts the microphone. The stream is acquired and released by the
// capture adapter; this view shows its level. The meter's own state — the graph and
// the frame loop — belongs to the view and goes when the microphone does.

import { capture } from '../../infra/capture.js';
import { el, toast } from '../dom.js';
import { t } from '../i18n/index.js';
import { setMicPresent } from './source-buttons.js';

export class Meter {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;

  show(stream: MediaStream): void {
    this.stop();
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    this.context = new Ctx();
    const source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    // A browser strict about autoplay hands the context back suspended, and this one
    // is built after `getUserMedia` resolved — outside the click that asked for the
    // microphone. Suspended, the analyser reads nothing and the meter sits dead while
    // the person talks into a microphone that records perfectly well. So it is asked
    // to run; the graph keeps it alive as long as the microphone is on.
    void this.context.resume();
    el.vu.classList.add('on');
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const draw = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const value of data) peak = Math.max(peak, Math.abs(value - 128) / 128);
      el.vuFill.style.height = `${Math.round(peak * 100)}%`;
      this.frame = requestAnimationFrame(draw);
    };
    draw();
  }

  stop(): void {
    if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; }
    if (this.context) { void this.context.close(); this.context = null; }
    this.analyser = null;
    el.vu.classList.remove('on');
    el.vuFill.style.height = '0%';
  }
}

export const meter = new Meter();

export function initMic(): void {
  setMicPresent(false);
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => void detectMic());
  }
  void detectMic();
}

export async function detectMic(): Promise<void> {
  let has: boolean;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    has = devices.some(device => device.kind === 'audioinput');
  } catch {
    has = false;
  }
  setMicPresent(has);
  if (!has) stopMic();
}

export async function toggleMic(): Promise<void> {
  if (capture.sources.mic) stopMic();
  else await startMic();
}

async function startMic(): Promise<void> {
  if (capture.sources.mic) return;
  try {
    const stream = await capture.startMic();
    meter.show(stream);
    el.micBtn.classList.add('active');
    el.micBtn.setAttribute('aria-pressed', 'true');
  } catch (error) {
    const name = (error as { name?: string }).name;
    toast(t('toast.micStart') + (name ? ` (${name})` : ''), 4000);
  }
}

export function stopMic(): void {
  capture.stopMic();
  meter.stop();
  el.micBtn.classList.remove('active');
  el.micBtn.setAttribute('aria-pressed', 'false');
}
