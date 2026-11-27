// Light / dark theme.

import { el } from '../dom.js';
import { currentPhase } from '../../state.js';
import { drawGrid } from '../recording/preview.js';
import { waveform } from '../clip/waveform.js';
import { savePrefs } from '../../prefs.js';

const SUN  = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

/** Announces that the theme changed, after the new one is in effect. */
export const THEME_CHANGED = 'theme-changed';

export function toggleTheme(): void {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  savePrefs();
}

export function applyTheme(t: string): void {
  document.documentElement.dataset.theme = t;
  el.metaTheme.content = t === 'dark' ? '#060710' : '#ECF0FA';
  // light theme shows the moon (click to go dark)
  el.themeIco.innerHTML = t === 'light' ? MOON : SUN;
  if (currentPhase() === 'idle') drawGrid();
  waveform.draw();
  // Ink computed against the old surface (a pill's tone) is repainted by whoever draws it.
  document.dispatchEvent(new CustomEvent(THEME_CHANGED));
}
