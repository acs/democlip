// The build's version, and whether a newer one has been deployed.
//
// A PWA can go on serving an older shell for a while — that is what the service
// worker is for — so the number on screen is how you tell which build a window
// is actually running. The other half of that is being told a newer build
// exists: the deployment publishes its own version, this compares the two and
// offers a reload. It never reloads on its own, because a recording in progress
// would go with it.
//
// The version is set from `package.json` at build time (see vite.config.ts) and
// bumped by the deploy workflow on every merge to main, so the git tag, the
// deployed build and the number in the header all agree.

import { el } from '../dom.js';

// `typeof` is safe when the build never substituted it — a bare test run, say.
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/**
 * The build's version, in one place. The number under the wordmark and the version the
 * automation surface reports are the same string, read here, so they cannot drift.
 */
export function appVersion(): string {
  return VERSION;
}

const ASK_EVERY_MS = 15 * 60 * 1000;   // how often to look, while the app stays open

export function initVersion(): void {
  const label = 'v' + appVersion();
  el.ver.textContent = label;
  el.ver.title = 'DemoClip ' + label + ' — open the project on GitHub';
  el.ver.setAttribute('aria-label', 'DemoClip ' + label + ' — open the project on GitHub');
  el.helpVer.textContent = label;

  el.verNew.addEventListener('click', () => location.reload());
  void askForDeployed();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void askForDeployed(); });
  setInterval(() => void askForDeployed(), ASK_EVERY_MS);
}

// What the deployment is serving, compared with what is running here. Nothing is
// said when it cannot be read — offline, or a host that does not publish it.
async function askForDeployed(): Promise<void> {
  try {
    const res = await fetch(new URL('version.json', document.baseURI), { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json() as { version?: string };
    if (version && version !== VERSION) offerReload(version);
  } catch { /* nothing to compare against */ }
}

function offerReload(deployed: string): void {
  el.verNew.textContent = 'v' + VERSION + ' → v' + deployed + ' · reload';
  el.verNew.title = 'A newer build (v' + deployed + ') has been deployed';
  el.verNew.classList.add('on');
}
