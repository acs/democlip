// The New flow: start over.
//
// It sequences the browser work — let go of the share, end the recording, go back for a
// screen — and decides nothing about the clip. Ending the session is one event: the clip is
// cleared and every view resets itself (view-lifetime.ts); the recording it became stays in
// its project, finished, and a fresh draft begins under the same project's default profile.

import { currentPhase } from '../../state.js';
import { capture } from '../../infra/capture.js';
import { el, setStatus } from '../dom.js';
import { t } from '../i18n/index.js';
import { syncSources, stopRecording, toggleScreen } from '../recording/record-flow.js';
import { finishRecording } from './finish-session.js';

export async function startNewSession(): Promise<void> {
  if (currentPhase() === 'recording') { void stopRecording(); return; }
  if (currentPhase() === 'encoding' || currentPhase() === 'starting') return;

  // A live share has to be let go of before another can be asked for — that is the
  // point of starting over while waiting to record, where the reason is usually to
  // go back and tick "share audio".
  const screenWasOn = capture.sources.screen;
  capture.stop();
  el.sv.srcObject = null;

  await finishRecording();

  // Same as the app start: go back for a share — but only while the screen is a
  // source. The webcam, if it is on, keeps the preview and nothing reaches for the
  // screen.
  if (screenWasOn) void toggleScreen();
  else syncSources();
  // Sync decides what the preview shows, and clears the status when nothing is on; a
  // session that has just started is ready whatever the sources say.
  if (currentPhase() === 'idle') setStatus(t('status.ready'));
}