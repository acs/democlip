// The profile menu: the toolbar icon's popover.
//
// A small menu under the profile button, styled and placed like the camera menu and the
// Export menu. It is a body-level element so nothing in the header can clip it, and it
// places itself each time it opens (above the button when there is no room below, and
// against the window's right edge, since the button is there).
//
// It names no rule of its own. It asks for the book and whether the session has begun to
// capture, draws one row per profile from the answer, and hands every press to the flow —
// which is what keeps the person's own profiles creatable, renameable and removable while
// the active one and the choice are fixed.

import { el } from '../dom.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { profileRows, type ProfileRow, type ProfileSettingRow } from './profile-rows.js';

/** The flow's own operations, handed to the menu. Each answers nothing; the menu redraws. */
export interface ProfileMenuHandlers {
  list(): Profiles;
  locked(): boolean;
  choose(id: string): void;
  setSetting(id: string, propertyId: string, value: string): void;
  create(name: string): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
}

const GAP = 6;      // between the button and the menu
const EDGE = 8;     // the least the menu may sit from the window's edge

const NO_HANDLERS: ProfileMenuHandlers = {
  list: () => Profiles.starting(),
  locked: () => false,
  choose: () => {},
  setSetting: () => {},
  create: () => {},
  rename: () => {},
  remove: () => {},
};

class ProfileMenu {
  private handlers: ProfileMenuHandlers = NO_HANDLERS;
  private renaming: string | null = null;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    // The event's own path, not `contains`: a press on a setting re-renders the menu, so by
    // the time this runs the element it started on is gone — and `contains` would say the
    // press was outside, closing the menu out from under the person. The properties panel
    // keeps the same habit for the same reason.
    const path = event.composedPath();
    if (path.includes(el.profileMenu) || path.includes(el.profileBtn)) return;
    this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private readonly onResize = (): void => this.close();

  init(handlers: ProfileMenuHandlers): void {
    this.handlers = handlers;
  }

  get isOpen(): boolean {
    return el.profileMenu.classList.contains('on');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.renaming = null;
    this.render();
    const button = el.profileBtn.getBoundingClientRect();
    const width = el.profileMenu.offsetWidth;
    const height = el.profileMenu.offsetHeight;
    const roomBelow = window.innerHeight - button.bottom - GAP;
    const top = roomBelow >= height + EDGE ? button.bottom + GAP : button.top - height - GAP;
    const left = Math.max(EDGE, Math.min(button.right - width, window.innerWidth - width - EDGE));
    el.profileMenu.style.left = `${Math.round(left)}px`;
    el.profileMenu.style.top = `${Math.round(Math.max(EDGE, top))}px`;
    el.profileMenu.classList.add('on');
    el.profileBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    if (!this.isOpen) return;
    el.profileMenu.classList.remove('on');
    el.profileBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  /** Redraw, but only while it is open — a change behind a closed menu needs no DOM. */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private render(): void {
    const book = this.handlers.list();
    const locked = this.handlers.locked();
    el.profileMenu.replaceChildren(
      ...profileRows(book, locked).map(row => this.row(row)),
      this.newRow(),
      ...(locked ? [this.lockLine()] : []),
    );
  }

  private row(row: ProfileRow): HTMLElement {
    const host = document.createElement('div');
    host.className = row.active ? 'profile-row active' : 'profile-row';
    host.dataset.id = row.id;

    const head = document.createElement('div');
    head.className = 'profile-head';
    head.append(this.renaming === row.id ? this.renameInput(row) : this.pick(row));

    if (!row.fixed) {
      const acts = document.createElement('div');
      acts.className = 'profile-acts';
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'profile-act';
      rename.textContent = 'Rename';
      rename.disabled = !row.manageable;
      rename.addEventListener('click', () => { this.renaming = row.id; this.render(); });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'profile-act';
      remove.textContent = 'Remove';
      remove.disabled = !row.manageable;
      remove.addEventListener('click', () => { this.handlers.remove(row.id); this.render(); });
      acts.append(rename, remove);
      head.append(acts);
    }

    host.append(head);

    if (row.settings.length) {
      const settings = document.createElement('div');
      settings.className = 'profile-settings';
      for (const setting of row.settings) settings.append(this.setting(row.id, setting));
      host.append(settings);
    }
    return host;
  }

  private pick(row: ProfileRow): HTMLElement {
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'profile-pick';
    pick.setAttribute('role', 'menuitemradio');
    pick.setAttribute('aria-checked', String(row.active));
    pick.disabled = !row.selectable;

    const name = document.createElement('span');
    name.className = 'profile-pick-name';
    name.textContent = row.name;
    const check = document.createElement('span');
    check.className = 'profile-pick-check';
    check.textContent = row.active ? '✓' : '';
    pick.append(name, check);

    pick.addEventListener('click', () => { this.close(); this.handlers.choose(row.id); });
    return pick;
  }

  private renameInput(row: ProfileRow): HTMLElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'profile-rename-input';
    input.value = row.name;
    input.setAttribute('aria-label', `Rename ${row.name}`);
    const commit = (): void => this.commitRename(row.id, input.value);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') commit();
      else if (event.key === 'Escape') { this.renaming = null; this.render(); }
    });
    input.addEventListener('blur', commit);
    // Focus after the row is in the DOM, so the person can type straight away.
    queueMicrotask(() => { input.focus(); input.select(); });
    return input;
  }

  private commitRename(id: string, name: string): void {
    if (this.renaming !== id) return;      // already committed by the Enter, or cancelled
    this.renaming = null;
    this.handlers.rename(id, name);
    this.render();
  }

  private setting(profileId: string, row: ProfileSettingRow): HTMLElement {
    const label = document.createElement('label');
    label.className = 'profile-setting';
    const input = document.createElement('input');
    if (row.control === 'toggle') {
      input.type = 'checkbox';
      input.checked = row.value === 'true';
      input.addEventListener('change', () => this.apply(profileId, row.id, input.checked ? 'true' : ''));
    } else {
      input.type = 'text';
      input.value = row.value;
      input.addEventListener('change', () => this.apply(profileId, row.id, input.value));
    }
    input.disabled = !row.editable;
    const text = document.createElement('span');
    text.textContent = row.label;
    label.append(input, text);
    return label;
  }

  private apply(profileId: string, propertyId: string, value: string): void {
    this.handlers.setSetting(profileId, propertyId, value);
    this.render();
  }

  private newRow(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'profile-new';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'profile-new-input';
    input.placeholder = 'New profile';
    input.setAttribute('aria-label', 'New profile name');
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'profile-new-add';
    add.textContent = 'Add';
    const submit = (): void => {
      const name = input.value;
      if (!name.trim()) return;
      input.value = '';
      this.handlers.create(name);
      this.render();
    };
    add.addEventListener('click', submit);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    wrap.append(input, add);
    return wrap;
  }

  private lockLine(): HTMLElement {
    const line = document.createElement('p');
    line.className = 'profile-lock';
    line.textContent = 'A profile is fixed once recording has started — press New to start another session.';
    return line;
  }
}

export const profileMenu = new ProfileMenu();
