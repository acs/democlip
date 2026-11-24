// The joined clip: the takes of a session, played as one timeline.
//
// Every press of Record produces a take. They are played in order in the same
// <video>, so that everything else in the app — the playhead, the cuts, the
// thumbnails, the export — can go on thinking in terms
// of a single clip of `session.clip.total()` seconds. This module is the only place
// that knows where a time in that clip falls: which take holds it, and where in
// that take.
//
// The takes are not glued into one file: each MediaRecorder recording is its own
// WebM starting at timestamp 0, and joining them without re-muxing is not
// something a browser will do. Playing them one after another gives the review
// the same timeline, and the export — which encodes them offline — produces a
// single file from the whole thing anyway.
//
// The one thing here that is state is which take the element is holding, so it
// lives on the `Player` the module exports — the player, not the transport: it
// says what is in the video and moves it there, while playback.ts runs the
// playhead over it. The mappings above it hold nothing and stay functions.

import { session } from '../../session.js';
import { currentPhase } from '../../state.js';
import { ctx, el } from '../dom.js';
import { drawFrame, drawSoundOnly, seekTo } from '../recording/preview.js';
import { drawAnnotations } from '../annotating/annotation-layer.js';
import type { Frame } from '../../domain/clip/ClipSize.js';

// ── the timeline the user sees ───────────────────────────────────────────────
//
// Approved cuts leave the timeline and what is left closes up, so the timeline
// shows what the export will hold. Everything the user sees and points at goes
// through these; the recording itself is still addressed in its own time.

// The length the timeline is drawn over: the whole clip with the cuts taken out.
// Everything laid out on it — the strip, the waveform, the marks, the playhead —
// is measured against this.
export function keptLengthNow(): number {
  return session.clip.keptLength();
}

// A time in the recording, as the timeline shows it.
export function keptOf(source: number): number {
  return session.clip.timeline().keptOf(source);
}

// A time on the timeline, as the recording holds it.
export function sourceOf(kept: number): number {
  return session.clip.timeline().sourceOf(kept);
}

// The band the timeline is laid out against. A picture clip has the thumbnail strip; a
// sound-only clip hides it and shows the waveform in its room, so the waveform is the
// track there — the marks and the playhead still need something to be clicked against.
export function timelineTrack(): DOMRect {
  const thumbs = el.thumbs.getBoundingClientRect();
  return thumbs.width > 0 ? thumbs : el.waveform.getBoundingClientRect();
}

// Where on the recording a screen x sits, 0..1. The timeline is drawn in timeline
// time, so this is that mapping back the other way — in one place, because the marks
// and the annotation lane must not disagree about where a click landed.
export function fractionAtX(clientX: number): number {
  const track = timelineTrack();
  if (track.width <= 0 || !(session.clip.total() > 0)) return 0;
  const kept = Math.max(0, Math.min(1, (clientX - track.left) / track.width));
  return Math.max(0, Math.min(1, sourceOf(kept * keptLengthNow()) / session.clip.total()));
}

// ── the take in the element ──────────────────────────────────────────────────
//
// Which take the video is showing, and moving it to another: the joined clip is
// played by holding one take at a time, so this is the state of the player and
// it goes when the session does.

export class Player {
  private loaded = -1;                 // index of the take currently in the video

  // The time on the joined clip, where the video currently sits.
  time(): number {
    return session.clip.takes.startOf(this.loaded) + el.rv.currentTime;
  }

  // Bring the video to a time on the joined clip, loading the take that holds it.
  seek(time: number): Promise<void> {
    if (session.clip.takes.isEmpty()) return seekTo(el.rv, Math.max(0, time));
    const index = session.clip.takes.indexAt(time);
    const local = Math.max(0, time - session.clip.takes.startOf(index));
    if (index === this.loaded) return seekTo(el.rv, local);
    return this.loadTake(index).then(() => seekTo(el.rv, local));
  }

  // Bring the video to a time and paint that frame on the preview, with whatever
  // is drawn over it. A clip with no picture has nothing to paint: its review is what
  // the file is, a waveform and the words that say so.
  seekAndDraw(time: number): Promise<void> {
    return this.seek(time).then(() => {
      if (!session.clip.hasPicture()) { drawSoundOnly(); return; }
      drawFrame(el.rv, reviewFrame(el.rv));
      drawAnnotations(ctx, el.cv.width, el.cv.height, session.clip.annotationsAt(time));
    });
  }

  // Load a take from the start (a review opens on one, and the export walks them).
  load(index: number): Promise<void> {
    return this.loadTake(index);
  }

  // Move to the next take, keeping the video playing. False when there is none.
  async next(wasPlaying = false): Promise<boolean> {
    if (this.loaded < 0 || this.loaded + 1 >= session.clip.takes.count()) return false;
    await this.loadTake(this.loaded + 1);
    if (wasPlaying) await el.rv.play().catch(() => {});
    return true;
  }

  // How much of the take in hand is left to play.
  takeLeft(): number {
    const take = session.clip.takes.at(this.loaded);
    return take ? Math.max(0, take.duration - el.rv.currentTime) : 0;
  }

  // Is there another take after the one in hand? A join is only a join if there
  // is something on the other side of it.
  hasNext(): boolean {
    return this.loaded >= 0 && this.loaded + 1 < session.clip.takes.count();
  }

  // Is the video sitting at the end of the take it holds? Only the end of a take
  // that has another one after it matters — the last one just stops.
  ended(): boolean {
    if (el.rv.ended) return true;
    const take = session.clip.takes.at(this.loaded);
    return !!take && this.hasNext() && el.rv.currentTime >= take.duration - 0.05;
  }

  // The player's own book-keeping, and nothing more: TakeRepository owns the
  // takes and their URLs, so dropping a session no longer goes through here.
  forget(): void {
    this.loaded = -1;
  }

  private loadTake(index: number): Promise<void> {
    const take = session.clip.takes.at(index);
    if (!take) return Promise.resolve();
    this.loaded = index;
    el.rv.src = take.url;      // made once, by the repository, revoked with the session
    el.rv.load();
    return new Promise(resolve => {
      el.rv.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);   // a take that will not decode must not wedge the review
    });
  }
}

export const player = new Player();

// ── the clip's size, shown ───────────────────────────────────────────────────
//
// The preview canvas is the clip size, and every take is drawn fitted into it, so a
// clip of different-sized takes plays in one frame from beginning to end. The view
// listens: a take arriving and the size being set both land here through `resizeReview`.

/**
 * The rectangle the take in the element is drawn into for the clip's size, or
 * undefined when the clip has no size yet — then the frame fills the canvas, which is
 * what the review did before there was a size.
 */
export function reviewFrame(vid: HTMLVideoElement): Frame | undefined {
  const size = session.clip.size();
  if (!size || !(vid.videoWidth > 0)) return undefined;
  return size.frameFor({ width: vid.videoWidth, height: vid.videoHeight });
}

/** Put the preview canvas at the clip's size and redraw the frame it holds. */
export function resizeReview(): void {
  if (currentPhase() !== 'review') return;
  const size = session.clip.size();
  // A sound-only clip has no size: the canvas keeps the app's own 16:9 shape, which is
  // what the sound-only preview is drawn on.
  if (!size) {
    if (el.cv.width !== 1280 || el.cv.height !== 720) {
      el.cv.width = 1280;
      el.cv.height = 720;
    }
    drawSoundOnly();
    return;
  }
  if (el.cv.width === size.width && el.cv.height === size.height) return;
  el.cv.width = size.width;
  el.cv.height = size.height;
  void player.seekAndDraw(player.time()).catch(() => {});
}
