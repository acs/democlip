// The New flow: start over.
//
// It sequences the browser work — let go of the share, end the session, go back for
// a screen — and decides nothing about the clip. Ending the session is one event:
// the clip is cleared and every view resets itself (view-lifetime.ts).

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { capture } from '../../infra/capture.js';
import { el, setStatus } from '../dom.js';
import { syncSources, stopRecording, toggleScreen } from '../recording/record-flow.js';
import { applyProfile } from '../profile/profile-flow.js';

export function startNewSession(): void {
  if (currentPhase() === 'recording') { void stopRecording(); return; }
  if (currentPhase() === 'encoding' || currentPhase() === 'starting') return;

  // A live share has to be let go of before another can be asked for — that is the
  // point of starting over while waiting to record, where the reason is usually to
  // go back and tick "share audio".
  const screenWasOn = capture.sources.screen;
  capture.stop();
  el.sv.srcObject = null;

  setPhase('idle');
  session.end();               // the clip announces `cleared`; the views reset
  // The fresh clip is given what the active profile fixes. The session has ended, so a
  // profile may be chosen again — and this one is what a new clip is made under.
  applyProfile();
  setStatus('Ready');

  // Same as the app start: go back for a share — but only while the screen is a
  // source. The webcam, if it is on, keeps the preview and nothing reaches for the
  // screen.
  if (screenWasOn) void toggleScreen();
  else syncSources();
}
