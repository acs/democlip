// The app's own yes/no for an action that cannot be undone.
//
// The browser's `confirm` is gone for the same reason its `prompt` is: it is modal,
// unstyled, cannot be themed or put in the app's own words — and, with the page driven by
// an agent over the DevTools Protocol, it is dismissed before a person can answer, so a
// destructive action could never be confirmed at all. This is the app's own surface: the
// question, the action's own word on the danger button, Cancel to leave it alone.
//
// One opening at a time; `ask` resolves true when the action is confirmed, false when it
// is cancelled — Cancel, Escape, or a press on the dimmed backdrop.

import { el } from '../dom.js';

export interface ConfirmOptions {
  /** The question, in the app's own words. */
  readonly message: string;
  /** The word on the danger button — the action itself ("Delete", "Remove"). */
  readonly okLabel: string;
  /** True (the default) for an action that cannot be undone, so the button reads red. */
  readonly danger?: boolean;
}

class Confirm {
  private pending: ((ok: boolean) => void) | null = null;

  /** Wire the dialog's buttons and keys. Called once, by the composition root. */
  init(): void {
    el.confirmOk.addEventListener('click', () => this.finish(true));
    el.confirmCancel.addEventListener('click', () => this.finish(false));
    // A press on the dimmed backdrop is a cancel, as it is for the app's other dialogs.
    el.confirm.addEventListener('click', event => { if (event.target === el.confirm) this.finish(false); });
    // Escape cancels — and is stopped here so it does not also close the dialog behind.
    el.confirm.addEventListener('keydown', event => {
      if (!this.pending || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.finish(false);
    });
  }

  /** Ask the question. Resolves true when confirmed, false when cancelled. */
  ask(options: ConfirmOptions): Promise<boolean> {
    this.finish(false);               // one at a time: a second ask lets the first go
    return new Promise(resolve => {
      this.pending = resolve;
      el.confirmMessage.textContent = options.message;
      el.confirmOk.textContent = options.okLabel;
      el.confirmOk.classList.toggle('danger', options.danger ?? true);
      el.confirm.classList.add('on');
      el.confirmOk.focus();
    });
  }

  /** True while the question is on screen. */
  get isOpen(): boolean {
    return this.pending !== null;
  }

  private finish(ok: boolean): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    el.confirm.classList.remove('on');
    pending(ok);
  }
}

export const confirm = new Confirm();
