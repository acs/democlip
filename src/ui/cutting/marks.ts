// Timeline marks, the sections they select, and the cut they approve.
//
// A section is selected with two marks and approved here: it becomes a cut, and
// it leaves the timeline.
//
// The gesture, in full:
//
//   click                     drop a mark (and play from there)
//   click again               bound the section between the two marks
//   scissors / click inside   approve it — the section becomes a cut and leaves
//   undo                      leave it in; the selection is dropped
//   drag a mark / the section  move what is selected; the frame under it follows
//
// An approved cut is taken out of the timeline and what is left closes up, so
// the timeline shows what the export will hold and no discarded hatching is left
// lying about. That mapping is in clip.ts (keptOf/sourceOf); everything here
// works in the recording's own time and converts on the way to the screen. The
// recording itself is never re-encoded — playback and the export simply skip the
// cut stretches — which is what makes one "Undo" enough to put a cut back.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import type { ClipEvent } from '../../domain/clip/Clip.js';
import { el } from '../dom.js';
import { Span } from '../../domain/clip/Span.js';
import { updateSizeUI } from '../clip/timeline-ui.js';
import { fractionAtX as fractionAt, keptLengthNow, keptOf, player, timelineTrack } from '../clip/clip.js';
import { playback } from '../clip/playback.js';
import { typingIn } from '../../util.js';
import { MIN_SECTION, selection } from './selection.js';
import { canvas } from '../annotating/annotation-canvas.js';
import { pluginOf, plugins } from '../annotating/annotation-plugin.js';

const DRAG_MIN   = 3;     // px of travel before a press counts as a drag
const EDGE_GRIP  = 7;     // px near a section's edge that resizes instead of moves
const SEEK_EVERY = 70;    // ms between seeks while dragging
const FRAME_S    = 1 / 30;   // the app records at 30 fps: one step is one frame

// ── Public API ───────────────────────────────────────────────────────────────

// The marks are the view's, but they sit over the clip, so they move when it does.
// The clip says what happened; nothing here has to be remembered by the caller.
function followTheClip(event: ClipEvent): void {
  switch (event.type) {
    case 'take-added': {
      // Fractions of the clip: a new take makes it longer, so the marks move with
      // the moments they were placed over. The first take begins a new clip, which
      // has nothing selected yet.
      if (event.index === 0) selection.marks = [];
      else if (event.previousTotal > 0) {
        const k = event.previousTotal / session.clip.total();
        selection.marks = selection.marks.map(m => m * k);
      }
      break;
    }
    case 'cut-approved':
      selection.marks = [];                              // the selection was spent on it
      break;
    case 'cut-undone':
      selection.marks = [event.cut.s, event.cut.e];   // the cut, selected again
      break;
    case 'cleared':
      selection.marks = [];
      break;
    case 'annotation-added':
      selection.marks = [];                              // the selection was spent on it
      break;
    case 'annotation-changed':
    case 'annotation-removed':
      break;
  }
  renderMarks();
}

export function initTimelineMarks(): void {
  session.clip.onChange(followTheClip);
  el.timeline.addEventListener('click', onTimelineClick);
  el.tlMarks.addEventListener('click', onActionClick);     // the scissors and the undo
  el.cutUndo.addEventListener('click', undoChange);
  el.tlMarks.addEventListener('pointerdown', evt => drag.down(evt));
  window.addEventListener('pointermove', evt => drag.move(evt));
  window.addEventListener('pointerup', evt => drag.up(evt));
  window.addEventListener('pointercancel', () => drag.up());
  window.addEventListener('keydown', onNudgeKey);
}

// Paint the marks and the selected section over the timeline, and the actions
// for the section in the header.
export function renderMarks(): void {
  const d = session.clip.total();
  const host = el.tlMarks;
  const section = selection.section();

  if (currentPhase() !== 'review' || !(d > 0)) {
    host.replaceChildren();
    el.cutWrap.classList.remove('on');
    return;
  }

  // `at` and `stamp` take seconds of the recording; the selection and the marks
  // are held as fractions of it.
  const at = (seconds: number) => ((keptOf(seconds) / Math.max(0.001, keptLengthNow())) * 100).toFixed(3) + '%';
  const stamp = (seconds: number) => keptOf(seconds).toFixed(2) + 's';
  let html = '';

  if (section) {
    html += `<div class="tl-sel" style="left:${at(section.s * d)};width:${pctWidth(section)}">`
          + `<em>CUT ${stamp(section.s * d)}–${stamp(section.e * d)}</em></div>`;
    // the two answers sit on the section itself, clamped so they stay reachable
    const centre = (keptOf(section.s * d) + keptOf(section.e * d)) / 2 / Math.max(0.001, keptLengthNow()) * 100;
    html += `<span class="tl-acts" style="left:${Math.max(7, Math.min(93, centre)).toFixed(2)}%">`
          + `<button class="tl-act ok" data-act="cut" title="Cut this section out" aria-label="Cut this section out">`
          + `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88"/><path d="M14.47 14.48L20 20"/><path d="M8.12 8.12L12 12"/></svg></button>`
          // One button per kind, from the plugin register: adding a kind adds its own
          // button here, and nothing in this module names a kind. A **sound-only** clip
          // has no picture to draw one on, and its file holds none, so the buttons are
          // not offered at all.
          + (session.clip.hasPicture()
            ? plugins().map(plugin =>
                `<button class="tl-act ann" data-act="add" data-kind="${plugin.id}" title="${plugin.action.title}" aria-label="${plugin.action.title}">${plugin.action.icon}</button>`
              ).join('')
            : '')
          + `<button class="tl-act no" data-act="keep" title="Undo the selection" aria-label="Undo the selection">`
          + `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-5"/></svg></button>`
          + `</span>`;
  }
  selection.marks.forEach((m, i) => {
    html += `<div class="tl-mark" data-i="${i}" style="left:${at(m * d)}" title="Mark ${stamp(m * d)} — drag to move"></div>`;
  });
  host.innerHTML = html;

  // the actions: approve or leave the selection, or take the last change back
  if (section) {
    el.tCut.textContent = `CUT ${stamp(section.s * d)}–${stamp(section.e * d)}`;
    el.cutUndo.style.display = 'none';
    el.cutWrap.classList.add('on');
  } else if (session.clip.canUndo()) {
    el.tCut.textContent = undoLabel();
    el.cutUndo.style.display = '';
    el.cutWrap.classList.add('on');
  } else {
    el.tCut.textContent = selection.marks.length === 1 ? 'mark set — click again to close the section' : '';
    el.cutUndo.style.display = 'none';
    el.cutWrap.classList.toggle('on', selection.marks.length === 1);
  }
}

// What the one undo would take back, in the words of the thing it is.
function undoLabel(): string {
  const change = session.clip.pendingUndo();
  if (!change) return '';
  if (change.type === 'cut-approved') return `CUT ${change.removed.toFixed(2)}s`;
  if (change.type === 'property-changed') return change.id.toUpperCase();
  return (pluginOf(change.annotation.kind)?.action.label ?? 'ANNOTATION').toUpperCase();
}

function pctWidth(section: Span): string {
  const kept = Math.max(0.001, keptLengthNow());
  return (((keptOf(section.e * session.clip.total()) - keptOf(section.s * session.clip.total())) / kept) * 100).toFixed(3) + '%';
}

// The scissors and the undo are drawn with the section, so they are read here
// rather than bound to an element that is replaced on every repaint.
function onActionClick(evt: MouseEvent): void {
  const act = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-act');
  if (!act) return;
  evt.stopPropagation();
  if (act.dataset.act === 'cut')           approveCut();
  else if (act.dataset.act === 'add')      addAnnotation(act.dataset.kind ?? '');
  else                                     dismissSelection();
}

// ── Approving, dismissing, undoing ───────────────────────────────────────────

// The scissors: take the section out. The timeline closes up over it, and the
// playhead lands where the section was.
function approveCut(): void {
  if (!canEdit()) return;
  const section = selection.section();
  if (!section) return;
  session.clip.approve(section);                       // it leaves the timeline, and closes up
  afterEdits(section.s * session.clip.total());        // a time in the recording
}

// Annotate: the section is the stretch, and a kind's action arms it — the user then
// makes one over the picture (draws an arrow, chooses a picture), and it belongs to
// that stretch. What happens next is the kind's plugin, not this module.
function addAnnotation(kindId: string): void {
  if (!canEdit()) return;
  const section = selection.section();
  if (!section) return;
  canvas.add(kindId, section);
}

// The undo: leave the section in and drop the selection.
function dismissSelection(): void {
  selection.marks = [];
  renderMarks();
  updateSizeUI();
}

// Put the last change back — a cut, or an arrow — and follow the playhead. The clip
// says which it was; nothing here has to remember.
function undoChange(): void {
  if (!session.clip.undo()) return;
  afterEdits(player.time());
}

// The marks and the timeline redraw because the clip told them to; all that is
// left to do here is follow the playhead.
function afterEdits(at: number): void {
  void playback.seek(at);
}

// ── Clicking the timeline ────────────────────────────────────────────────────

function onTimelineClick(evt: MouseEvent): void {
  if (drag.takesTheClick()) return;                             // that press was a drag
  if (!canEdit()) return;

  const target = evt.target as HTMLElement | null;
  if (target?.closest('.tl-header')) return;                    // labels + actions
  if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

  const width = track().width;
  if (width <= 0) return;
  // A click on the last couple of pixels means the end of the clip.
  const atEnd = evt.clientX - track().left >= width - 2;
  const f = atEnd ? 1 : fractionAt(evt.clientX);
  const time = f * session.clip.total();

  // Inside the selected section: that is the confirmation — cut it out.
  const section = selection.section();
  if (section && f >= section.s && f <= section.e) { approveCut(); return; }

  // Otherwise drop a mark. A click outside the section starts a new pair. The
  // frame at the click is held, not played: the mark has to be placed on the
  // moment the eye is on, and a clip running on from it takes that moment away.
  selection.marks = selection.marks.length >= 2 ? [f] : [...selection.marks, f].sort((a, b) => a - b);
  renderMarks();
  playback.hold(time);
}

// ── Stepping a frame ─────────────────────────────────────────────────────────
//
// A drag cannot land on an exact frame, and the eye cannot hear a word boundary.
// The arrow keys step the bar nearest the playhead — the one being worked on,
// since a drag holds the frame at it — a frame at a time, and the frame follows;
// Shift steps a whole second. With nothing placed, the playhead itself steps.

function onNudgeKey(evt: KeyboardEvent): void {
  if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight') return;
  if (evt.altKey || evt.ctrlKey || evt.metaKey) return;      // leave the browser's own
  if (typingIn(evt.target)) return;
  if (currentPhase() !== 'review') return;
  evt.preventDefault();
  const step = evt.shiftKey ? 1 : FRAME_S;
  nudgeMark(evt.key === 'ArrowLeft' ? -step : step);
}

function nudgeMark(seconds: number): void {
  if (!canEdit()) return;
  const total = session.clip.total();
  if (!(total > 0)) return;
  const at = player.time();

  if (selection.marks.length) {
    const nearest = nearestMark(at, total);
    const moved = Math.min(1, Math.max(0, selection.marks[nearest] + seconds / total));
    selection.marks[nearest] = moved;
    selection.marks.sort((a, b) => a - b);
    renderMarks();
    playback.hold(moved * total);
    return;
  }
  playback.hold(at + seconds);
}

// Which mark sits closest to a moment of the recording, as an index into `marks`.
function nearestMark(at: number, total: number): number {
  let best = 0;
  for (let i = 1; i < selection.marks.length; i++) {
    if (Math.abs(selection.marks[i] * total - at) < Math.abs(selection.marks[best] * total - at)) best = i;
  }
  return best;
}

// ── Dragging a bar ───────────────────────────────────────────────────────────

type GrabKind = 'mark' | 'move' | 'left' | 'right';

interface Press {
  kind: GrabKind;
  index: number;
  offset: number;    // where in the section the pointer took hold
  fromX: number;     // clientX at the press
  moved: boolean;    // has it travelled far enough to count as a drag?
  lastSeek: number;  // when the clip was last moved to follow the bar
}

// The gesture in flight: which bar the pointer took hold of, and whether the click
// that follows it belongs to the drag rather than being a new mark. It is the
// interaction's own state and nothing else can see it, so it lives on an object
// with a lifetime — and the session ends that lifetime, because a drag must not
// outlive the clip it was cutting.
class MarkDrag {
  private press: Press | null = null;
  private swallow = false;

  /** Is a bar being held? */
  get active(): boolean {
    return this.press !== null;
  }

  /** The pointer went down on a bar: this is the gesture until it comes up. */
  down(evt: PointerEvent): void {
    this.swallow = false;
    if (!canEdit()) return;
    const bar = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-mark, .tl-sel');
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const kind: GrabKind = bar.classList.contains('tl-mark') ? 'mark'
      : evt.clientX - rect.left <= EDGE_GRIP ? 'left'
      : rect.right - evt.clientX <= EDGE_GRIP ? 'right'
      : 'move';

    this.press = {
      kind,
      index: Number(bar.dataset.i),
      offset: kind === 'move' ? fractionAt(evt.clientX) - (selection.section()?.s ?? 0) : 0,
      fromX: evt.clientX,
      moved: false,
      lastSeek: 0,
    };
    el.timeline.classList.add('dragging');
  }

  /** The pointer moved: the bar follows it, and the frame under it is held. */
  move(evt: PointerEvent): void {
    const press = this.press;
    if (!press) return;
    if (!press.moved) {
      if (Math.abs(evt.clientX - press.fromX) < DRAG_MIN) return;
      press.moved = true;
    }

    const f = fractionAt(evt.clientX);
    this.dragTo(f);
    renderMarks();
    // The marker follows the pointer on every move; the frame follows at the
    // throttle's rate, because drawing it means a seek and the marker does not.
    const t = f * session.clip.total();
    playback.showHead(t);
    const now = Date.now();
    if (now - press.lastSeek >= SEEK_EVERY) { press.lastSeek = now; playback.hold(t); }
  }

  /** The pointer came up. */
  up(evt?: PointerEvent): void {
    const press = this.press;
    if (!press) return;
    const moved = press.moved;
    this.cancel();
    this.swallow = moved;    // the click that follows a drag must not re-cut
    // The frame is drawn at a throttle while the bar moves, so the last draw may
    // not be where the pointer came to rest. Draw it once more, so the playhead
    // and the bar finish together.
    if (moved && evt) playback.hold(fractionAt(evt.clientX) * session.clip.total());
  }

  /** Is the click that follows the drag the drag's own, rather than a new mark? */
  takesTheClick(): boolean {
    const was = this.swallow;
    this.swallow = false;
    return was;
  }

  /** The session is over: nothing is being held, and the next click is a click. */
  cancel(): void {
    this.press = null;
    this.swallow = false;
    el.timeline.classList.remove('dragging');
  }

  private dragTo(f: number): void {
    const p = this.press;
    if (!p) return;
    if (p.kind === 'mark') {
      selection.marks[p.index] = f;
      return;
    }
    // the section between the marks, moved or resized by an edge
    const section = selection.section();
    if (!section) return;
    const f0 = section.s, f1 = section.e;        // already fractions of the recording
    const span = Span.of(f0, f1);
    const moved = p.kind === 'move' ? span.movedTo(f - p.offset)
                : p.kind === 'left' ? span.resized('s', f, MIN_SECTION)
                : span.resized('e', f, MIN_SECTION);
    selection.marks = [moved.s, moved.e];
  }
}

export const drag = new MarkDrag();

// ── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(): boolean {
  return currentPhase() === 'review' && el.rv.readyState >= 1;   // metadata is enough; a seek in flight must not drop a click
}

// The track is what the marks are laid out against; a click x maps onto it. A sound-only
// clip's strip is hidden, so its track is the waveform standing in its room.
function track(): DOMRect {
  return timelineTrack();
}

// Where on the recording a screen x sits lives in clip.ts (fractionAtX), because the
// annotation lane maps a click the same way and the two must not disagree.

// The span the two pending marks bound lives with the selection now
// (src/ui/cutting/selection.ts): it is what a Cut or an Annotate action is applied to.

