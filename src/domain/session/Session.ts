// The session: one sitting of the app — the clip, and whether it has begun to capture.
//
// It is the only owner of the clip. Ending a session is one event: the clip is
// cleared, and every view that shows the clip hears `cleared` and ends its own
// lifetime. The session imports no view module and holds no view state. The clip's
// own sound lives with its takes (`Take.hasAudio`, `Clip.hasSound()`), not here.
//
// `hasCaptured` is the latch a **profile** is fixed by: once a take has actually
// begun in this sitting, another profile cannot be chosen until the session ends. It
// is a latch, not a reading of the clip, because a take begun and then discarded
// leaves nothing behind to remember it — and it is raised only by a take that really
// started, never by a press that was refused.

import type { Clip } from '../clip/Clip.js';

export class Session {
  private captured = false;

  constructor(readonly clip: Clip) {}

  /** Has this session begun to capture? From here the active profile is fixed. */
  get hasCaptured(): boolean {
    return this.captured;
  }

  /** A take has begun in this session. From here on it has captured. */
  beginCapture(): void {
    this.captured = true;
  }

  /** End the session: the clip announces `cleared`, and the views reset themselves. */
  end(): void {
    this.clip.clear();
    this.captured = false;
  }
}
