// The browser the server owns.
//
// It is launched **headful**, on purpose: the person is watching the edits land, and
// that is the feature. It runs on a **profile of its own** — a directory of ours, not
// the person's everyday browser — so their real profile is untouched and the
// publishing sign-in has a home of its own that lasts the session and no longer.
//
// It is the person's **own Chrome** by default, and how it is started matters as much
// as which browser it is. macOS grants Screen Recording per *application bundle*, and
// it attributes the grant to the **responsible process**: a browser spawned as a child
// of this server is not an application the system will let the person grant, so it
// never appears in System Settings and the picker never opens. So on macOS the browser
// is started the way a person starts it — through LaunchServices, by `open` — and the
// server attaches to its debugging port instead of owning it. The grant the person gave
// Chrome then applies, because it is Chrome, launched normally.
//
// The page is opened with the flag that asks for the automation surface. Nothing else
// about the app changes: it is a normal browser on DemoClip.

import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

/** Which browser was opened, and whether the system can grant it the screen. */
export interface BrowserIdentity {
  /** What to call it when telling the person. */
  readonly label: string;
  /**
   * True when the system treats it as an application it can grant Screen Recording
   * to. Only macOS asks that, and only about a bundle it recognises.
   */
  readonly grantable: boolean;
}

export interface OpenedApp {
  readonly page: Page;
  readonly browser: BrowserIdentity;
  readonly close: () => Promise<void>;
}

export interface LaunchOptions {
  /** Headless is for the server's own checks only; a session for a person is headful. */
  readonly headless?: boolean;
  /** The browser to launch, when the person keeps it somewhere unusual. */
  readonly executablePath?: string;
  /**
   * Force a browser channel. An explicit `null` means the Chromium Playwright ships;
   * left out, a headful session opens Chrome and a headless check uses the bundled one.
   */
  readonly channel?: 'chrome' | 'msedge' | 'chromium' | null;
  /**
   * Extra flags for the browser, for a caller that needs something the machine does not
   * have. A check that records a take has no camera to record with, so it asks for
   * Chromium's fake one — the same two flags the end-to-end suite launches with. A
   * session for a person passes none: it records what is really there.
   */
  readonly args?: readonly string[];
}

const LABELS: Readonly<Record<string, string>> = {
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  chromium: 'Chromium',
};

const BUNDLED: BrowserIdentity = { label: 'Chromium', grantable: false };

interface Launched {
  readonly context: BrowserContext;
  readonly browser: BrowserIdentity;
  close(): Promise<void>;
}

/** Open the app, in a browser of the person's, on the page that asked to be driven. */
export async function openApp(origin: string, options: LaunchOptions = {}): Promise<OpenedApp> {
  const profile = await mkdtemp(join(tmpdir(), 'democlip-profile-'));
  const launched = await launch(profile, options);
  try {
    const page = launched.context.pages()[0] ?? (await launched.context.newPage());
    await page.goto(`${origin}/?agent=1`, { waitUntil: 'domcontentloaded' });
    return { page, browser: launched.browser, close: () => launched.close() };
  } catch (error) {
    await launched.close().catch(() => {});
    throw error;
  }
}

async function launch(profile: string, options: LaunchOptions): Promise<Launched> {
  const headless = options.headless ?? false;
  const common = {
    headless,
    viewport: null,
    args: ['--no-first-run', '--no-default-browser-check', ...(options.args ?? [])],
  };

  if (options.executablePath) {
    const context = await chromium.launchPersistentContext(profile, {
      ...common,
      executablePath: options.executablePath,
    });
    return {
      context,
      browser: { label: options.executablePath, grantable: true },
      close: () => closeAndForget(context, profile),
    };
  }

  // A check runs headless and wants the browser we pin. A session for a person wants
  // the browser they can grant the screen to, so Chrome is the default.
  const asked = 'channel' in options;
  const channel = asked ? options.channel : (headless ? null : 'chrome');

  if (channel && !headless && process.platform === 'darwin') {
    try {
      return await launchAsAnApp(profile, channel, options.args ?? []);
    } catch (error) {
      // A channel the caller asked for is their choice, and its failure is theirs to
      // see. A default may fall back — and the browser it fell back to says why, later.
      if (asked) throw error;
      const context = await chromium.launchPersistentContext(profile, common);
      return { context, browser: BUNDLED, close: () => closeAndForget(context, profile) };
    }
  }

  if (!channel) {
    const context = await chromium.launchPersistentContext(profile, common);
    return { context, browser: BUNDLED, close: () => closeAndForget(context, profile) };
  }

  try {
    const context = await chromium.launchPersistentContext(profile, { ...common, channel });
    return {
      context,
      browser: { label: LABELS[channel] ?? channel, grantable: true },
      close: () => closeAndForget(context, profile),
    };
  } catch (error) {
    if (asked) throw error;
    const context = await chromium.launchPersistentContext(profile, common);
    return { context, browser: BUNDLED, close: () => closeAndForget(context, profile) };
  }
}

/**
 * Start the browser the way a person does — through LaunchServices — and attach to it.
 *
 * This is the whole point on macOS: a process we spawn is a child of ours, and the
 * system will not let the person grant Screen Recording to that. Started by the system
 * instead, it is an ordinary Chrome launch, and the grant they gave Chrome applies.
 * The debugging port is on loopback and lives only as long as the session.
 */
async function launchAsAnApp(profile: string, channel: string, extra: readonly string[] = []): Promise<Launched> {
  const app = LABELS[channel] ?? channel;
  const port = await freePort();
  await run('open', [
    '-na', app,
    '--args',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...extra,
  ]);

  const endpoint = `http://127.0.0.1:${port}`;
  await waitForEndpoint(endpoint, 20_000);

  const remote = await chromium.connectOverCDP(endpoint);
  const context = remote.contexts()[0];
  if (!context) {
    await remote.close().catch(() => {});
    await closeByProfile(profile);
    throw new Error('the browser opened without a window to drive');
  }

  return {
    context,
    browser: { label: app, grantable: true },
    close: async () => {
      // Disconnecting does not end a browser the system started, so the session ends
      // it by the one profile only it uses.
      await remote.close().catch(() => {});
      await closeByProfile(profile);
      await forgetProfile(profile);
    },
  };
}

/** A port on loopback that nothing is listening on, taken and released. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Wait until the browser answers on its debugging port, or give up saying so. */
export async function waitForEndpoint(endpoint: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(`the browser did not open a debugging port within ${Math.round(timeoutMs / 1000)}s`);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

async function closeAndForget(context: BrowserContext, profile: string): Promise<void> {
  await context.close().catch(() => {});
  await forgetProfile(profile);
}

/**
 * Let the profile go when the session does.
 *
 * It is the session's own directory — the publishing sign-in lives in it and is meant
 * to last the session and no longer — so nothing is lost by removing it, and a
 * directory per session would otherwise pile up in the system's temporary folder.
 */
function forgetProfile(profile: string): Promise<void> {
  return rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}

function closeByProfile(profile: string): Promise<void> {
  // The profile path is unique to this session, so it names the browser and nothing else.
  return run('pkill', ['-f', `user-data-dir=${profile}`], true);
}

function run(command: string, args: string[], tolerateFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, error => {
      if (error && !tolerateFailure) reject(error);
      else resolve();
    });
  });
}
