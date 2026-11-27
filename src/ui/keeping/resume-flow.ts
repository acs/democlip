// The resume flow: open the recording the app was on, or start a fresh draft.
//
// The open pointer is the app's own record of the sitting. If it names a recording that is
// still there, that recording is restored — its takes, cuts, annotations and the profile
// it was made under — and the review opens on it. If there is no pointer, or the recording
// it named is gone, the app begins a draft in the current project, under that project's
// default profile.

import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import { recordingStore } from '../../infra/recording-store.js';
import { t } from '../i18n/index.js';
import { images } from '../../infra/images.js';
import { session } from '../../session.js';
import { setPhase } from '../../state.js';
import { openReview } from '../clip/review-flow.js';
import { syncWatermark } from '../clip/watermark.js';
import { toast } from '../dom.js';
import { defaultProfileFor, projects, recordings } from '../project/project-flow.js';

export async function resumeClip(): Promise<boolean> {
  const open = await recordingStore.open();
  if (open) {
    const outcome = await recordings.openRecording(open.recordingId);
    if (outcome.ok) {
      images.setRecording(open.recordingId);
      // The annotations are back; their pictures are read into the cache so a restored
      // image draws at once rather than after the first frame. The clip's **logo** is a file
      // the app serves itself, so the watermark that wears it is put back and decoded here.
      await images.load();
      await syncWatermark('picture');
      setPhase('review');
      await openReview(0, 0);
      toast(t('status.restored'));
      return true;
    }
  }

  // No recording to come back to: a new draft, in the project the app is in — and under the
  // profile the draft was left with, when the pointer still says.
  const project = projects.current.get(open?.projectId ?? '') ?? projects.current.current();
  const profile = ClipProfile.restore(open?.profile) ?? defaultProfileFor(project);
  await recordings.startFresh(project.id, profile);
  images.setRecording(session.recordingId);
  return false;
}