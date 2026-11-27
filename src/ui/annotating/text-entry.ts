// The app's own way to type a line, for entering a text and for editing its words.
//
// One dialog, used by both, so there is one place a line is typed and one behaviour to
// learn: an input, Cancel and Add, Enter to confirm, Escape to cancel, the input focused
// and its text selected. The browser's `prompt` is gone — it is modal, unstyled and
// cannot be reopened, and this is the app's own surface.
//
// It owns one opening at a time and resolves `ask` with the trimmed words, or with null
// when the user cancelled, so a caller can tell "no change" from "nothing to say".

import { el } from '../dom.js';
import { t } from '../i18n/index.js';

class TextEntry {
  private pending: ((value: string | null) => void) | null = null;

  /** Wire the dialog's buttons and keys. Called once, by the composition root. */
  init(): void {
    el.textEntryAdd.addEventListener('click', () => this.confirm());
    el.textEntryCancel.addEventListener('click', () => this.cancel());
    el.textEntryInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); this.confirm(); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.cancel(); }
    });
    // A press on the dimmed backdrop is a cancel, as it is for the app's other dialogs.
    el.textEntry.addEventListener('click', event => { if (event.target === el.textEntry) this.cancel(); });
  }

  /** Ask for a line. Resolves with the trimmed words, or null when cancelled. */
  ask(initial: string): Promise<string | null> {
    this.cancel();                    // one at a time: a second ask lets the first go
    return new Promise(resolve => {
      this.pending = resolve;
      el.textEntryInput.value = initial;
      el.textEntryAdd.textContent = t(initial.trim() ? 'textEntry.save' : 'textEntry.add');
      el.textEntry.classList.add('on');
      el.textEntryInput.focus();
      el.textEntryInput.select();
    });
  }

  private confirm(): void {
    this.finish(el.textEntryInput.value.trim());
  }

  private cancel(): void {
    this.finish(null);
  }

  private finish(value: string | null): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    el.textEntry.classList.remove('on');
    pending(value);
  }
}

export const textEntry = new TextEntry();