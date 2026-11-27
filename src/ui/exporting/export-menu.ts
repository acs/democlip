// The Export menu: where a clip goes.
//
// A small menu under the Export button — a WebM or MP4 file, or Bluesky. It is a
// body-level element rather than a child of the control row, so nothing in the
// layout can clip it; it places itself under the button each time it opens
// (above it when there is no room below), and gives up and closes if the window
// changes size underneath it.
//
// It owns its own open state and the listeners that end it — a click outside, an
// Escape, a choice — so the button only asks it to toggle, and the flow is handed
// the target the person picked, knowing nothing about the menu.

import { el } from '../dom.js';
import { t } from '../i18n/index.js';
import { session } from '../../session.js';
import type { ExportTarget } from '../../infra/export-target.js';

/** Where the Export menu sends a clip: a file in one of the two containers, a file to work on, or a video service. */
export type ExportChoice = ExportTarget | 'editing' | 'bluesky' | 'youtube';

type Choose = (choice: ExportChoice) => void;

const GAP = 6;      // between the button and the menu
const EDGE = 8;     // the least the menu may sit from the window's edge

class ExportMenu {
  private choose: Choose = () => {};

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Node;
    // The button toggles, so a click on it — or on its icon or label — is not
    // "outside"; without this the tap that opened the menu would close it.
    if (!el.expMenu.contains(target) && !el.btnExp.contains(target)) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private readonly onResize = (): void => this.close();

  init(choose: Choose): void {
    this.choose = choose;
    el.expWebm.addEventListener('click', () => this.pick('webm'));
    el.expMp4.addEventListener('click', () => this.pick('mp4'));
    el.expEditing.addEventListener('click', () => this.pick('editing'));
    el.expBluesky.addEventListener('click', () => this.pick('bluesky'));
    el.expYoutube.addEventListener('click', () => this.pick('youtube'));
  }

  get isOpen(): boolean {
    return el.expMenu.classList.contains('on');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    // A video service takes a video, and a clip whose kept stretches have no picture has
    // none to write one from: its two entries are out, saying why, so a person is not sent
    // to sign in for a publish that cannot happen. The file entries stay: a sound file is
    // an export.
    const hasPicture = session.clip.keepsPicture();
    for (const [item, destination] of [[el.expBluesky, 'Bluesky'], [el.expYoutube, 'YouTube']] as const) {
      item.disabled = !hasPicture;
      item.title = hasPicture ? '' : t('export.soundOnly', { destination });
    }
    // The menu keeps its layout while hidden, so it can be measured and placed
    // without a flicker. The Export button sits in the control row under the
    // preview: the menu opens downward when it fits, upward otherwise, and stays
    // inside the window either way.
    const button = el.btnExp.getBoundingClientRect();
    const width = el.expMenu.offsetWidth;
    const height = el.expMenu.offsetHeight;
    const roomBelow = window.innerHeight - button.bottom - GAP;
    const top = roomBelow >= height ? button.bottom + GAP : button.top - height - GAP;
    const left = Math.max(EDGE, Math.min(button.right - width, window.innerWidth - width - EDGE));
    el.expMenu.style.left = `${Math.round(left)}px`;
    el.expMenu.style.top = `${Math.round(Math.max(EDGE, top))}px`;
    el.expMenu.classList.add('on');
    el.btnExp.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    el.expMenu.classList.remove('on');
    el.btnExp.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  private pick(choice: ExportChoice): void {
    this.close();
    this.choose(choice);
  }
}

export const exportMenu = new ExportMenu();
