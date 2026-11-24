// The record flow: the source buttons, the Record button and the preview.
//
// It sequences the browser work and reports the outcome. The rule — a take needs a
// picture, the sources are independent — lives in the record use case and the
// domain value objects.

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { capture, webcamPort, microphonePort } from '../../infra/capture.js';
import { compositor } from '../../infra/compositor.js';
import { takeRecorder } from '../../infra/take-recorder.js';
import { takeProbe } from '../../infra/take-probe.js';
import { clock } from '../../infra/clock.js';
import { RecordTake } from '../../application/record-take.js';
import { el, setStatus, toast } from '../dom.js';
import { refreshSourceButtons } from './source-buttons.js';
import { drawGrid, startMirror, stopMirror } from './preview.js';
import { drawWebcamOverlay } from './webcam.js';
import { liveTimeline } from './live-timeline.js';
import { openReview } from '../clip/review-flow.js';

const record = new RecordTake({
  clip: session.clip,
  capture,
  webcam: webcamPort,
  mic: microphonePort,
  compositor,
  recorder: takeRecorder,
  probe: takeProbe,
  clock,
  sources: () => capture.sources,
  region: () => capture.region,
  // The picture's own size, from the element the picture is drawn from — the screen, or
  // the camera when the screen is off — the one place that knows it, since a display
  // track's settings lie until its first frame.
  picture: () => capture.sources.screen
    ? { width: el.sv.videoWidth, height: el.sv.videoHeight }
    : { width: el.wcv.videoWidth, height: el.wcv.videoHeight },
  drawBubble: context => drawWebcamOverlay(context, 0, 0, context.canvas.width, context.canvas.height),
  setAudio: audio => { session.audio = audio; },
});

// A take in flight owns the preview and the phase, so nothing else may move them.
function busy(): boolean {
  const phase = currentPhase();
  return phase === 'starting' || phase === 'recording' || phase === 'encoding';
}
// ...but a share being *asked for* is not a take in flight. Once the share is in
// hand, `syncSources` is exactly what settles the phase, so 'starting' must not
// stop it — only a take already running may. (Guarding it on `busy` left a
// successful share stuck in 'starting': no preview, and Record did nothing.)
function takeInFlight(): boolean {
  const phase = currentPhase();
  return phase === 'recording' || phase === 'encoding';
}

export function hasPicture(): boolean {
  return capture.sources.screen || capture.sources.webcam;
}

/**
 * Will a take carry sound? The share's own audio, or the microphone — the two the
 * compositor mixes, and the only two there are. The status line says so, so a silent
 * take is never a guess: a display track can arrive without an audio track at all,
 * and Chrome's picker decides that, not the app.
 */
export function hasSound(): boolean {
  return !!(capture.current()?.hasAudio || capture.sources.mic);
}

export function syncSources(): void {
  refreshSourceButtons();
  if (takeInFlight() || currentPhase() === 'review') return;
  if (!hasPicture()) {
    stopMirror();
    drawGrid();
    el.idleOv.classList.remove('gone');
    el.recBtn.disabled = false;
    el.recLbl.textContent = 'Record';
    setPhase('idle');
    setStatus('');
    return;
  }
  sizePreview();
  startMirror();
  el.idleOv.classList.add('gone');
  el.recBtn.disabled = false;
  el.recLbl.textContent = 'Record';
  setPhase('live');
  setStatus(`Live — ${capture.width}×${capture.height}${hasSound() ? '' : ' · no audio shared'}`);
}

function sizePreview(): void {
  // The element the picture is actually drawn from is the truth: the shared screen,
  // or the webcam when the screen is off. A display track's settings report the
  // *display's* size until the first frame of a tab or window arrives — the whole
  // screen, for a small tab — so sizing from them alone would stretch the tab to the
  // screen. And sizing from the screen while the webcam is the whole picture would
  // stretch the webcam into the size the last screen left in `capture`.
  if (capture.sources.screen && el.sv.videoWidth > 0) {
    capture.setSize(el.sv.videoWidth, el.sv.videoHeight);
  } else if (capture.sources.webcam && el.wcv.videoWidth > 0) {
    capture.setSize(el.wcv.videoWidth, el.wcv.videoHeight);
  }
  el.cv.width = capture.width || 1280;
  el.cv.height = capture.height || 720;
}

/**
 * Wire the preview to the capture's real size. Called once, at startup: an element
 * fires `resize` when its first frame lands and whenever its picture changes size, and
 * the preview follows it — the screen while it is on, the webcam while it is the whole
 * picture.
 */
export function initRecordFlow(): void {
  el.sv.addEventListener('resize', () => {
    if (!capture.sources.screen || currentPhase() === 'review') return;
    sizePreview();
  });
  const followWebcam = (): void => {
    if (!capture.sources.webcam || capture.sources.screen || currentPhase() === 'review') return;
    sizePreview();
  };
  el.wcv.addEventListener('resize', followWebcam);
  el.wcv.addEventListener('loadedmetadata', followWebcam);
}

export async function toggleScreen(): Promise<void> {
  if (busy()) return;
  if (capture.sources.screen) {
    capture.stop();
    el.sv.srcObject = null;
    refreshSourceButtons();
    syncSources();
    return;
  }
  setPhase('starting');
  setStatus('Select a screen…');
  try {
    const captureSession = await capture.start();
    // Only silent if the microphone is off too: with it on, the take has the mic and
    // the status line says nothing. When neither has sound, the toast is the loud
    // version of the status line's "no audio shared".
    if (!captureSession.hasAudio && !capture.sources.mic) {
      toast('No audio was shared — the recording will be silent. Press New to share again with audio.', 6000);
    }
    el.sv.srcObject = captureSession.stream;
    await el.sv.play();
    refreshSourceButtons();
    syncSources();
  } catch (error) {
    setPhase('idle');
    setStatus('');
    refreshSourceButtons();
    // The share was not had, but the webcam, if it is on, still is: let the one
    // place that decides the preview and the phase settle them.
    syncSources();
    const name = error instanceof Error ? error.name : '';
    if (name !== 'AbortError') toast('The screen could not be shared');
  }
}

export async function toggleRecord(): Promise<void> {
  const phase = currentPhase();
  if (phase === 'starting' || phase === 'encoding') return;
  if (phase === 'recording') { await stopRecording(); return; }
  if (phase === 'live' || phase === 'review') { await startRecording(); return; }
  toast('Turn on the screen or the webcam first');
}

/**
 * Start a take, explicitly, without the phase deciding it. The Record button does
 * what it always did (`toggleRecord`); this is the same start, for a caller that has
 * already decided — the automation surface, where an agent asked for a take.
 */
export function startTake(): void {
  void startRecording();
}

async function startRecording(): Promise<void> {
  const outcome = record.start();
  if (outcome.kind === 'refused') { toast(outcome.reason); return; }
  // A take has really begun: from here the sitting session has captured, so its profile is
  // fixed until the session ends — even if this take is stopped and nothing comes of it.
  session.beginCapture();
  setPhase('recording');
  // The preview shows the source this take is drawn from, so it is that source's size —
  // the webcam's own when the screen is off, not the size the last screen left behind
  // (the review is not resized, so a take after a larger one would otherwise stretch it).
  sizePreview();
  el.recBtn.classList.add('recording');
  el.recLbl.textContent = 'Stop';
  el.badge.classList.add('on');
  setStatus('Recording');
  if (outcome.kind === 'started') liveTimeline.start(outcome.stream);
  startMirror();
}

export async function stopRecording(): Promise<void> {
  liveTimeline.stop();
  const outcome = await record.stop();
  setPhase('review');
  el.recBtn.classList.remove('recording');
  el.recLbl.textContent = 'Record';
  el.badge.classList.remove('on');
  if (outcome.kind === 'stopped') {
    const index = session.clip.takes.count() - 1;
    await openReview(index, 0);
    setStatus('Ready');
  }
}

export function onScreenEnded(): void {
  if (currentPhase() === 'recording') { void stopRecording(); return; }
  // A finished clip is kept: recording more just needs a source again. The webcam
  // and the microphone are the user's own toggles and are left alone.
  const keepClip = currentPhase() === 'review' || !session.clip.takes.isEmpty();
  if (keepClip) {
    stopMirror();
    refreshSourceButtons();
    setPhase('review');
    setStatus('Ready to export · turn a source on to record again');
    return;
  }
  syncSources();             // the webcam, if it is on, keeps the preview
}
