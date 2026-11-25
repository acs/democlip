// The properties inspector: the one surface that shows and edits what can be changed
// about the picked annotation, whatever its kind.
//
// It names no kind. It asks `propertiesOf(annotation)` for the picked annotation's list
// and renders one control per descriptor — a palette of swatches for a colour, the words
// row for a text — and applies a change through `clip.changeAnnotation`, so announcing,
// the one undo and keeping it are the clip's and not this module's.
//
// It is a body-level popover placed beside the annotation and opened from the settings
// control on it, the way `ui/recording/camera-menu.ts` places the camera menu. It owns
// its open state and its listeners; nothing else calls into it but the canvas, which
// toggles it.

import { session } from '../../session.js';
import { el, toast } from '../dom.js';
import { COLOURS } from '../../domain/annotation/AnnotationColour.js';
import { STOCK_SOUNDS } from '../../domain/sound/StockSounds.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { propertiesFor, type AnnotationProperty } from './annotation-plugin.js';
import { DURATION_STEP_S } from './duration-property.js';
import { textEntry } from './text-entry.js';
import { previewStockSound } from '../clip/sounds.js';

const GAP = 8;      // between the annotation's box and the panel
const EDGE = 8;     // the least the panel may sit from a viewport edge

const PLAY_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

class PropertiesInspector {
  private id: string | null = null;

  get isOpen(): boolean {
    return el.propMenu.classList.contains('on');
  }

  /** Watch the clip: a change to the picked annotation re-renders, a removal closes. */
  init(): void {
    session.clip.onChange(event => {
      if (!this.id) return;
      if (event.type === 'cleared') { this.close(); return; }
      if (event.type === 'annotation-removed' && event.annotation.id === this.id) { this.close(); return; }
      if (event.type === 'annotation-changed' && event.annotation.id === this.id) {
        this.render();
        this.place();
      }
    });
  }

  /** The settings control: open for this annotation when closed, close when open. */
  toggle(annotation: Annotation): void {
    if (this.isOpen && this.id === annotation.id) this.close();
    else this.open(annotation);
  }

  open(annotation: Annotation): void {
    if (propertiesFor(annotation, session.clip).length === 0) return;   // nothing to open for this kind
    this.id = annotation.id;
    this.render();
    this.place();
    el.propMenu.classList.add('on');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    if (!this.isOpen) return;
    el.propMenu.classList.remove('on');
    this.id = null;
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    // The event's own path, not `contains`: applying a change re-renders the panel, so a
    // swatch's click can reach here after the button it started on is gone.
    const path = event.composedPath();
    // A press on the picture is the canvas's business — it picks, moves, or opens with
    // the settings control, and closes this itself when the pick changes.
    if (path.includes(el.propMenu) || path.includes(el.cv)) return;
    this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.isOpen) return;
    // Close the panel and leave the annotation picked; the canvas would otherwise read
    // the same Escape as "let go of it".
    event.stopPropagation();
    this.close();
  };

  private readonly onResize = (): void => this.close();

  /** Put the panel beside the annotation's box, clamped to the viewport. */
  private place(): void {
    const annotation = this.id ? session.clip.annotations.byId(this.id) : null;
    if (!annotation) return;
    const width = el.propMenu.offsetWidth;
    const height = el.propMenu.offsetHeight;

    const handles = annotation.handles({ w: el.cv.width, h: el.cv.height });
    if (handles.length === 0) {
      // A kind with nothing on the picture — a **sound** — has no box to sit beside. The panel
      // goes in the corner of the preview, over the picture rather than over the transport, so
      // opening it to choose a sound does not cover the play button. With no picture at all
      // (a sound-only clip) it falls back to the lane.
      const rect = el.cv.getBoundingClientRect();
      const anchor = rect.width > 0 ? rect : el.tlAnnots.getBoundingClientRect();
      const x = Math.max(EDGE, Math.min(anchor.left + GAP, window.innerWidth - width - EDGE));
      const y = Math.max(EDGE, Math.min(anchor.top + GAP, window.innerHeight - height - EDGE));
      el.propMenu.style.left = `${Math.round(x)}px`;
      el.propMenu.style.top = `${Math.round(y)}px`;
      return;
    }

    const rect = el.cv.getBoundingClientRect();
    const xs = handles.map(handle => handle.x);
    const ys = handles.map(handle => handle.y);
    const left = rect.left + Math.min(...xs) * rect.width;
    const right = rect.left + Math.max(...xs) * rect.width;
    const top = rect.top + Math.min(...ys) * rect.height;

    const roomRight = window.innerWidth - right - GAP;
    const x = roomRight >= width + EDGE ? right + GAP : Math.max(EDGE, left - width - GAP);
    const y = Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    el.propMenu.style.left = `${Math.round(x)}px`;
    el.propMenu.style.top = `${Math.round(y)}px`;
  }

  private render(): void {
    const annotation = this.id ? session.clip.annotations.byId(this.id) : null;
    if (!annotation) { this.close(); return; }
    el.propMenu.replaceChildren(...propertiesFor(annotation, session.clip).map(property => this.row(property, annotation)));
  }

  private row(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-row';
    host.dataset.id = property.id;
    const name = document.createElement('span');
    name.className = 'prop-name';
    name.textContent = property.label;
    host.append(name, property.control === 'colour' ? this.swatches(property, annotation)
      : property.control === 'duration' ? this.seconds(property, annotation)
      : property.control === 'number' ? this.numbers(property, annotation)
      : property.control === 'sound' ? this.sounds(property, annotation)
      : this.words(property, annotation));
    return host;
  }

  /** A `sound` property: a drop-down of the app's stock sounds, and one play button for the chosen one. */
  private sounds(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-sounds';
    const current = property.value(annotation);

    const select = document.createElement('select');
    select.className = 'prop-sound-select';
    select.setAttribute('aria-label', property.label);
    for (const sound of STOCK_SOUNDS) {
      const option = document.createElement('option');
      option.value = sound.name;
      option.textContent = sound.label;
      option.selected = sound.name === current;
      select.append(option);
    }
    // Choosing in the list is choosing the sound: it is applied at once, and is what the one
    // play button plays.
    select.addEventListener('change', () => this.apply(property, annotation, select.value));

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'prop-sound-play';
    play.title = 'Play the chosen sound';
    play.setAttribute('aria-label', 'Play the chosen sound');
    play.innerHTML = PLAY_ICON;
    play.addEventListener('click', event => {
      event.stopPropagation();
      previewStockSound(select.value);
    });

    host.append(select, play);
    return host;
  }

  private swatches(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-swatches';
    const current = property.value(annotation);
    for (const colour of COLOURS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prop-swatch';
      button.style.background = colour;
      button.title = colour;
      button.setAttribute('aria-label', colour);
      button.setAttribute('aria-pressed', String(colour === current));
      button.addEventListener('click', () => this.apply(property, annotation, colour));
      host.append(button);
    }
    return host;
  }

  /** A `duration` property: the seconds it lasts, and a step either way. */
  private seconds(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-duration';
    const value = property.value(annotation);
    const readout = document.createElement('span');
    readout.className = 'prop-duration-text';
    readout.textContent = `${value}s`;
    const nudge = (delta: number) => this.apply(property, annotation, (Number(value) + delta).toFixed(2));
    host.append(
      this.stepButton('−', 'Shorter', () => nudge(-DURATION_STEP_S)),
      readout,
      this.stepButton('+', 'Longer', () => nudge(DURATION_STEP_S)),
    );
    return host;
  }

  /** A `number` property: a value and the step its kind declares, as the duration does. */
  private numbers(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-duration';
    const value = property.value(annotation);
    const readout = document.createElement('span');
    readout.className = 'prop-duration-text';
    readout.textContent = `${value}${property.suffix ?? ''}`;
    const step = property.step ?? 1;
    const nudge = (delta: number) => this.apply(property, annotation, String(Number(value) + delta));
    host.append(
      this.stepButton('−', 'Lower', () => nudge(-step)),
      readout,
      this.stepButton('+', 'Higher', () => nudge(step)),
    );
    return host;
  }

  private stepButton(label: string, aria: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prop-step';
    button.textContent = label;
    button.setAttribute('aria-label', aria);
    button.addEventListener('click', onClick);
    return button;
  }

  /** A `text` property: the words it holds, and the action that changes them. */
  private words(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-words';
    const value = property.value(annotation);
    const current = document.createElement('span');
    current.className = 'prop-words-text';
    current.textContent = value || '—';
    current.title = value;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'prop-edit';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      // The same entry the kind is created with. A cancelled entry changes nothing; an
      // empty one is refused by the kind and reported by `apply`.
      void textEntry.ask(value).then(next => {
        if (next === null) return;
        this.apply(property, annotation, next);
      });
    });
    host.append(current, edit);
    return host;
  }

  /** Apply a change through the clip: it announces, the one undo holds it, and this
   *  panel re-renders from the event rather than from here. */
  private apply(property: AnnotationProperty, annotation: Annotation, value: string): void {
    const next = property.with(annotation, value);
    if (!next) { toast(`${property.label} not changed — that value is not allowed`); return; }
    // A change that changes nothing — the same colour, the same words, a duration already
    // as long as the clip allows — is not announced, so it is not what the one undo holds.
    if (property.value(next) === property.value(annotation)) return;
    session.clip.changeAnnotation(annotation.id, next);
  }
}

export const inspector = new PropertiesInspector();