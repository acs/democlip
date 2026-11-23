// The guide page's own entry (web/help.html).
//
// Everything on the page is static; this only makes it agree with the app: the
// page wears the theme the person chose, and shows the build's version. The
// theme key is the app's own, read through the same `prefs` module, so the two
// cannot drift.

import { loadPrefs } from '../src/prefs.js';

const theme = loadPrefs().theme;
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const label = document.getElementById('help-ver');
if (label) label.textContent = 'v' + version;
