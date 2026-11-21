// Taking the exported file.
//
// The app already ends an export in a download — it hands the finished bytes to the
// browser and the browser writes them — so nothing in the app changes. The server
// takes that download, byte for byte, and saves it where the person can find it. The
// alternative, reading the blob out of the page, would copy a large file through the
// protocol for no reason.
//
// The watcher is installed *before* the export is asked for: a browser download is an
// event, and one that has already fired is not one you can wait for.

import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
 * Take the next `count` downloads the browser makes, and say where they were saved.
 *
 * One for a file to watch; two for a clip that leaves with its annotations written beside
 * it — the video first, its sidecar second. The watcher goes up *before* the export is
 * asked for: a browser download is an event, and one that has already fired is not one you
 * can wait for.
 */
export function watchDownloads(page: Page, into: string, count = 1, timeoutMs = 180_000): DownloadWatcher {
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
      void save(download, into).then(
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

async function save(download: Download, into: string): Promise<SavedDownload> {
  await mkdir(into, { recursive: true });
  const name = download.suggestedFilename() || 'democlip-export';
  const path = join(into, name);
  await download.saveAs(path);
  return { path, bytes: (await stat(path)).size };
}
