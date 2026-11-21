// The YouTube client: the Google sign-in, the resumable upload, and the status poll.
//
// The app is a browser with no server, which is what Google's **token model** is for:
// `google.accounts.oauth2` opens a consent dialog from the person's own press and hands
// the page an access token. There is no authorization code to exchange, no secret
// anywhere, and **no refresh token** — so the token lives in memory for the page and is
// never written down, and the clip does not have to be kept against a trip away the way
// a Bluesky sign-in needs.
//
// The video is uploaded as a **resumable session**: a POST answers with the session URI
// in its `Location` header, and the bytes go to it in chunks, resumed from the range the
// service reports when one is interrupted. That is what makes a progress line and an
// interrupted upload honest rather than optimistic.
//
// The client ID is a deploy-time fact, served beside the app (`youtube-client.json`): it
// is public, not a secret, and a fork sets its own. Without it the app says it is not set
// up rather than offering a sign-in that cannot work.
//
// The half that only needs a token and `fetch` (`HttpYouTubeService`) is written so it
// can be tested in node with both injected; the half that needs the browser — the
// script, the consent, the channel — cannot be, and the end-to-end suite stands it in.

import type {
  UploadProgress, UploadedVideo, VideoStatus, YouTubeService,
} from '../application/youtube-service.js';
import type { UploadableVideo } from '../domain/youtube/UploadableVideo.js';
import type { VideoDetails } from '../domain/youtube/VideoDetails.js';

const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/youtube/v3/videos';
const DATA_ENDPOINT = 'https://www.googleapis.com/youtube/v3';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
/** Upload only: nothing else of the account is asked for. */
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const CLIENT_FILE = 'youtube-client.json';
/**
 * The chunk the bytes are sent in. The resumable protocol requires a multiple of
 * 256 KB, and a larger chunk is more efficient; the last chunk may be shorter.
 */
const CHUNK_BYTES = 8 * 256 * 1024;
/** How many times a chunk that never arrived is tried again before the upload fails. */
const MAX_RETRIES = 4;

/** What the service needs of the sign-in: a bearer token, or a reason it cannot be had. */
export interface YouTubeAuth {
  token(): Promise<string>;
}

/** The channel a clip will go to, which the app shows before anything is sent. */
export interface YouTubeChannel {
  readonly id: string;
  readonly title: string;
}

// ── The service ──────────────────────────────────────────────────────────────

export class HttpYouTubeService implements YouTubeService {
  private readonly fetchFn: typeof fetch;
  private readonly chunkBytes: number;

  constructor(
    private readonly auth: YouTubeAuth,
    fetchFn: typeof fetch = globalThis.fetch,
    chunkBytes = CHUNK_BYTES,
  ) {
    // Bound to the global: a bare `fetch` refuses any receiver but a Window, and
    // calling it with the service as its receiver is the bug the Bluesky client hit.
    this.fetchFn = fetchFn.bind(globalThis);
    this.chunkBytes = chunkBytes;
  }

  async uploadVideo(video: UploadableVideo, details: VideoDetails, progress: UploadProgress): Promise<UploadedVideo> {
    const token = await this.auth.token();
    const session = await this.startSession(video, details, token);
    const total = video.blob.size;
    let sent = 0;
    let stalls = 0;

    progress(0);
    for (;;) {
      if (sent >= total) {
        // The service says it has everything but has not handed back the video: ask once
        // more, which is the same request that reads where an upload has got to.
        const where = await this.whereUploadIs(session, token, total);
        if (where.done) { progress(1); return where.done; }
        throw new Error('YouTube did not finish the upload — try again');
      }

      const end = Math.min(sent + this.chunkBytes, total);
      let response: Response;
      try {
        response = await this.fetchFn(session, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': video.blob.type,
            'content-range': `bytes ${sent}-${end - 1}/${total}`,
          },
          body: video.blob.slice(sent, end),
        });
      } catch {
        // The chunk never arrived. Ask how much YouTube has and go on from there, so a
        // broken connection costs the rest of the transfer rather than all of it.
        if (++stalls > MAX_RETRIES) throw new Error('the upload was interrupted — try again');
        const where = await this.whereUploadIs(session, token, total);
        if (where.done) { progress(1); return where.done; }
        if (where.sent > sent) { stalls = 0; sent = where.sent; }
        continue;
      }

      if (response.status === 201 || response.status === 200) {
        const id = await idOf(response);
        progress(1);
        return { id };
      }
      if (response.status === 404) {
        throw new Error('the upload session had expired — start the upload again');
      }
      if (response.status === 308) {
        // `Resume Incomplete`: the range says how much it has. A chunk it took but did
        // not count is not progress, and a loop that never advances must end somewhere.
        const at = bytesReceived(response) ?? end;
        if (at > sent) {
          stalls = 0;
          sent = at;
          progress(Math.min(1, sent / total));
        } else if (++stalls > MAX_RETRIES) {
          throw new Error('the upload was interrupted — try again');
        }
        continue;
      }
      throw new Error(await reasonFor(response, 'YouTube refused the upload'));
    }
  }

  async videoStatus(videoId: string): Promise<VideoStatus> {
    const token = await this.auth.token();
    const url = new URL(`${DATA_ENDPOINT}/videos`);
    url.searchParams.set('part', 'status,processingDetails');
    url.searchParams.set('id', videoId);
    const response = await this.fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(await reasonFor(response, 'YouTube would not say how the video is doing'));
    }
    const item = (await readJson<VideosList>(response))?.items?.[0];
    if (!item) return { state: 'failed', reason: 'YouTube does not have that video' };
    return statusOf(item);
  }

  /** Open a resumable session and answer with where the bytes go. */
  private async startSession(video: UploadableVideo, details: VideoDetails, token: string): Promise<string> {
    const url = new URL(UPLOAD_ENDPOINT);
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('part', 'snippet,status');
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-length': String(video.blob.size),
        'x-upload-content-type': video.blob.type,
      },
      body: JSON.stringify(details.record()),
    });
    if (!response.ok) throw new Error(await reasonFor(response, 'YouTube would not start the upload'));
    const session = response.headers.get('location');
    if (!session) {
      throw new Error('YouTube did not say where to send the video — this browser may not read that answer');
    }
    return session;
  }

  /**
   * How much of the video YouTube already has, and — when the upload turns out to be
   * complete — the video itself. The same empty PUT that reads the range is what asks
   * for the finished resource, so one request answers both questions.
   */
  private async whereUploadIs(session: string, token: string, total: number): Promise<{ sent: number; done: UploadedVideo | null }> {
    const response = await this.fetchFn(session, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-range': `bytes */${total}` },
    });
    if (response.status === 200 || response.status === 201) {
      return { sent: total, done: { id: await idOf(response) } };
    }
    return { sent: bytesReceived(response) ?? 0, done: null };
  }
}

// ── The sign-in, and the module's own state ──────────────────────────────────
//
// The token lasts the page, as the Bluesky client's session does, and for the same
// reason: signing in is the person's and should not have to be done twice. It is
// memory only — nothing about the account is written down.

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(): void;
}

interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }): TokenClient;
    };
  };
}

declare const google: GoogleAccounts;

let clientIdPromise: Promise<string | null> | null = null;
let token: string | null = null;
let channel: YouTubeChannel | null = null;

/** Whether this build can upload at all: it needs the app's own client ID. */
export async function configured(): Promise<boolean> {
  return (await clientId()) !== null;
}

/**
 * Ask Google for a token. The token model requires the person's own press, so this is
 * called from one — the dialog's **Sign in** — and it never returns until consent is
 * given or refused.
 */
export async function signIn(): Promise<void> {
  const id = await clientId();
  if (!id) throw new Error('this build is not set up to upload to YouTube');
  await loadGoogle();
  token = await requestToken(id);
  channel = null;
}

export async function signOut(): Promise<void> {
  token = null;
  channel = null;
}

/**
 * The channel a clip will go to, read once per sign-in. `null` when nobody is signed
 * in, and also when the account has no channel — which the dialog says rather than
 * letting an upload fail.
 */
export async function youTubeChannel(): Promise<YouTubeChannel | null> {
  if (!token) return null;
  channel ??= await readChannel(token);
  return channel;
}

/** The service the publish use case wants, once there is a token. */
export async function youtubeService(): Promise<YouTubeService> {
  if (!token) throw new Error('nobody is signed in to upload to YouTube');
  return new HttpYouTubeService({ token: async () => currentToken() });
}

function currentToken(): string {
  if (!token) throw new Error('the Google sign-in has expired — sign in again');
  return token;
}

/** The app's own client ID, served beside it. Null when this build has none. */
function clientId(): Promise<string | null> {
  clientIdPromise ??= fetch(new URL(CLIENT_FILE, document.baseURI))
    .then(response => (response.ok ? response.json() as Promise<{ clientId?: string }> : null))
    .then(body => body?.clientId?.trim() || null)
    .catch(() => null);
  return clientIdPromise;
}

function loadGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined') return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-youtube-signin]');
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Google’s sign-in could not be loaded')), { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.dataset.youtubeSignin = '1';
      document.head.append(script);
    }
  });
}

function requestToken(id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: response => {
        if (response?.access_token) resolve(response.access_token);
        else reject(new Error(signInProblem(response)));
      },
    });
    client.requestAccessToken();
  });
}

/** Why a sign-in that came back empty did so, in the words a person needs. */
function signInProblem(response: TokenResponse | undefined): string {
  if (response?.error === 'access_denied') {
    return 'this Google account is not one this app is set up for';
  }
  return response?.error_description || response?.error || 'Google did not complete the sign-in';
}

async function readChannel(bearer: string): Promise<YouTubeChannel | null> {
  const url = new URL(`${DATA_ENDPOINT}/channels`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');
  const response = await fetch(url, { headers: { authorization: `Bearer ${bearer}` } });
  if (!response.ok) return null;
  const item = (await readJson<{ items?: Array<{ id?: string; snippet?: { title?: string } }> }>(response))?.items?.[0];
  if (!item?.id) return null;
  return { id: item.id, title: item.snippet?.title ?? item.id };
}

// ── The destination's own shapes ─────────────────────────────────────────────

interface ResourceError {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

interface VideosList {
  items?: Array<{
    status?: { uploadStatus?: string };
    processingDetails?: {
      processingStatus?: string;
      processingFailureReason?: string;
      processingProgress?: { partsProcessed?: number; partsTotal?: number };
    };
  }>;
}

/**
 * `Range: bytes=0-999` — the bytes YouTube has, indexed from zero. The next byte is one
 * past the last one it names. No header means nothing has arrived.
 */
function bytesReceived(response: Response): number | null {
  const last = response.headers.get('range')?.match(/bytes=0-(\d+)/)?.[1];
  return last === undefined ? null : Number(last) + 1;
}

async function idOf(response: Response): Promise<string> {
  const body = await readJson<{ id?: string }>(response);
  if (!body?.id) throw new Error('YouTube did not say which video it made');
  return body.id;
}

/**
 * Where YouTube has got to. The video's own readiness is the answer — `processed`, or a
 * processing status of `succeeded` — because an upload finishing is not a video being
 * ready: the service transcodes afterwards.
 */
function statusOf(item: NonNullable<VideosList['items']>[number]): VideoStatus {
  const upload = item.status?.uploadStatus;
  const processing = item.processingDetails;
  const state = processing?.processingStatus;

  if (upload === 'failed' || upload === 'rejected' || state === 'failed' || state === 'terminated') {
    return {
      state: 'failed',
      reason: processing?.processingFailureReason || upload || 'it did not say why',
    };
  }
  if (upload === 'processed' || state === 'succeeded') return { state: 'ready' };

  const progress = processing?.processingProgress;
  const percent = progress?.partsTotal
    ? Math.round(((progress.partsProcessed ?? 0) / progress.partsTotal) * 100)
    : undefined;
  return { state: 'processing', progress: percent };
}

/**
 * What the destination said, as a sentence. The reasons that need an action of their
 * own get one; anything else is passed on with the fallback in front of it.
 */
async function reasonFor(response: Response, fallback: string): Promise<string> {
  const body = await readJson<ResourceError>(response);
  const detail = body?.error?.errors?.[0]?.reason;

  switch (detail) {
    case 'quotaExceeded':
    case 'uploadLimitExceeded':
      return 'the upload allowance for this app is used up — try again later';
    case 'invalidTitle':
      return 'YouTube did not take the video’s title';
    case 'invalidDescription':
      return 'YouTube did not take the video’s description';
    case 'forbiddenPrivacySetting':
      return 'YouTube did not take that visibility';
    case 'authError':
    case 'invalidCredentials':
      return 'the Google sign-in has expired — sign in again';
    default:
      break;
  }
  if (response.status === 401) return 'the Google sign-in has expired — sign in again';

  const said = body?.error?.message || detail;
  return said ? `${fallback}: ${said}` : `${fallback}: ${response.status}`;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}
