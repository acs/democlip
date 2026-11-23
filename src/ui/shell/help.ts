// The instructions modal.
//
// It holds the brief, step-by-step tutorial — its text is the fragment
// `help-steps.html` beside this file, put in at startup — and a link to the
// complete guide, which is a page of its own (`web/help.html`). Keeping the two
// apart is the point: the dialog stays short, and the long-form text has a page
// to breathe on.

import { el } from '../dom.js';
import stepsHtml from './help-steps.html?raw';

/** Put the brief tutorial in the dialog. */
export function initHelp(): void {
  el.helpSteps.innerHTML = stepsHtml;
}

export function toggleHelp(): void {
  el.helpBd.classList.toggle('on');
}

export function helpBdClick(e: MouseEvent): void {
  if (e.target === el.helpBd) toggleHelp();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') el.helpBd.classList.remove('on');
});
