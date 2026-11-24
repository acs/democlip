// Publishing: the dialogs beside the files — Bluesky and YouTube.
//
// The destinations are stood in by `page.route`, so nothing touches the network. What is
// real is the app: the dialogs, the flow, the offline encode and the clip's own model. A
// live Google consent, a real Bluesky round-trip and an upload to a real channel are the
// user's session, not a check's.

import { expect, test, type Page, type Route } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';
import { probeFile } from '../helpers/exports.js';

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
      window.__youtubeTokenConfig = config;
      return { requestAccessToken: function () { config.callback({ access_token: 'stub-token' }); } };
    } } } };`,
  }));

  await page.route('https://www.googleapis.com/**', (route: Route) => {
    const request = route.request();

    // A cross-origin answer: the browser will only hand the page the headers the
    // response says it may read — `Location`, where the upload goes, and `Range`, how
    // much of it has arrived. Google's own endpoint says both; the stand-in does too.
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
      return route.fulfill({ status: refusal.status, headers: cors, json: { error: { errors: [{ reason: refusal.reason }] } } });
    }
    if (request.method() === 'POST') {
      return route.fulfill({ status: 200, headers: { ...cors, location: 'https://www.googleapis.com/upload/session-1' }, body: '' });
    }
    if (request.method() === 'PUT') {
      return route.fulfill({ status: 201, headers: cors, json: { id: 'vid123' } });
    }
    // Nothing else is expected: the app asks YouTube for the upload and for nothing after it.
    // A tripwire, so a read that creeps back in fails loudly.
    return route.fulfill({ status: 500, headers: cors, json: { error: { message: 'the app asked for something it should not' } } });
  });

  return asked;
}

/** Serve the app's own YouTube client registration. */
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
    // The take carries its own picture, as a recorded one does: a take with no measured
    // picture is a sound-only take, and a video service takes a video.
    if (take) session.clip.addTake(take.blob, seconds, { width: 640, height: 360 });
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

/** Publish through the app's automation surface, as the MCP server does. */
async function publishThroughSurface(page: Page, options: Record<string, unknown>): Promise<{ ok: boolean; reason?: string; url?: string }> {
  return page.evaluate(async opts => {
    const surface = (window as unknown as { democlip?: { out: { publish: (o: unknown) => Promise<unknown> } } }).democlip;
    if (!surface) throw new Error('the page has no automation surface');
    return await surface.out.publish(opts) as { ok: boolean; reason?: string; url?: string };
  }, options);
}

// ── Every way out, and a dialog that says what is missing ────────────────────────────

test('the Export menu offers every way out, and a publish dialog says what is missing', async ({ page }) => {
  // Nothing reaches the publishing service: it is only contacted on a sign-in, and this
  // check never signs in.
  const toTheService: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return;   // the app's own modules are not the service
    if (/bluesky|bsky|atproto/i.test(url)) toTheService.push(url);
  });
  const asked = await standInGoogle(page);
  let client = '';
  await page.route('**/youtube-client.json', route => route.fulfill({ json: { clientId: client } }));

  await review(page);
  await page.locator('#btn-exp').click();
  // Every way out is offered, each file and each service.
  for (const id of ['#exp-webm', '#exp-mp4', '#exp-editing', '#exp-bluesky', '#exp-youtube']) {
    await expect(page.locator(id)).toBeVisible();
  }
  await expect(page.locator('#exp-youtube')).toContainText('YouTube');

  // With no client ID, the app says it is not set up and offers no sign-in.
  await page.locator('#exp-youtube').click();
  await expect(page.locator('#yt-note')).toContainText('not set up to upload');
  await expect(page.locator('#yt-signin')).toBeHidden();
  await page.locator('#yt-close').click();

  // The Bluesky dialog opens on its sign-in, with no live round-trip; signing in with
  // nothing typed says what is missing, and goes nowhere.
  await page.locator('#btn-exp').click();
  await page.locator('#exp-bluesky').click();
  await expect(page.locator('#pub-bd')).toBeVisible();
  await expect(page.locator('#pub-signin-view')).toBeVisible();
  await expect(page.locator('#pub-handle')).toBeVisible();
  await page.locator('#pub-signin').click();
  await expect(page.locator('#pub-error')).toContainText('Enter your Bluesky handle');
  await page.locator('#pub-close').click();

  // Nothing was sent to the publishing service, and nothing to Google.
  expect(asked).toHaveLength(0);
  expect(toTheService).toEqual([]);

  // A client ID, and nobody signed in: the dialog offers the Google sign-in, and the
  // compose view is not there yet.
  client = 'stub.apps.googleusercontent.com';
  await review(page);
  await openYouTube(page);
  await expect(page.locator('#yt-signin')).toBeVisible();
  await expect(page.locator('#yt-compose-view')).toBeHidden();
});

// ── Whose channel, and what the destination refuses ──────────────────────────────────

test('signing in shows whose channel it will go to, and what the destination refuses', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  // Signing in names the channel it will go to, and starts on private.
  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');
  // The app asks Google for its account and channel chooser — where the channel is picked — so a
  // returning visitor is not silently kept on the one they last consented with.
  expect(await page.evaluate(() =>
    (window as unknown as { __youtubeTokenConfig?: { prompt?: string } }).__youtubeTokenConfig?.prompt,
  )).toBe('select_account');
  await expect(page.locator('#yt-visibility')).toHaveValue('private');
  await expect(page.locator('#yt-title')).toBeVisible();
  await expect(page.locator('#yt-description')).toBeVisible();

  // A clip past the account's ceiling is refused before anything is encoded or uploaded.
  // Sixteen minutes, which a default account may not upload: the refusal is the model's.
  await review(page, 16 * 60);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');
  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-error')).toContainText('15 minutes');
  expect(asked.every(call => call.url.includes('/channels'))).toBe(true);   // the sign-in read, only
  await expect(page.locator('#yt-go')).toBeEnabled();                        // still usable

  // An upload the destination itself refuses says why, and leaves the dialog usable.
  await standInGoogle(page, { refusal: { status: 403, reason: 'quotaExceeded' } });
  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');
  test.skip(!(await canEncodeMp4(page)), 'this browser cannot encode MP4 (AVC) offline');
  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-error')).toContainText('allowance for this app is used up');
  await expect(page.locator('#yt-go')).toBeEnabled();
});

// ── A channel that cannot be named, and a publish with nobody signed in ──────────────

test('a channel YouTube will not name does not stop the upload, and nothing is sent unsigned', async ({ page }) => {
  // Reading the account's channel is not what the upload scope authorizes, so it can be
  // refused: the person is signed in, so the compose view opens and the upload is theirs
  // to try, with the destination as the authority on whether the account may upload.
  await standInGoogle(page, { channelsRefused: true });
  await clientId(page, 'stub.apps.googleusercontent.com');

  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-compose-view')).toBeVisible();
  await expect(page.locator('#yt-go')).toBeEnabled();
  await expect(page.locator('#yt-as')).toContainText('Signed in with Google');

  // An account with no channel is told so by the destination, not guessed at.
  await standInGoogle(page, { channelsRefused: true, refusal: { status: 401, reason: 'youtubeSignupRequired' } });
  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-compose-view')).toBeVisible();
  test.skip(!(await canEncodeMp4(page)), 'this browser cannot encode MP4 (AVC) offline');
  await page.locator('#yt-go').click();
  await expect(page.locator('#yt-error')).toContainText('no YouTube channel yet');
  await expect(page.locator('#yt-go')).toBeEnabled();

  // A destination is one operation's second place to go, so a publish with nobody signed
  // in is a result an agent can read — and nothing is sent.
  const toGoogle: string[] = [];
  page.on('request', request => { if (request.url().startsWith('https://www.googleapis.com/')) toGoogle.push(request.url()); });
  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();
  const refused = await publishThroughSurface(page, { destination: 'youtube' });
  expect(refused.ok).toBe(false);
  expect(refused.reason).toMatch(/nobody is signed in to upload to YouTube/);
  const unknown = await publishThroughSurface(page, { destination: 'peertube' });
  expect(unknown.ok).toBe(false);
  expect(unknown.reason).toMatch(/bluesky or youtube/);
  expect(toGoogle).toHaveLength(0);
});

// ── The upload itself ────────────────────────────────────────────────────────────────

test('uploading writes the video, sends the details, and answers with the link', async ({ page }) => {
  const asked = await standInGoogle(page);
  await clientId(page, 'stub.apps.googleusercontent.com');

  const app = await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');

  test.skip(!(await canEncodeMp4(page)), 'this browser cannot encode MP4 (AVC) offline');

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

  // A published video is an exported video, so it opens with the card too when the clip asks
  // for one: the bytes that went up are decoded and their duration read, as a download's would.
  asked.length = 0;
  await review(page);
  await openYouTube(page);
  await page.locator('#yt-signin').click();
  await expect(page.locator('#yt-as')).toContainText('A test channel');
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
  // One second of clip and two of card: about 2.95s.
  const duration = (await probeFile(page, chunk!.bytes!, 'video/mp4')).duration;
  expect(duration).toBeGreaterThan(2.4);
  expect(duration).toBeLessThan(4);
});
