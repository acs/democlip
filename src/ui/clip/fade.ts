// The joins between recordings, softened.
//
// Takes are played one after another in the same video, so the moment one ends
// and the next is loaded is abrupt: the sound stops mid-phrase and the next
// starts at full level. A fade out just before the join and a fade in just after
// it takes the edge off — short enough not to be heard as a fade at all.
//
// The element's sound is routed through one gain node, which is what the preview
// hears. The export does not listen behind it — it renders its own sound offline
// through an OfflineAudioContext — but it applies the same fades to it, so what is
// heard while reviewing and what ends up in the file still agree.

import { el } from '../dom.js';

export const FADE_S = 0.08;   // how long either side of a join, in seconds
const FULL   = 1;       // the level the sound sits at

// The element's audio graph, owned by this view module: it exists while the review
// is open and goes when the page does.
let audioCtx: AudioContext | null = null;
let audioGain: GainNode | null = null;
// The **boost** sits after the fade, on its own node: the fades drive theirs between 0 and 1,
// and a boost folded into the same node would be undone at every join.
let audioBoost: GainNode | null = null;
let boostValue = 1;

/** The level the boost is at: remembered, and applied now when the graph is already made. */
export function setBoostGain(value: number): void {
  boostValue = value;
  if (audioBoost) audioBoost.gain.value = value;
}

// The element's sound through the gain node, made once. Null if the browser will
// not give us an audio context.
export function elementAudio(): { ctx: AudioContext; gain: GainNode } | null {
  if (audioCtx && audioGain) return { ctx: audioCtx, gain: audioGain };
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = audioCtx ?? new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = FULL;
    const boost = ctx.createGain();
    boost.gain.value = boostValue;          // whatever the review has been told to sit at
    ctx.createMediaElementSource(el.rv).connect(gain);
    gain.connect(boost);
    boost.connect(ctx.destination);          // the preview goes on being audible
    audioCtx = ctx;
    audioGain = gain;
    audioBoost = boost;
    // Autoplay policy can leave the context suspended; resume it on play.
    el.rv.addEventListener('play', () => {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    });
    void ctx.resume().catch(() => {});
    return { ctx, gain };
  } catch {
    return null;
  }
}

// Off before a join...
export function fadeOut(): void {
  ramp(0);
}

// ...and back on just after it.
export function fadeIn(): void {
  ramp(FULL);
}

// Whatever the sound is doing, put it back to full: a fade must never be left
// half-applied, or the rest of the clip would be silent. Nothing to do when the
// element's sound was never routed through the gain node.
export function fadeReset(): void {
  const ctx = audioCtx, gain = audioGain;
  if (!ctx || !gain) return;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(FULL, now);
}

function ramp(to: number): void {
  const a = elementAudio();
  if (!a) return;
  const g = a.gain.gain;
  const now = a.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(to, now + FADE_S);
}
