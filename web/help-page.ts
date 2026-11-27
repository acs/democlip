// The guide page's own entry (web/help.html).
//
// Everything on the page is static; this makes it agree with the app: it wears the
// language the person's browser declares, the theme they chose, and the build's version.
// The theme key is the app's own, read through the same `prefs` module, so the two cannot
// drift.
import { setLocale, currentLocale, t } from '../src/ui/i18n/index.js';
import { resolveLocale } from '../src/ui/i18n/locale.js';
import { applyTranslations } from '../src/ui/i18n/dom.js';
import { loadPrefs } from '../src/prefs.js';

setLocale(resolveLocale(navigator.language));
document.documentElement.lang = currentLocale().split('_')[0] ?? 'en';
document.title = t('guide.title');
applyTranslations();

const theme = loadPrefs().theme;
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const label = document.getElementById('help-ver');
if (label) label.textContent = 'v' + version;
