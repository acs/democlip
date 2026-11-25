// The annotate options: the one place a kind of annotation is offered.
//
// The kinds used to sit in a row on the selected stretch of the timeline, one more button
// per kind, until a section was too narrow to hold them. They are a vertical column of rows
// on the picture instead — just below the clip's settings control — so a kind is one more
// row that cannot crowd the others, and the timeline section is left to cutting.
//
// It names no kind: the rows are the plugin register, exactly as the section's action row
// used to be. A press chooses the stretch and hands it to the shared canvas, which asks the
// kind's plugin to make one — so adding a kind changes nothing here.
//
// Where a new annotation is shown: the stretch the person selected, if there is one — so an
// annotation spans the section they were pointing at — and otherwise a default stretch at
// the playhead, which the annotation's own duration can then change.

import { currentPhase, onPhaseChange } from '../../state.js';
import { session } from '../../session.js';
import { el } from '../dom.js';
import { Span } from '../../domain/clip/Span.js';
import { DEFAULT_ANNOTATION_S } from '../../domain/annotation/Annotation.js';
import { player } from '../clip/clip.js';
import { selection } from '../cutting/selection.js';
import { canvas } from './annotation-canvas.js';
import { plugins, type AnnotationPlugin } from './annotation-plugin.js';

export function initAnnotateOptions(): void {
  el.annotateBar.addEventListener('click', onClick);
  session.clip.onChange(render);
  onPhaseChange(render);
  render();
}

function onClick(evt: MouseEvent): void {
  const row = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.annotate-row');
  if (!row || currentPhase() !== 'review') return;
  evt.stopPropagation();
  canvas.add(row.dataset.kind ?? '', spanForNew());
}

/** The stretch a new annotation is made over: the selected section, or the playhead and the default. */
function spanForNew(): Span {
  const section = selection.section();
  if (section) return section;
  const total = Math.max(0.001, session.clip.total());
  const length = Math.min(DEFAULT_ANNOTATION_S, total) / total;
  const start = player.time() / total;
  return Span.of(start, start + length).movedTo(start);   // pulled back when it would pass the end
}

/** Draw the kind rows, or nothing when there is nothing to annotate. */
function render(): void {
  // A clip with no picture has no picture to draw a kind on, so the drawn kinds are not
  // offered — but a kind with nothing to draw, the **sound**, is: it is heard, and a
  // sound-only clip is a first-class home for it. The kind says whether it needs a picture.
  const canReview = currentPhase() === 'review' && session.clip.total() > 0;
  const kinds = session.clip.hasPicture()
    ? plugins()
    : plugins().filter(plugin => plugin.needsPicture === false);
  const can = canReview && kinds.length > 0;
  el.annotateBar.classList.toggle('on', can);
  el.annotateBar.replaceChildren(...(can ? kinds.map(row) : []));
}

function row(plugin: AnnotationPlugin): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'annotate-row';
  button.dataset.kind = plugin.id;
  button.title = plugin.action.title;
  button.setAttribute('aria-label', plugin.action.title);
  button.innerHTML = plugin.action.icon + `<span class="annotate-lbl">${plugin.action.label}</span>`;
  return button;
}
