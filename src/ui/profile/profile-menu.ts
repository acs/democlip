// The profile menu: the toolbar pill's popover.
//
// A panel under the profile pill, styled and placed like the camera menu and the Export
// menu. It is a body-level element so nothing in the header can clip it, and it places
// itself each time it opens (above the pill when there is no room below, and against the
// window's right edge, since the pill is there).
//
// Each profile is a row: a pill with its first letters, its name, a tick when it is the one
// in use, a pencil and a bin; and under them the settings it carries, drawn with the same
// shared control the clip properties declare. A **New Profile** button sits at the foot.
//
// It names no rule of its own. It asks for the book and whether the session has begun to
// capture, draws the rows from the answer, and hands every press to the flow — which is what
// keeps the person's own profiles creatable, renameable and removable while the active one
// and the choice are fixed.

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

const PENCIL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const BIN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

const GAP = 6;      // between the pill and the menu
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
  private creating = false;

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
    this.creating = false;
    this.render();
    const pill = el.profileBtn.getBoundingClientRect();
    const width = el.profileMenu.offsetWidth;
    const height = el.profileMenu.offsetHeight;
    const roomBelow = window.innerHeight - pill.bottom - GAP;
    const top = roomBelow >= height + EDGE ? pill.bottom + GAP : pill.top - height - GAP;
    const left = Math.max(EDGE, Math.min(pill.right - width, window.innerWidth - width - EDGE));
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
      title(),
      ...profileRows(book, locked).map(row => this.row(row)),
      ...(locked ? [lockLine()] : []),
      this.foot(),
    );
  }

  private row(row: ProfileRow): HTMLElement {
    const host = document.createElement('div');
    host.className = row.active ? 'profile-row active' : 'profile-row';
    host.dataset.id = row.id;

    const line = document.createElement('div');
    line.className = 'profile-line';
    if (this.renaming === row.id) {
      line.append(this.renameInput(row));
    } else {
      line.append(this.pick(row));
      if (!row.fixed) line.append(this.acts(row));
    }
    host.append(line);

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

    const avatar = document.createElement('span');
    avatar.className = `profile-avatar av-${row.tone}`;
    avatar.textContent = row.avatar;
    const name = document.createElement('span');
    name.className = 'profile-name';
    name.textContent = row.name;
    const check = document.createElement('span');
    check.className = 'profile-check';
    check.textContent = row.active ? '✓' : '';
    pick.append(avatar, name, check);

    pick.addEventListener('click', () => { this.close(); this.handlers.choose(row.id); });
    return pick;
  }

  /** The person's own pencil and bin. The built-in default has neither. */
  private acts(row: ProfileRow): HTMLElement {
    const acts = document.createElement('div');
    acts.className = 'profile-acts';
    acts.append(
      this.icon('rename', `Rename ${row.name}`, PENCIL, row.manageable, () => {
        this.renaming = row.id;
        this.creating = false;
        this.render();
      }),
      this.icon('remove', `Remove ${row.name}`, BIN, row.manageable, () => {
        this.handlers.remove(row.id);
        this.render();
      }),
    );
    return acts;
  }

  private icon(kind: string, label: string, svg: string, enabled: boolean, press: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-ico';
    button.dataset.act = kind;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = !enabled;
    button.innerHTML = svg;
    button.addEventListener('click', press);
    return button;
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
      else if (event.key === 'Escape') {
        event.stopPropagation();      // cancel the edit, not the whole panel
        this.renaming = null;
        this.render();
      }
    });
    input.addEventListener('blur', commit);
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

  /** The foot: the New Profile button, and the name field it turns into when pressed. */
  private foot(): HTMLElement {
    const foot = document.createElement('div');
    foot.className = 'profile-foot';

    if (!this.creating) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'profile-new-btn';
      add.textContent = '+ New Profile';
      add.addEventListener('click', () => {
        this.creating = true;
        this.renaming = null;
        this.render();
      });
      foot.append(add);
      return foot;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'profile-new-input';
    input.placeholder = 'Profile name';
    input.setAttribute('aria-label', 'New profile name');
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'profile-new-add';
    add.textContent = 'Add';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'profile-new-cancel';
    cancel.textContent = 'Cancel';

    const submit = (): void => {
      const name = input.value;
      if (!name.trim()) return;
      this.creating = false;
      this.handlers.create(name);
      this.render();
    };
    add.addEventListener('click', submit);
    cancel.addEventListener('click', () => { this.creating = false; this.render(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') submit();
      else if (event.key === 'Escape') {
        event.stopPropagation();
        this.creating = false;
        this.render();
      }
    });

    foot.append(input, add, cancel);
    queueMicrotask(() => input.focus());
    return foot;
  }
}

/** The panel's own heading, as a menu of profiles reads better with one. */
function title(): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'profile-title';
  heading.textContent = 'Profiles';
  return heading;
}

/** Why the others cannot be taken, said once rather than on every row. */
function lockLine(): HTMLElement {
  const line = document.createElement('p');
  line.className = 'profile-lock';
  line.textContent = 'A profile is fixed once recording has started — press New to start another session.';
  return line;
}

export const profileMenu = new ProfileMenu();
