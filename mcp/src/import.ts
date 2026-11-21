// The one file the server hands over.
//
// A page cannot read the machine's disk: the only way a file gets into DemoClip is the
// app's own Import, which in a browser means a file arriving at the app's file input.
// So this delivery is that input, filled the way a picker fills it. No file passes
// through the protocol — the browser reads the path itself, as it does for a hand — so
// handing over a clip costs nothing whatever its size.
//
// It is the second place the server touches the page rather than the surface, and for
// the same reason as the first: the browser's own doors. The screen picker needs a
// hand's activation; a file needs the file input. Everything the import *decides* stays
// in the app — which files it takes, how long the take is, whether it has sound, and the
// review it opens on — and the server reads no file at all.

import { existsSync } from 'node:fs';
import type { Session } from './session.js';
import { callSurface } from './surface.js';

/** The app's own file input, by the id its markup gives it. */
export const FILE_INPUT = '#file-input';
/** The app's own Import button: held out of action while a take is in flight. */
const IMPORT_BUTTON = '#file-btn';
/** What the app last said to the person out loud — where a refusal of its own lands. */
const APP_WORDS = '#toast';

export interface Imported {
  readonly ok: boolean;
  readonly take?: { readonly index: number; readonly seconds: number };
  readonly reason?: string;
}

/** How long the app is given to read the file and append the take. */
const TAKEN_MS = 15_000;
const POLL_MS = 100;

/**
 * Hand a file to the app's own Import and answer with what the app made of it.
 *
 * The path is named by the caller and read by the **browser**; the server opens nothing.
 * The app appends a take when it takes the file, and says why in its own words when it
 * does not — those words are handed back, so the chat and the window cannot disagree
 * about a refusal.
 */
export async function importTakeFile(session: Session, path: string): Promise<Imported> {
  const wanted = path.trim();
  if (!wanted) return { ok: false, reason: 'a file to import is needed, as a path' };

  const input = session.page.locator(FILE_INPUT);
  if (await input.count() === 0) {
    return { ok: false, reason: 'this build of the app has no file input, so there is nothing to import into' };
  }
  // The app holds its own Import out of the way while a take is being set up or runs,
  // and its flow drops a file that arrives then. Say so, rather than filling an input
  // the app will ignore and waiting for a take that is not coming.
  const button = session.page.locator(IMPORT_BUTTON);
  if (await button.count() > 0 && await button.isDisabled()) {
    return { ok: false, reason: 'a take is in flight — the app imports between takes, not during one' };
  }

  const before = await takesOf(session);
  const saidBefore = await theAppsWords(session);
  // The annotations a clip left with are written beside the video, so the two are handed
  // over together and the app sorts out which is which.
  const sidecar = sidecarNameFor(wanted);
  try {
    await input.setInputFiles(existsSync(sidecar) ? [wanted, sidecar] : [wanted], { timeout: 10_000 });
  } catch (error) {
    return { ok: false, reason: `the file could not be opened: ${message(error)}` };
  }

  // The app's own flow takes it from here: it reads the container, appends the take and
  // opens the review.
  const until = Date.now() + TAKEN_MS;
  for (;;) {
    const now = await takesOf(session);
    if (now > before) {
      const described = await callSurface<{ takes: Array<{ index: number; seconds: number }> }>(
        session, 'describe',
      );
      return { ok: true, take: described.takes[now - 1] };
    }
    const said = await theAppsWords(session);
    if (said && said !== saidBefore) return { ok: false, reason: said };
    if (Date.now() >= until) return { ok: false, reason: 'the app did not take the file' };
    await pause(POLL_MS);
  }
}

async function takesOf(session: Session): Promise<number> {
  const described = await callSurface<{ takes: unknown[] }>(session, 'describe');
  return described.takes.length;
}

/** What the app last said to the person. Its refusals are toasts, in its own words. */
async function theAppsWords(session: Session): Promise<string> {
  try {
    return ((await session.page.locator(APP_WORDS).textContent()) ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * The name a sidecar has: the video's own name, its extension replaced by `.democlip.json`
 * — `democlip-1755021992.webm` beside `democlip-1755021992.democlip.json`.
 *
 * The **app** writes it under that name (`src/infra/annotation-sidecar.ts`) and this reads
 * it, so the one thing the two halves of a release have to agree on is this line. The round
 * trip in `integration.test.ts` is what notices if they stop agreeing.
 */
function sidecarNameFor(video: string): string {
  const dot = video.lastIndexOf('.');
  return `${dot > 0 ? video.slice(0, dot) : video}.democlip.json`;
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
