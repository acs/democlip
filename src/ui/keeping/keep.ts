// The keep use case, composed for the app: the clip, the recording store, the clock and
// the recording the sitting is on.

import { KeepClip } from '../../application/keep-clip.js';
import { session } from '../../session.js';
import { recordingStore } from '../../infra/recording-store.js';
import { clock } from '../../infra/clock.js';
import { recordings } from '../project/project-flow.js';

export const keep = new KeepClip({
  clip: session.clip,
  store: recordingStore,
  clock,
  place: () => {
    const place = recordings.place();
    const recordingId = session.recordingId;
    return place && recordingId ? { recordingId, place } : null;
  },
  warn: error => console.warn('DemoClip: could not keep the recording —', error),
});