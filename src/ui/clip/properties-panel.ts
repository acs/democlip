// The clip properties panel: the one surface that shows and edits what a clip says
// about itself — its title, its description.
//
// It is the clip's answer to the annotation properties inspector, one level up. It
// names no property: it asks `clipProperties()` for the list and draws one field per
// descriptor — a line for a title, a paragraph for a description — and writes a change
// through `clip.setProperty`, so announcing, the one undo and keeping the clip are the
// clip's and not this module's.
//
// It is a modal of the app's own, like the text entry. A field is applied when it is
// left (or Enter is pressed), so a whole edit is one change the undo takes back, and
// nothing is written while the words are still being typed. Opening it fills the fields
// from the clip; the publish dialogs read the same values when they open.

import { session } from '../../session.js';
import { el, toast } from '../dom.js';
import { clipProperties, type ClipProperty } from './clip-properties.js';

interface Field {
  property: ClipProperty;
  input: HTMLInputElement | HTMLTextAreaElement;
}

class ClipPropertiesPanel {
  private fields: Field[] = [];

  get isOpen(): boolean {
    return el.propsBd.classList.contains('on');
  }

  /** Wire the dialog's buttons and keys. Called once, by the composition root. */
  init(): void {
    el.propsDone.addEventListener('click', () => this.close());
    el.propsClose.addEventListener('click', () => this.close());
    // A press on the dimmed backdrop is a close, as it is for the app's other dialogs.
    el.propsBd.addEventListener('click', event => { if (event.target === el.propsBd) this.close(); });
    // Escape closes the panel and nothing behind it: the picture's Escape (letting go
    // of a pick) must not also fire for a key meant for this dialog.
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !this.isOpen) return;
      event.stopPropagation();
      this.close();
    });
  }

  open(): void {
    this.render();
    el.propsBd.classList.add('on');
    this.fields[0]?.input.focus();
  }

  /** Write whatever was typed but not yet left, and hide. */
  close(): void {
    if (!this.isOpen) return;
    this.apply();
    this.dismiss();
  }

  /**
   * Hide without writing anything back — when the clip itself is gone, so the fields
   * cannot put their old words onto a new, empty clip.
   */
  dismiss(): void {
    el.propsBd.classList.remove('on');
    this.fields = [];
  }

  private render(): void {
    const host = el.propsFields;
    host.replaceChildren();
    this.fields = clipProperties().map(property => {
      const field = document.createElement('label');
      field.className = 'pub-field';
      const name = document.createElement('span');
      name.className = 'pub-label';
      name.textContent = property.label;

      const input = property.control === 'text'
        ? document.createElement('input')
        : document.createElement('textarea');
      input.className = property.control === 'text' ? 'pub-input' : 'pub-input pub-text';
      input.value = property.value(session.clip.properties);
      if (input instanceof HTMLTextAreaElement) input.rows = 3;
      input.addEventListener('change', () => this.applyOne(property, input));

      field.append(name, input);
      host.append(field);
      return { property, input };
    });
  }

  /** Apply one field through the clip: it announces, the one undo holds it, and it is kept. */
  private applyOne(property: ClipProperty, input: HTMLInputElement | HTMLTextAreaElement): void {
    const next = property.with(session.clip.properties, input.value);
    if (!next) { toast(`${property.label} not changed — that value is not allowed`); return; }
    session.clip.setProperty(property.id, next.get(property.id));
  }

  private apply(): void {
    for (const { property, input } of this.fields) this.applyOne(property, input);
  }
}

export const clipPropertiesPanel = new ClipPropertiesPanel();
