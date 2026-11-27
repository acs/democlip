// The page's entry.
//
// The app itself lives in `src/`, one level up: the Vite root is `web/`, so that the
// repository root holds the project's config and docs and no application files. A
// module outside the root cannot be named by the page directly — the dev server would
// answer the request with the page itself — so this is the one path from the shell to
// the app, and the app's own imports are unchanged.
//
// `i18n-boot` comes first: it chooses the page's language from the browser's own and fills
// the marked elements, so the shell is in the person's language before the app is loaded.
import './i18n-boot.js';
import '../src/main.js';
