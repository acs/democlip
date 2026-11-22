// The profile config sheet: what a profile fixes.
//
// Opened from a profile's sliders mark — never from the selector itself, and never shown
// there, because the selector only selects. It names no item of its own: it walks the items a
// profile may control and draws one row per item, saying whether this profile controls it and
// at what. What it writes is a **declaration**: a controlled item is applied to the app and is
// not the person's to change, while a free one is theirs exactly as it always was.
//
// The built-in default is never offered one. Its whole point is that it controls nothing —
// it is the free profile, and the one the app falls back to.

import { el } from '../dom.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { defineRows, type DefineRow } from './profile-rows.js';

export interface ProfileDefHandlers {
  list(): Profiles;
  locked(): boolean;
  /** Fix an item at a value, or hand it back with null. */
  declare(id: string, property: string, value: string | null): void;
}

const NO_HANDLERS: ProfileDefHandlers = {
  list: () => Profiles.starting(),
  locked: () => false,
  declare: () => {},
};

class ProfileDef {
  private id: string | null = null;
  private handlers: ProfileDefHandlers = NO_HANDLERS;

  get isOpen(): boolean {
    return el.profileDefBd.classList.contains('on');
  }

  /** Wire the sheet's own furniture. Called once, by the composition root. */
  init(handlers: ProfileDefHandlers): void {
    this.handlers = handlers;
    el.profileDefClose.addEventListener('click', () => this.close());
    el.profileDefDone.addEventListener('click', () => this.close());
    el.profileDefBd.addEventListener('click', event => {
      if (event.target === el.profileDefBd) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  /** Open it on one profile. */
  open(id: string): void {
    this.id = id;
    this.render();
    el.profileDefBd.classList.add('on');
  }

  close(): void {
    if (!this.isOpen) return;
    el.profileDefBd.classList.remove('on');
    this.id = null;
  }

  private render(): void {
    const book = this.handlers.list();
    const profile = this.id ? book.get(this.id) : null;
    if (!profile) {
      el.profileDefTitle.textContent = 'Profile';
      el.profileDefRows.replaceChildren();
      return;
    }
    el.profileDefTitle.textContent = profile.name;
    el.profileDefRows.replaceChildren(
      ...defineRows(profile, { active: profile.id === book.activeId, locked: this.handlers.locked() })
        .map(row => this.row(profile.id, row)),
    );
  }

  private row(profileId: string, row: DefineRow): HTMLElement {
    const host = document.createElement('div');
    host.className = 'pdef-row';
    host.dataset.id = row.id;

    const name = document.createElement('span');
    name.className = 'pdef-name';
    name.textContent = row.label;
    host.append(name);

    // A switch is three ways, because a profile can also fix it **off** — which is not the
    // same as leaving it free.
    if (row.control === 'toggle') {
      const seg = document.createElement('div');
      seg.className = 'pdef-seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', row.label);
      const options: Array<{ label: string; value: string | null; on: boolean }> = [
        { label: 'Free', value: null, on: row.free },
        { label: 'On', value: 'true', on: !row.free && row.value === 'true' },
        { label: 'Off', value: '', on: !row.free && row.value !== 'true' },
      ];
      for (const option of options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pdef-opt';
        button.textContent = option.label;
        button.dataset.value = option.value === null ? 'free' : option.value;
        button.setAttribute('aria-pressed', String(option.on));
        button.disabled = !row.editable;
        button.addEventListener('click', () => this.declare(profileId, row.id, option.value));
        seg.append(button);
      }
      host.append(seg);
      return host;
    }

    // Anything else is a value with a field: what the person types is what the profile fixes,
    // and an empty field means it fixes nothing — the item is the person's, as always.
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdef-input';
    input.value = row.value;
    input.placeholder = 'none';
    input.disabled = !row.editable;
    input.setAttribute('aria-label', row.label);
    input.addEventListener('change', () => {
      const value = input.value.trim();
      this.declare(profileId, row.id, value === '' ? null : value);
    });

    host.append(input);
    return host;
  }

  private declare(profileId: string, property: string, value: string | null): void {
    this.handlers.declare(profileId, property, value);
    this.render();
  }
}

export const profileDef = new ProfileDef();
