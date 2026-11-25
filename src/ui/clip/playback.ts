// Playback of the recorded clip, rendered on the preview canvas with sound.
//
// The cuts are jumped over as they are reached, without pausing,
// so the cut clip plays as one continuous piece. Two pieces of state make
// that work:
//
//   askedSkip   the cut end already seeked to — each jump is asked for once, not
//               once per frame, so the browser is never re-asked mid-seek
//   seenAt/seenTime   watchdog — if the playhead really will not move, stop
//               rather than leave the transport claiming to play
//
// All of it is the playback in progress — a seek in flight, a stall being
// watched, a join the sound is already down for — so it lives on this object
// rather than in module variables. The transport belongs to the view module that
// owns it; what the session does is end its lifetime, by calling `reset`.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { ctx, el } from '../dom.js';
import { drawClipFrame, drawSoundOnly } from '../recording/preview.js';
import { drawAnnotations, pictureFor } from '../annotating/annotation-layer.js';
import { clampToClip, typingIn } from '../../util.js';
import { keptLengthNow, keptOf, player, reviewFrame } from './clip.js';
import { FADE_S, elementAudio, fadeIn, fadeOut, fadeReset } from './fade.js';
import { boostNow } from './boost.js';
import { resetSounds, tickSounds, unlockSounds } from './sounds.js';
import { DISSOLVE_S, dissolve } from './dissolve.js';

const PLAY_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

const STALL_MS  = 2500;   // how long the playhead may stand still before we stop
const SEEK_MS   = 12000;  // ...but a seek gets longer: jumping a cut means seeking
const NUDGE_MS  = 600;    // ...and a seek that left the clip paused gets a moment

// The end of the cut the playhead sits in, in seconds, or null when
// it is not inside one. The cuts are stored as fractions of the clip.
function cutEndFor(t: number): number | null {
  if (!(session.clip.total() > 0)) return null;
  // Asked in seconds: the map holds the cuts in the recording's own time, so
  // the fraction-of-the-clip the app stores never reaches this question.
  return session.clip.timeline().endAt(t);
}

export class Playback {
  private askedSkip = 0;       // cut end already seeked to, so it is asked for once
  private seekSince = 0;       // when the seek in flight started (0 = none)
  private nudgedAt  = 0;       // when playback was last re-asked for after a seek
  private seenAt    = 0;       // watchdog: position of the playhead at the last look
  private seenTime  = 0;       // watchdog: when that look happened
  private joinFaded = false;
  private playing = false;
  private playRaf: number | null = null;   // the sound is down for a join that is coming

  isPlaying(): boolean {
    return this.playing;
  }

  toggle(): void {
    if (currentPhase() !== 'review') return;
    if (this.playing) this.pause();
    else             this.start();
  }

  start(): void {
    if (currentPhase() !== 'review' || el.rv.readyState < 1) return;
    const end = session.clip.total();
    // (Re)start from the beginning when the playhead sits at the end.
    if (player.time() >= end - 0.02) void player.seek(0);
    this.beginPlayback();
  }

  // Bring the playhead to a moment and hold it there: the frame at that moment,
  // paused. Placing a mark or moving one is a still frame's business — a clip
  // running under the bar is what makes the exact point hard to find.
  hold(time: number): void {
    if (currentPhase() !== 'review' || el.rv.readyState < 1) return;
    if (this.playing) this.pause();
    resetSounds();
    const t = clampToClip(time, 0, session.clip.total());
    this.askedSkip = 0;
    this.updatePlayhead(t);
    void player.seekAndDraw(t);
  }

  // Move the playhead marker to a moment, without moving the picture. Drawing the
  // frame means seeking the element, which costs; the marker does not. So while a
  // bar is dragged the marker can follow the pointer on every move and the frame
  // can be drawn at the throttle's rate.
  showHead(time: number): void {
    if (currentPhase() !== 'review') return;
    this.updatePlayhead(clampToClip(time, 0, session.clip.total()));
  }

  private beginPlayback(): void {
    this.playing = true;
    this.askedSkip = 0;
    this.joinFaded = false;
    fadeReset();               // starting again at full, whatever a pause left behind
    dissolve.clear();              // ...and with no dissolve owed from an earlier join
    resetSounds();                 // ...and no sound owed from before the pause
    unlockSounds();                // the sounds' own context is awoken on this press
    // The element's sound is routed through the boost's gain node to be boosted, and that
    // graph is otherwise made lazily by the fades — which a clip with no join never reaches.
    // So it is made here, on the press that started playback, whenever a boost is in force.
    if (boostNow() !== 1) elementAudio();
    this.seenAt = player.time();
    this.seenTime = Date.now();
    this.updateTransport();
    el.rv.play().then(() => this.loop()).catch(() => {
      this.playing = false;
      this.updateTransport();
    });
  }

  pause(): void {
    this.playing = false;
    this.askedSkip = 0;
    this.seekSince = 0;
    this.joinFaded = false;
    if (!el.rv.paused) el.rv.pause();
    fadeReset();               // a fade must never be left half-applied
    dissolve.clear();              // ...nor a dissolve
    resetSounds();                 // ...nor a sound playing
    this.cancelLoop();
    this.updateTransport();
    this.updatePlayhead();
  }

  reset(): void {
    this.playing = false;
    this.askedSkip = 0;
    this.joinFaded = false;
    this.cancelLoop();
    fadeReset();
    dissolve.clear();
    resetSounds();
    this.updateTransport();
    this.updatePlayhead(0);
  }

  // Jump the playhead to an absolute time (thumbnail scrub), keeping transport state.
  seek(time: number): void {
    if (currentPhase() !== 'review' || el.rv.readyState < 1) return;
    const t = clampToClip(time, 0, session.clip.total());
    this.askedSkip = 0;
    resetSounds();
    this.updatePlayhead(t);
    if (this.playing) void player.seek(t);
    else             void player.seekAndDraw(t);
  }

  // The playhead is shown in timeline time: a cut stretch has no width on screen,
  // so the head must not sit over it.
  private updatePlayhead(time?: number): void {
    const source = time ?? player.time();
    const kept = keptOf(source);
    const total = keptLengthNow();
    const pct = total > 0 ? (kept / total) * 100 : 0;
    el.playhead.style.left = Math.max(0, Math.min(pct, 100)).toFixed(2) + '%';
    el.tNow.textContent = kept.toFixed(2) + 's';
  }

  private loop(): void {
    if (!this.playing) return;
    const now = Date.now();

    // A seek is not a stall. Jumping over a cut stretch means seeking, and a
    // MediaRecorder file can take a while over one, so it is allowed its own,
    // longer time before being given up on.
    if (el.rv.seeking) {
      if (!this.seekSince) this.seekSince = now;
      if (now - this.seekSince > SEEK_MS) { this.pause(); return; }
      this.playRaf = requestAnimationFrame(() => this.loop());
      return;
    }
    if (this.seekSince) {
      this.seekSince = 0;
      if (el.rv.paused && !el.rv.ended) {
        // A seek can leave the clip paused; it was playing, so ask it again.
        this.nudgedAt = now;
        void el.rv.play().catch(() => {});
        this.playRaf = requestAnimationFrame(() => this.loop());
        return;
      }
      this.seenAt = player.time(); this.seenTime = now;      // the stall clock starts fresh
    }

    // Watchdog: a playhead that stops moving means a stalled decode, so stop rather
    // than leaving the transport claiming to play.
    if (player.time() !== this.seenAt) { this.seenAt = player.time(); this.seenTime = now; }
    else if (this.seenTime && now - this.seenTime > STALL_MS) { this.pause(); return; }

    if (el.rv.paused && !el.rv.ended) {
      if (now - this.nudgedAt < NUDGE_MS) { this.playRaf = requestAnimationFrame(() => this.loop()); return; }
      this.pause();
      return;
    }

    // A cut stretch is jumped over without pausing, so playback carries straight
    // on. The seek is asked for once and the playhead is left alone until the
    // element comes out of the seek, so the browser is not re-asked every frame.
    const cutEnd = cutEndFor(player.time());
    if (cutEnd !== null) {
      const to = Math.min(cutEnd, session.clip.total());
      if (!el.rv.seeking && this.askedSkip !== to) { this.askedSkip = to; void player.seek(to); }
      this.updatePlayhead(to);
      this.playRaf = requestAnimationFrame(() => this.loop());
      return;
    }
    this.askedSkip = 0;

    if (player.time() >= session.clip.total()) {
      void player.seek(session.clip.total());
      this.pause();
      return;
    }

    // Another recording follows this one, and the video is nearly at its end:
    // bring the sound down over the last FADE_S, so the join is not abrupt. The
    // sound comes back up as the next recording starts.
    if (player.hasNext() && player.takeLeft() <= FADE_S) {
      if (!this.joinFaded) { this.joinFaded = true; fadeOut(); }
    } else {
      this.joinFaded = false;
    }

    // The recording in the video has run out: carry on into the next one, so the
    // joined clip plays as a whole. Its last frame is held, to dissolve away from.
    // The sound annotations keep playing across the join: kept time is continuous there.
    if (player.ended()) {
      dissolve.holdFrame();
      void player.next(this.playing).then(joined => {
        if (!this.playing) return;
        if (!joined) { this.pause(); return; }
        fadeIn(); this.joinFaded = false;      // up from the join's silence
        this.playRaf = requestAnimationFrame(() => this.loop());
      });
      return;
    }

    const hasPicture = session.clip.hasPicture();
    try {
      // A sound-only clip has no picture to play: the preview keeps saying what the file
      // holds while its sound comes from the element.
      if (hasPicture) drawClipFrame(el.rv, reviewFrame(el.rv));
      else drawSoundOnly();
    } catch { /* a frame still decoding — keep the loop alive */ }
    // What is drawn over the picture, at the moment the playhead holds. An annotation
    // comes in and goes out over DISSOLVE_S of its stretch, as a take does at a join.
    // A sound-only clip has no picture for one to be drawn on, and its export holds none.
    if (hasPicture) {
      const at = player.time();
      const shown = session.clip.annotationsAt(at);
      drawAnnotations(ctx, el.cv.width, el.cv.height, shown, null, {
        at, total: session.clip.total(), seconds: DISSOLVE_S,
      }, undefined, pictureFor(ctx, shown));
    }
    this.updatePlayhead();          // video frames on the preview canvas
    tickSounds(keptOf(player.time()));   // and the sound annotations, at the moment they fall
    this.playRaf = requestAnimationFrame(() => this.loop());   // audio comes from the (unmuted) element
  }

  private cancelLoop(): void {
    if (this.playRaf !== null) { cancelAnimationFrame(this.playRaf); this.playRaf = null; }
  }

  private updateTransport(): void {
    el.playBtn.innerHTML = this.playing ? PAUSE_ICON : PLAY_ICON;
    el.playBtn.classList.toggle('playing', this.playing);
    el.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
  }
}

export const playback = new Playback();

// The transport from the keyboard: `P` plays and pauses, as the ▶ button does. It
// is offered only where the transport means something — a clip in review, and not
// while a field has the keys.
export function initPlaybackKeys(): void {
  window.addEventListener('keydown', evt => {
    if (evt.key.toLowerCase() !== 'p') return;
    if (evt.altKey || evt.ctrlKey || evt.metaKey) return;     // leave the browser's own
    if (typingIn(evt.target) || currentPhase() !== 'review') return;
    evt.preventDefault();
    playback.toggle();
  });
}
