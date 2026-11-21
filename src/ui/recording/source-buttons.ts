// The source buttons' own state, in one place.
//
// A button is out when its device is not there, and all three are out while a
// take is being set up or runs — switching a source mid-take would change what
// is being recorded. The Import button, which is an action rather than a source
// but which also writes a take into the clip, is held out over the same span.
// The device facts arrive from webcam.ts and mic.ts, which watch for devices
// coming and going; the lock comes from the phase, and the Screen button is lit
// while the screen is a source. Keeping it here is what stops the two fighting
// over the same attribute — and what makes the opening state come from the model
// rather than from the markup, so the Screen button is out on first access.

import { currentPhase, onPhaseChange, type Phase } from '../../state.js';
import { capture } from '../../infra/capture.js';
import { el } from '../dom.js';

// What the page knows about the sources: whether a camera or microphone is
// there at all, and whether this browser can share a screen. Chrome and Firefox
// on Android do not implement getDisplayMedia, so a phone or tablet there can
// record the webcam and the mic but has no screen source — and the Screen button
// says so rather than sitting there as a dead end.
const sources = { camera: false, mic: false, screen: true };

// A take in flight owns the sources: it is not to be switched under it.
function locked(phase: Phase): boolean {
  return phase === 'starting' || phase === 'recording';
}

/**
 * Every source button's own state: out when its device is missing or a take is
 * in flight, and the Screen button lit while it is a source. Called on every
 * phase change and whenever a source is switched, so a button never keeps a
 * stale state — the opening one included.
 */
export function refreshSourceButtons(): void {
  const off = locked(currentPhase());
  el.screenBtn.disabled = off || !sources.screen;
  // A browser that cannot share a screen at all has no use for the button on a
  // narrow one: the stylesheet takes it out of the row there (styles.css), and the
  // header's own warning is what says why.
  el.screenBtn.classList.toggle('unavailable', !sources.screen);
  el.screenBtn.classList.toggle('active', capture.sources.screen);
  el.screenBtn.setAttribute('aria-pressed', capture.sources.screen ? 'true' : 'false');
  el.screenBtn.title = sources.screen
    ? 'Screen'
    : 'Screen capture is not available in this browser — record the webcam instead';
  el.webcamBtn.disabled = off || !sources.camera;
  el.camPickBtn.disabled = off;
  el.micBtn.disabled = off || !sources.mic;
  // Import is not a source toggle but it writes a take into the clip, so it is
  // held out of the way exactly while one is being set up or records.
  el.fileBtn.disabled = off;
}

/** A camera was found (or went away). */
export function setCameraPresent(has: boolean): void {
  sources.camera = has;
  refreshSourceButtons();
}

/** A microphone was found (or went away). */
export function setMicPresent(has: boolean): void {
  sources.mic = has;
  refreshSourceButtons();
}

/** This browser can (or cannot) share a screen at all. */
export function setScreenAvailable(has: boolean): void {
  sources.screen = has;
  refreshSourceButtons();
}

export function initSourceButtons(): void {
  onPhaseChange(refreshSourceButtons);
  refreshSourceButtons();
}
