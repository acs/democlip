// Taking the exported file — and letting the person open it too.
//
// The app already ends an export in a download: it hands the finished bytes to the
// browser and the browser writes them, so nothing in the app changes. But **how** the
// browser writes them matters to a person. Left alone, Playwright intercepts every
// download and names it by a **GUID with no extension** in a temp `playwright-artifacts-*`
// dir, so the browser's own download list points at a nameless file that will not open
// (and the temp dir goes when the connection does). So the session asks Chrome to write
// its downloads under the name the app gave them, in the person's own directory — the
// file the list holds is then a real, openable one — and the watcher below reads it.
//
// The watcher is installed *before* the export is asked for: a browser download is an
// event, and one that has already fired is not one you can wait for.

import { mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Download, Page } from 'playwright';

export interface SavedDownload {
  readonly path: string;
  readonly bytes: number;
}

export interface DownloadWatcher {
  readonly saved: Promise<readonly SavedDownload[]>;
  /** Nothing is coming: stop waiting. */
  stop(): void;
}

/** Where an exported file goes: the person's Downloads, unless they said otherwise. */
export function downloadsDirectory(): string {
  return process.env.DEMOCLIP_DOWNLOAD_DIR || join(homedir(), 'Downloads');
}

/**
 * Ask the browser to write its downloads with the name the app gave them, in `into`.
 *
 * Left to Playwright, Chrome is set to `allowAndName` — a GUID, no extension, in a temp
 * dir — which is what the person's download list shows, and why clicking one does
 * nothing. `allow` with a `downloadPath` writes each file under its real name where the
 * person can open it, and `eventsEnabled` keeps the download event the watcher needs.
 *
 * Answers whether it took. A browser Playwright cannot reach a CDP session for keeps
 * Playwright's own behaviour, and `watchDownloads` then still copies with `saveAs`.
 */
export async function useRealDownloadNames(page: Page, into: string): Promise<boolean> {
  const browser = page.context().browser();
  if (!browser) return false;
  try {
    const dir = resolve(into);
    await mkdir(dir, { recursive: true });
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: dir,
      eventsEnabled: true,
    });
    return true;
  } catch {
    return false;
  }
}

export interface WatchOptions {
  /** True when the browser writes files under their real names; see `useRealDownloadNames`. */
  readonly named?: boolean;
  readonly timeoutMs?: number;
}

/**
 * Take the next `count` downloads the browser makes, and say where they were saved.
 *
 * One for a file to watch; two for a clip that leaves with its annotations written beside
 * it. **The order is the browser's business** — two downloads are two events, and they do
 * not necessarily arrive in the order the page wrote them — so a caller with two must tell
 * them apart by their names rather than by where they sit in this list. The watcher goes up
 * *before* the export is asked for: a browser download is an event, and one that has already
 * fired is not one you can wait for.
 *
 * With `named` (the browser writes its own, real-named files) each download's file is read
 * where the browser wrote it; without it the file is copied out of Playwright's artifacts
 * with `saveAs`, which is all Playwright offers when it owns the naming.
 */
export function watchDownloads(
  page: Page,
  into: string,
  count = 1,
  options: WatchOptions = {},
): DownloadWatcher {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const named = options.named === true;
  const files: SavedDownload[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: ((download: Download) => void) | undefined;
  let detach = (): void => {};

  const saved = new Promise<readonly SavedDownload[]>((resolve, reject) => {
    detach = () => {
      if (timer) clearTimeout(timer);
      if (listener) page.off('download', listener);
    };
    listener = (download: Download) => {
      void save(download, into, named).then(
        file => {
          files.push(file);
          if (files.length >= count) {
            detach();
            resolve(files);
          }
        },
        error => {
          detach();
          reject(error);
        },
      );
    };
    page.on('download', listener);
    timer = setTimeout(() => {
      detach();
      reject(new Error(count === 1
        ? 'the export produced no file'
        : `the export produced ${files.length} of the ${count} files it writes`));
    }, timeoutMs);
  });

  return { saved, stop: () => detach() };
}

async function save(download: Download, into: string, named: boolean): Promise<SavedDownload> {
  await mkdir(into, { recursive: true });
  const name = download.suggestedFilename() || 'democlip-export';
  if (!named) {
    const path = join(into, name);
    await download.saveAs(path);
    return { path, bytes: (await stat(path)).size };
  }
  // The browser wrote the file itself, under the name the app gave it; wait for it to be
  // whole there rather than copy it out of artifacts that no longer hold it.
  const path = await waitForNamedFile(into, name);
  return { path, bytes: (await stat(path)).size };
}

/**
 * The file the browser wrote for one download, once it is finished.
 *
 * Its name is the one the app gave it, so it is found by looking for it — or, if a file of
 * that name was already there, the ` (1)` Chrome adds. A download in flight is written as
 * `<name>.crdownload` and renamed when it is done, so the plain name is the finished file.
 */
export async function waitForNamedFile(into: string, name: string, timeoutMs = 180_000): Promise<string> {
  const base = name.replace(/\.[^.]*$/, '');
  const ext = name.slice(base.length);
  const mine = (entry: string): boolean =>
    entry === name || (entry.startsWith(`${base} (`) && entry.endsWith(`)${ext}`));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const entries = await readdir(into).catch(() => [] as string[]);
    const found = entries.find(mine);
    if (found) return join(into, found);
    if (Date.now() > deadline) throw new Error(`the download ${name} did not appear in ${into}`);
    await pause(200);
  }
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
