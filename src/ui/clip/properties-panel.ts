// The clip properties panel: the one surface that shows and edits what a clip says
// about itself — its title, its description, and its size.
//
// It is the clip's answer to the annotation properties inspector, one level up, and it
// opens the same way: a small **settings** control in the corner of the preview — the
// picture the clip is seen on, so it sits beside the clip as an annotation's settings
// control sits on the annotation, wearing the same pencil — opens a popover
// beside it. The panel names no property; it asks `clipProperties()` for the list and
// draws one field per descriptor — a line for a title, a paragraph for a description,
// and the size as a value it does not let anyone edit — and writes a change through
// `clip.setProperty`, so announcing, the one undo and keeping the clip are the clip's
// and not this module's.
//
// It is a body-level popover placed beside the control, the way the annotation
// inspector is placed beside its annotation. It owns its open state and its listeners;
// nothing else calls into it but the control, which toggles it.
//
// A field is applied when it is left (or Enter is pressed), so a whole edit is one
// change the undo takes back, and nothing is written while the words are still being
// typed.
//
// A change to the visible viewport — a window resized, or a phone's keyboard coming or
// going — moves the panel back inside what can be seen instead of closing it: to a
// phone, the keyboard is the normal consequence of pressing a field, not a reason to
// take the panel away.

import { session } from '../../session.js';
import { el, toast } from '../dom.js';
import { clipProperties, type ClipProperty } from './clip-properties.js';
import type { Controlling } from '../profile/control.js';

const GAP = 8;      // between the control and the panel
const EDGE = 8;     // the least the panel may sit from a viewport edge

/** A touch screen, where focusing a field summons the on-screen keyboard. */
const TOUCH = '(pointer: coarse)';

/** The mark a profile-fixed property wears: a lock, its tooltip naming the profile. */
const LOCK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

interface Field {
  property: ClipProperty;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  /** The line under the control saying why it cannot be moved, for a property that has a reason. */
  hint?: HTMLSpanElement;
  /** The label around a switch, so it reads as not the person's to press while the switch is. */
  label?: HTMLLabelElement;
}

class ClipPropertiesPanel {
  private fields: Field[] = [];
  private controlling: Controlling = () => null;

  get isOpen(): boolean {
    return el.clipPropMenu.classList.contains('on');
  }

  /** Wire the control and the panel's own listeners. Called once, by the composition root. */
  init(controlling: Controlling = () => null): void {
    this.controlling = controlling;
    el.propsBtn.addEventListener('click', () => this.toggle());
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    // The window's own resize and the visible viewport's: a phone's keyboard shrinks
    // the latter without resizing the former, and either way the panel is put back
    // where it belongs rather than closed under the person's hands.
    window.addEventListener('resize', this.onViewportChange);
    window.visualViewport?.addEventListener('resize', this.onViewportChange);
    window.visualViewport?.addEventListener('scroll', this.onViewportChange);
  }

  /** The settings control: open when closed, close when open. */
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.render();
    el.clipPropMenu.classList.add('on');
    el.propsBtn.setAttribute('aria-expanded', 'true');
    this.place();
    // On a touch screen the choice of which field to type in is the person's: focusing
    // here would open the keyboard at once, over the panel and the picture it belongs
    // to, before either has been read.
    if (!window.matchMedia(TOUCH).matches) this.fields[0]?.input.focus();
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
    el.clipPropMenu.classList.remove('on');
    el.propsBtn.setAttribute('aria-expanded', 'false');
    this.fields = [];
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!this.isOpen) return;
    // The event's own path, not `contains`: applying a change re-renders the panel, so a
    // field's click can reach here after the element it started on is gone. A press on
    // the control is the toggle's own business, and a press inside stays open.
    const path = event.composedPath();
    if (path.includes(el.propsBtn) || path.includes(el.clipPropMenu)) return;
    this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.isOpen) return;
    // Close the panel and nothing behind it: the picture's Escape (letting go of a pick)
    // must not also fire for a key meant for this popover.
    event.stopPropagation();
    this.close();
  };

  /**
   * What can be seen changed: a window was resized, or a phone's keyboard came or went.
   * The panel is anchored to the picture, so it is placed again inside the new bounds —
   * never closed, which on a phone would take it away the moment a field was pressed.
   */
  private readonly onViewportChange = (): void => {
    if (this.isOpen) this.place();
  };

  /** Put the panel beside the control, above it when there is no room below. */
  private place(): void {
    const rect = el.propsBtn.getBoundingClientRect();
    // The visible viewport, not the window: a phone's keyboard shrinks it while the
    // button stays where it is, so the panel must be kept inside what can be seen.
    const view = window.visualViewport;
    const viewLeft = view?.offsetLeft ?? 0;
    const viewTop = view?.offsetTop ?? 0;
    const viewWidth = view?.width ?? window.innerWidth;
    const viewHeight = view?.height ?? window.innerHeight;
    const edgeLeft = viewLeft + EDGE;
    const edgeTop = viewTop + EDGE;
    const edgeRight = viewLeft + viewWidth - EDGE;
    const edgeBottom = viewTop + viewHeight - EDGE;

    // A short viewport — a phone upright with its keyboard up, a landscape phone — lets
    // the panel scroll rather than hiding the fields at its end.
    el.clipPropMenu.style.maxHeight = `${Math.max(0, viewHeight - 2 * EDGE)}px`;

    const width = el.clipPropMenu.offsetWidth;
    const height = el.clipPropMenu.offsetHeight;
    const x = Math.max(edgeLeft, Math.min(rect.left, edgeRight - width));
    const below = rect.bottom + GAP;
    const y = below + height > edgeBottom
      ? Math.max(edgeTop, Math.min(rect.top - height - GAP, edgeBottom - height))
      : below;
    el.clipPropMenu.style.left = `${Math.round(x)}px`;
    el.clipPropMenu.style.top = `${Math.round(y)}px`;
  }

  private render(): void {
    this.fields = [];
    el.clipPropMenu.replaceChildren(...clipProperties().map(property => this.row(property)));
  }

  private row(property: ClipProperty): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-row';
    // Named by the property it draws, as the profile rows are: the panel names no property of
    // its own, but a row still has to be findable.
    host.dataset.id = property.id;

    const name = document.createElement('span');
    name.className = 'prop-name';
    name.textContent = property.label;

    // A property the app shows but the person does not set — the clip size — is its value and
    // nothing to type into. So is one a **profile** fixes: its value, and a **lock** in place of
    // the words, carrying whose it is in its tooltip — so the row says why it will not move
    // without spelling it out on every row.
    const fixedBy = this.controlling(property.id);
    if (property.readOnly || fixedBy) {
      const value = document.createElement('span');
      value.className = 'prop-value';
      value.textContent = this.shown(property);
      if (fixedBy) {
        const line = document.createElement('div');
        line.className = 'prop-fixed';
        const lock = document.createElement('span');
        lock.className = 'prop-lock';
        const said = `Set by ${fixedBy}`;
        lock.title = said;
        lock.setAttribute('role', 'img');
        lock.setAttribute('aria-label', said);
        lock.innerHTML = LOCK_ICON;
        line.append(value, lock);
        host.append(name, line);
      } else {
        host.append(name, value);
      }
      return host;
    }

    // A control the clip cannot offer yet — the switch to add the card, while there is nothing
    // to put on it — is drawn disabled, with the reason under it, and comes to life as soon as
    // the clip has something to add. The fields beside it are never disabled: they are what the
    // switch is waiting for.
    const blocked = this.blocked(property);
    const hint = this.hint(property, blocked);

    // A toggle is one labelled checkbox, rather than a name over a control.
    if (property.control === 'toggle') {
      const label = document.createElement('label');
      label.className = 'prop-toggle';
      label.classList.toggle('off', blocked !== null);
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'prop-check';
      check.disabled = blocked !== null;
      check.checked = property.value(session.clip.properties, session.clip) === 'true';
      check.addEventListener('change', () => this.applyOne({ property, input: check }));
      label.append(check, name);
      host.append(label);
      if (hint) host.append(hint);
      this.fields.push({ property, input: check, hint: hint ?? undefined, label });
      return host;
    }

    // A list: one of the values the property itself declares, so the panel names no property
    // and a person chooses rather than types.
    if (property.control === 'choice') {
      const select = document.createElement('select');
      select.className = 'prop-input prop-select';
      select.disabled = blocked !== null;
      for (const choice of property.choices ?? []) {
        const option = document.createElement('option');
        option.value = choice.value;
        option.textContent = choice.label;
        select.append(option);
      }
      select.value = property.value(session.clip.properties, session.clip);
      select.addEventListener('change', () => this.applyOne({ property, input: select }));
      host.append(name, select);
      if (hint) host.append(hint);
      this.fields.push({ property, input: select, hint: hint ?? undefined });
      return host;
    }

    const input = property.control === 'text'
      ? document.createElement('input')
      : document.createElement('textarea');
    input.className = property.control === 'text' ? 'prop-input' : 'prop-input prop-textarea';
    input.disabled = blocked !== null;
    input.value = property.value(session.clip.properties, session.clip);
    if (input instanceof HTMLTextAreaElement) input.rows = 3;
    input.addEventListener('change', () => this.applyOne({ property, input }));

    host.append(name, input);
    if (hint) host.append(hint);
    this.fields.push({ property, input, hint: hint ?? undefined });
    return host;
  }

  /** Why the property's control cannot be moved now, or null when it can. */
  private blocked(property: ClipProperty): string | null {
    return property.blocked?.(session.clip.properties, session.clip) ?? null;
  }

  /**
   * The line under a control that says why it cannot be moved — for a property that has a
   * reason, shown while the reason holds and hidden when it does not. It is made for every
   * such property, not only while it is blocked, so a change can bring it into view in place
   * without rebuilding the row.
   */
  private hint(property: ClipProperty, blocked: string | null): HTMLSpanElement | null {
    if (!property.blocked) return null;
    const hint = document.createElement('span');
    hint.className = 'prop-hint';
    hint.textContent = blocked ?? '';
    hint.hidden = blocked === null;
    return hint;
  }

  /**
   * What a value reads as where it is shown and not edited: a switch as what it means rather
   * than the string it is kept as, and a list as the label of the choice it holds.
   */
  private shown(property: ClipProperty): string {
    const value = property.value(session.clip.properties, session.clip);
    if (property.control === 'toggle') return value === 'true' ? 'On' : 'Off';
    if (property.control === 'choice') {
      return property.choices?.find(choice => choice.value === value)?.label ?? '—';
    }
    return value || '—';
  }

  /** Apply one field through the clip: it announces, the one undo holds it, and it is kept. */
  private applyOne(field: Field): void {
    const { property, input } = field;
    const value = input instanceof HTMLInputElement && input.type === 'checkbox'
      ? (input.checked ? 'true' : '')
      : input.value;
    // A field left as it was is not a change.
    if (value === property.value(session.clip.properties, session.clip)) return;
    const next = property.with(session.clip.properties, value);
    if (!next) { toast(`${property.label} not changed — that value is not allowed`); return; }
    session.clip.setProperty(property.id, next.get(property.id));
    this.refreshAvailability();
  }

  /**
   * Re-read every field's availability after a change, in place: a word just typed onto the
   * clip may be what the switch to add the card was waiting for. The fields are not rebuilt —
   * they are being typed in — only what is disabled about them changes, and the reason under
   * a control comes and goes with it.
   */
  private refreshAvailability(): void {
    for (const field of this.fields) {
      const reason = this.blocked(field.property);
      field.input.disabled = reason !== null;
      field.label?.classList.toggle('off', reason !== null);
      if (field.hint) {
        field.hint.textContent = reason ?? '';
        field.hint.hidden = reason === null;
      }
    }
  }

  private apply(): void {
    for (const field of this.fields) this.applyOne(field);
  }
}

export const clipPropertiesPanel = new ClipPropertiesPanel();
