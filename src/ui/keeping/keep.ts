// The keep use case, composed for the app: the clip, the store and the clock.

import { KeepClip } from '../../application/keep-clip.js';
import { session } from '../../session.js';
import { keptClip } from '../../infra/clip-store.js';
import { clock } from '../../infra/clock.js';

export const keep = new KeepClip({
  clip: session.clip,
  store: keptClip,
  clock,
  warn: error => console.warn('DemoClip: could not keep the clip —', error),
});
