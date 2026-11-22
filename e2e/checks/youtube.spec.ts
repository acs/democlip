// YouTube: the menu entry, the dialog's states, the refusals and the upload.
//
// Google and the destination are stood in by `page.route`, so nothing touches the
// network — as the publishing check already does for its service. What is real is the
// app: the dialog, the flow, the offline encode and the clip's own model. A live Google
// consent and a real upload to a real channel are the user's session, not a check's.

import { expect, test, type Page, type Route } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

interface Asked {
  method: string;
  url: string;
  body?: string;
  /** The request's own bytes, for the chunk the video went in. */
  bytes?: Buffer;
}

interface Refusal {
  status: number;
  reason: string;
}

interface StandIn {
  /** Answer every call after the sign-in with this refusal. */
  refusal?: Refusal;
  /**
   * Refuse the channel read alone. That is what an account the upload scope cannot read
   * looks like, and it must not be mistaken for "this account has no channel".
   */
  channelsRefused?: boolean;
}

/**
 * Stand in for Google: the consent script, the channel, the resumable session, the
 * chunks and the status. Answers with what was asked, so a check can read the request
 * the app made — which is the only way to assert what would have been uploaded.
 */
async function standInGoogle(page: Page, standIn: StandIn = {}): Promise<Asked[]> {
  const asked: Asked[] = [];
  const { refusal, channelsRefused } = standIn;

  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.google = { accounts: { oauth2: { initTokenClient: function (config) {
      return { requestAccessToken: function () { config.callback({ access_token: 'stub-token' }); } };
    } } } };`,
  }));

  await page.route('https://www.googleapis.com/**', (route: Route) => {
    const request = route.request();

    // A cross-origin answer: the browser will only hand the page the headers the
    // response says it may read — `Location`, where the upload goes, and `Range`, how
    // much of it has arrived. Google's own endpoint says both; the stand-in does too,
    // which is what makes this check about the app rather than about CORS.
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-expose-headers': 'location, range',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    asked.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? undefined,
      bytes: request.postDataBuffer() ?? undefined,
    });

    if (request.url().includes('/channels')) {
      if (channelsRefused) {
        return route.fulfill({
          status: 403,
          headers: cors,
          json: { error: { errors: [{ reason: 'insufficientPermissions' }] } },
        });
      }
      return route.fulfill({ headers: cors, json: { items: [{ id: 'UC123', snippet: { title: 'A test channel' } }] } });
    }
    if (refusal) {
      return route.fulfill({
        status: refusal.status,
        headers: cors,
        json: { error: { errors: [{ reason: refusal.reason }] } },
      });
    }
    if (request.method() === 'POST') {
      return route.fulfill({
        status: 200,
        headers: { ...cors, location: 'https://www.googleapis.com/upload/session-1' },
        body: '',
      });
    }
    if (request.method() === 'PUT') {
      return route.fulfill({ status: 201, headers: cors, json: { id: 'vid123' } });
    }
    // Nothing else is expected: the app asks YouTube for the upload and for nothing after
    // it (`research.md` D4). A tripwire, so a read that creeps back in fails loudly.
    return route.fulfill({ status: 500, headers: cors, json: { error: { message: 'the app asked for something it should not' } } });
  });

  return asked;
}

/** Serve the app's own client registration, or an empty one for the not-set-up state. */
async function clientId(page: Page, value: string): Promise<void> {
  await page.route('**/youtube-client.json', route => route.fulfill({ json: { clientId: value } }));
}

/** Seed the clip with one real take whose length is the one written down. */
async function seedWithLength(page: Page, seconds: number): Promise<void> {
  await page.evaluate(async ({ url, seconds }) => {
    const store = (window as unknown as { __e2eTakes?: Array<{ blob: Blob }> }).__e2eTakes ?? [];
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.clear();
    const take = store[0];
    if (take) session.clip.addTake(take.blob, seconds);
  }, { url: HOOKS, seconds });
}

/** A clip in the review, of the given length, with a real decodable take. */
async function review(page: Page, seconds = 1) {
  const app = boot(page);
  await app.goto();
  await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await seedWithLength(page, seconds);
  await app.review();
  return app;
}

async function openYouTube(page: Page): Promise<void> {
  await page.locator('#btn-exp').click();
  await page.locator('#exp-youtube').click();
  await expect(page.locator('#yt-bd')).toBeVisible();
}

/** Whether this browser can write MP4 at all; the upload needs it, the refusals do not. */
async function canEncodeMp4(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (typeof VideoEncoder !== 'function') return false;
    const result = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 640, height: 360, bitrate: 4_000_000 });
    return !!result.supported;
  });
}

test('the Export menu offers YouTube beside the files and the other service', async ({ page }) => {
  await review(page);
  await page.locator('#btn-exp').click();
  await expect(page.locator('#exp-youtube')).toBeVisible();
  await expect(page.locator('#exp-youtube')).toContainText('YouTube');
  // Every other way out is still there, unchanged.
  for (const id of ['#exp-webm', '#exp-mp4', '#exp-editing', '#exp-bluesky']) {
    await expect(page.locator(id)).toBeVisible();
  }
});

test('with no client ID, the app says it is not set up and sends nothing', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, '');

  await review(page);
  await openYouTube(page);

  await expect(page.locator('#yt-note')).toContainText('not set up to upload');
  await expect(page.locator('#yt-signin')).toBeHidden();
  expect(asked).toHaveLength(0);
});

test('signed out, the dialog offers the Google sign-in', async ({ page }) => {
  await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);

  await expect(page.locator('#yt-signin')).toBeVisible();
  await expect(page.locator('#yt-compose-view')).toBeHidden();
});

test('signing in shows whose channel it will go to, and starts on private', async ({ page }) => {
  await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();

  await expect(page.locator('#yt-as')).toContainText('A test channel');
  await expect(page.locator('#yt-visibility')).toHaveValue('private');
  await expect(page.locator('#yt-title')).toBeVisible();
  await expect(page.locator('#yt-description')).toBeVisible();
});

test('a clip past the account\u2019s ceiling is refused before anything is uploaded', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  // Sixteen minutes, which a default account may not upload. The refusal is the
  // model's, so nothing is encoded — and the take is a real one, only its written
  // length is longer.
  await review(page, 16 * 60);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');
  await page.locator('#yt-go').click();

  await expect(page.locator('#yt-error')).toContainText('15 minutes');
  // The sign-in's channel read is the only thing that reached Google.
  expect(asked.every(call => call.url.includes('/channels'))).toBe(true);
  // And the dialog is still usable: try again, or close it.
  await expect(page.locator('#yt-go')).toBeEnabled();
});

test('an upload the destination refuses says why, and leaves the dialog usable', async ({ page }) => {
  await standInGoogle(page, { refusal: { status: 403, reason: 'quotaExceeded' } });
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');

  const supported = await canEncodeMp4(page);
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-error')).toContainText('allowance for this app is used up');
  await expect(page.locator('#yt-go')).toBeEnabled();
});

/** Publish through the app's automation surface, as the MCP server does. */
async function publishThroughSurface(page: Page, options: Record<string, unknown>): Promise<{ ok: boolean; reason?: string; url?: string }> {
  return page.evaluate(async opts => {
    const surface = (window as unknown as { democlip?: { out: { publish: (o: unknown) => Promise<unknown> } } }).democlip;
    if (!surface) throw new Error('the page has no automation surface');
    return await surface.out.publish(opts) as { ok: boolean; reason?: string; url?: string };
  }, options);
}

test('a YouTube publish through the surface is refused with nobody signed in', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', request => { if (request.url().startsWith('https://www.googleapis.com/')) asked.push(request.url()); });

  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  // A destination is one operation's second place to go, so the refusal is a result an
  // agent can read — and nothing is sent.
  const refused = await publishThroughSurface(page, { destination: 'youtube' });
  expect(refused.ok).toBe(false);
  expect(refused.reason).toMatch(/nobody is signed in to upload to YouTube/);

  const unknown = await publishThroughSurface(page, { destination: 'peertube' });
  expect(unknown.ok).toBe(false);
  expect(unknown.reason).toMatch(/bluesky or youtube/);

  expect(asked).toHaveLength(0);
});

test('a channel YouTube will not name does not stop the upload', async ({ page }) => {
  // Reading the account's channel is not what the upload scope authorizes, so it can be
  // refused — and an account with no channel answers with nothing at all. Neither is the
  // app's to translate into "you have no channel": the person is signed in, so the compose
  // view opens and the upload is theirs to try, with the destination as the authority on
  // whether the account may upload at all.
  await standInGoogle(page, { channelsRefused: true });
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();

  await expect(page.locator('#yt-compose-view')).toBeVisible();
  await expect(page.locator('#yt-go')).toBeEnabled();
  await expect(page.locator('#yt-as')).toContainText('Signed in with Google');
});

test('an account with no YouTube channel is told so by the destination', async ({ page }) => {
  await standInGoogle(page, {
    channelsRefused: true,
    refusal: { status: 401, reason: 'youtubeSignupRequired' },
  });
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-compose-view')).toBeVisible();

  const supported = await canEncodeMp4(page);
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-error')).toContainText('no YouTube channel yet');
  await expect(page.locator('#yt-go')).toBeEnabled();
});

test('uploading writes the video, sends the details, and answers with the link', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  const app = await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');

  const supported = await canEncodeMp4(page);
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  await page.locator('#yt-title').fill('A demo');
  await page.locator('#yt-visibility').selectOption('unlisted');
  await page.locator('#yt-go').click();

  // The video's own address, as a link a person can open.
  await expect(page.locator('#yt-status a')).toHaveAttribute('href', 'https://youtu.be/vid123');
  // And only two calls: the session, and the chunk the bytes went in. The app reads nothing
  // back — the scope it asks for does not allow it, and the update says so in words instead.
  const upload = asked.filter(call => !call.url.includes('/channels'));
  expect(upload.map(call => call.method)).toEqual(['POST', 'PUT']);
  // And the details went with it: the visibility is always sent, explicitly.
  const session = asked.find(call => call.method === 'POST' && call.body);
  expect(JSON.parse(session?.body ?? '{}')).toMatchObject({
    snippet: { title: 'A demo' },
    status: { privacyStatus: 'unlisted' },
  });
  // A clip that is up is spent: a second upload of it is not offered.
  await expect(page.locator('#yt-go')).toBeDisabled();

  // The kept copy went with it, so a reload does not bring the clip back.
  await page.reload();
  await expect.poll(async () => app.clipLength()).toBe(0);
});

/** Decode an uploaded video's bytes in the page and read its duration. */
async function durationOf(page: Page, bytes: Buffer, mime: string): Promise<number> {
  return page.evaluate(async ({ base64, type }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(new Blob([data], { type }));
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const seconds = video.duration;
    URL.revokeObjectURL(url);
    return seconds;
  }, { base64: bytes.toString('base64'), type: mime });
}

// A published video is an exported video, so it opens with the card too when the clip
// asks for one. The bytes that went up are decoded and their duration read, the same way
// a download's would be.
test('publishing with the card on uploads a video that opens with it', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');

  const supported = await canEncodeMp4(page);
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  // The clip's words, and the card on — through the app's own model.
  await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('title', 'A short demo');
    session.clip.setProperty('description', 'What the clip shows');
    session.clip.setProperty('addToExport', 'true');
  }, HOOKS);

  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-status a')).toHaveAttribute('href', 'https://youtu.be/vid123');

  const chunk = asked.find(call => call.method === 'PUT' && (call.bytes?.length ?? 0) > 0);
  expect(chunk?.bytes).toBeTruthy();
  const duration = await durationOf(page, chunk!.bytes!, 'video/mp4');
  // One second of clip and two of card: about 2.95s.
  expect(duration).toBeGreaterThan(2.4);
  expect(duration).toBeLessThan(4);
});
