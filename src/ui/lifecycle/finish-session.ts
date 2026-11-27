// Finishing the recording: the one sequence behind New, an export and a publish.
//
// The session ends, its recording stays — finished — and a fresh draft begins in the same
// project, under that project's default profile. The views hear the clip's `cleared` and
// reset themselves, exactly as they did when a session ended before there were recordings.

import { images } from '../../infra/images.js';
import { session } from '../../session.js';
import { setPhase } from '../../state.js';
import { applyProfile } from '../profile/profile-flow.js';
import { defaultProfileFor, projects, recordings } from '../project/project-flow.js';

/**
 * End the sitting's recording and start the next draft. Called after the browser work that
 * must see the clip — an export writing its file, a publish reading its picture — so the
 * recording is whole before it is finished.
 */
export async function finishRecording(options: { keepClip?: boolean } = {}): Promise<void> {
  await recordings.finish(options);
  // An export leaves its clip on screen: it is finished, and the app does not keep it any
  // more — but the person may write another file from it. No draft is started underneath it.
  if (options.keepClip) return;
  const project = projects.current.current();
  await recordings.startFresh(project.id, defaultProfileFor(project));
  images.setRecording(session.recordingId);
  applyProfile();
  setPhase('idle');
}