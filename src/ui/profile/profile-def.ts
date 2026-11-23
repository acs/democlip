// The profile config sheet: what a profile fixes.
//
// Opened from a profile's pencil mark — never from the selector itself, and never shown there,
// because the selector only selects. Everything about a profile is here: its **name**, and one
// row per item it may control, saying whether it controls it and at what. It names no item of its
// own: it walks the items a profile may control. What it writes is a **declaration**: a controlled item is applied to the app and is
// not the person's to change, while a free one is theirs exactly as it always was.
//
// The built-in default is never offered one. Its whole point is that it controls nothing —
// it is the free profile, and the one the app falls back to.

import { el } from '../dom.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { defineRows, type DefineRow } from './profile-rows.js';

export interface ProfileDefHandlers {
  list(): Profiles;
  locked(): boolean;
  /** Fix an item at a value, or hand it back with null. */
  declare(id: string, property: string, value: string | null): void;
  /** Give a profile another name. */
  rename(id: string, name: string): void;
}

/** What the first choice of a list is called and carries: nothing the app fixes. */
const NOT_FIXED = 'not-fixed';

const NO_HANDLERS: ProfileDefHandlers = {
  list: () => Profiles.starting(),
  locked: () => false,
  declare: () => {},
  rename: () => {},
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
      el.profileDefRows.replaceChildren();
      return;
    }
    const active = profile.id === book.activeId;
    const locked = this.handlers.locked();
    el.profileDefRows.replaceChildren(
      this.nameRow(profile, !(active && locked)),
      ...defineRows(profile, { active, locked }).map(row => this.row(profile.id, row)),
    );
  }

  /**
   * The profile's own **name** — set here rather than in the list, which is for choosing one and
   * nothing else. It is applied when the field is left, like every other field in the app, and
   * refused while the active profile is fixed by a session that has begun to capture.
   */
  private nameRow(profile: Profile, editable: boolean): HTMLElement {
    const host = document.createElement('div');
    host.className = 'pdef-row pdef-who';

    const label = document.createElement('span');
    label.className = 'pdef-name';
    label.textContent = 'Name';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdef-input';
    input.value = profile.name;
    input.disabled = !editable;
    input.setAttribute('aria-label', 'Profile name');
    input.addEventListener('change', () => {
      this.handlers.rename(profile.id, input.value);
      this.render();
    });

    host.append(label, input);
    return host;
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

    // A list: the same choices the panel offers, with **Not fixed** above them — a profile that
    // says nothing about an item leaves it the person's, which the list's own empty value
    // ("None") does not mean.
    if (row.control === 'choice') {
      const choices = row.choices;
      const select = document.createElement('select');
      select.className = 'pdef-input pdef-select';
      select.setAttribute('aria-label', row.label);
      select.disabled = !row.editable;
      // The first is not one of the items: it says the profile fixes nothing here. Its own
      // value is a word no mark is called, and what the change handler reads is the *index* —
      // because the empty value is a choice of its own ("None").
      const options = ['Not fixed', ...choices.map(choice => choice.label)].map((label, at) => {
        const option = document.createElement('option');
        option.value = at === 0 ? NOT_FIXED : choices[at - 1].value;
        option.textContent = label;
        return option;
      });
      select.append(...options);
      select.selectedIndex = row.free ? 0 : 1 + choices.findIndex(choice => choice.value === row.value);
      select.addEventListener('change', () => {
        const picked = select.selectedIndex - 1;      // 0 is "not fixed"
        this.declare(profileId, row.id, picked < 0 ? null : choices[picked]?.value ?? null);
      });
      host.append(select);
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
