// One agent session: the app served from the build we shipped, a browser of our own
// on it, and the version checked before anything is driven.
//
// The session opens on the first tool call rather than at startup, because merely
// having the server configured must not open a browser window on someone's desktop.
// It is one at a time: one browser, one clip, one agent.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { serveApp, type AppServer } from './serve.js';
import { openApp, type BrowserIdentity, type OpenedApp } from './browser.js';
import { downloadsDirectory } from './downloads.js';
import { serverVersion, versionMismatchReason } from './version.js';

export interface Session {
  readonly page: Page;
  readonly origin: string;
  /** The app's version, as the surface reported it. */
  readonly version: string;
  /** Which browser was opened, and whether the system can grant it the screen. */
  readonly browser: BrowserIdentity;
  /** Where an exported file is saved. */
  readonly downloadsDir: string;
  close(): Promise<void>;
}

export interface SessionOptions {
  /** Headless is for the server's own checks; a session for a person is headful. */
  readonly headless?: boolean;
  /** The directory of the app's build to serve; the packaged build by default. */
  readonly appRoot?: string;
  /** Where an exported file is saved; the person's Downloads by default. */
  readonly downloadsDir?: string;
  /** The browser to launch, when the person keeps it somewhere unusual. */
  readonly executablePath?: string;
  /** Extra browser flags, for a check that needs hardware the machine has not got. */
  readonly args?: readonly string[];
}

export async function openSession(options: SessionOptions = {}): Promise<Session> {
  const root = options.appRoot ?? defaultAppRoot();
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(
      `the app's build was not found at ${root} — build it first (\`npm run build\` at the repository root)`,
    );
  }

  const app: AppServer = await serveApp(root);
  let opened: OpenedApp | null = null;
  try {
    opened = await openApp(app.origin, {
      headless: options.headless,
      executablePath: options.executablePath,
      args: options.args,
    });
    const version = await readSurfaceVersion(opened.page);
    const mismatch = versionMismatchReason(version, serverVersion());
    if (mismatch) throw new Error(mismatch);
    const session: Session = {
      page: opened.page,
      origin: app.origin,
      version,
      browser: opened.browser,
      downloadsDir: options.downloadsDir ?? downloadsDirectory(),
      close: async () => {
        await opened?.close().catch(() => {});
        await app.close().catch(() => {});
      },
    };
    return session;
  } catch (error) {
    await opened?.close().catch(() => {});
    await app.close().catch(() => {});
    throw error;
  }
}

/** The version the page's automation surface reports, or a plain error if there is none. */
export async function readSurfaceVersion(page: Page): Promise<string> {
  await page.waitForFunction(
    () => Boolean((globalThis as { democlip?: unknown }).democlip),
    undefined,
    { timeout: 20_000 },
  );
  const version = await page.evaluate(
    () => (globalThis as { democlip?: { version?: string } }).democlip?.version ?? '',
  );
  if (!version) throw new Error('the page was opened without the automation surface');
  return version;
}

/** The build we shipped inside this package, or the one built at the repository root. */
function defaultAppRoot(): string {
  const packaged = fileURLToPath(new URL('../app', import.meta.url));
  if (existsSync(join(packaged, 'index.html'))) return packaged;
  return fileURLToPath(new URL('../../dist', import.meta.url));
}
