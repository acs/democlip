// The publish flow: the Bluesky button, the sign-in and the encode.
//
// The rules live in the publish use case; this module sequences the browser work
// and reports progress. The Bluesky client is loaded only when it is needed.

import { session } from '../../session.js';
import { publishToBluesky, type PublicationProgress } from '../../application/publish-to-bluesky.js';
import { encoder } from '../../infra/offline-encoder.js';
import { frameRenderer } from '../exporting/frame-renderer.js';
import { introFor } from '../exporting/intro.js';
import { keep } from '../keeping/keep.js';
import { el } from '../dom.js';
import { AspectRatio } from '../../domain/bluesky/AspectRatio.js';
import { postUrl } from '../../domain/bluesky/BlueskyPost.js';
import { VIDEO_MAX_BYTES } from '../../domain/bluesky/PublishableVideo.js';
import { FADE_S } from '../clip/fade.js';

export type PublishProgress = PublicationProgress;

export interface PublishedPost {
  uri: string;
  url: string;
}

export interface BlueskyAccount {
  did: string;
  handle: string | null;
}

export interface PublishHandlers {
  onProgress?: (progress: PublishProgress) => void;
  onDone: (post: PublishedPost) => void;
  onError: (message: string) => void;
}

const bluesky = () => import('../../infra/bluesky.js');

export async function blueskyAccount(): Promise<BlueskyAccount | null> {
  const { initBluesky, blueskyDid, blueskyHandle } = await bluesky();
  await initBluesky();
  const did = blueskyDid();
  if (!did) return null;
  return { did, handle: await blueskyHandle() };
}

export async function signInToBluesky(handle: string): Promise<void> {
  const kept = await keep.persist();
  if (kept.kind === 'failed') throw new Error(kept.reason);
  await (await bluesky()).signIn(handle.trim());
}

export async function signOutOfBluesky(): Promise<void> {
  await (await bluesky()).signOut();
}

export async function publishClip(
  text: string,
  alt: string,
  handlers: PublishHandlers,
): Promise<void> {
  try {
    // A video service takes a video, and the use case refuses a sound-only clip too; said
    // here first, so nothing is loaded or signed in for a publish that cannot happen.
    if (!session.clip.keepsPicture()) {
      throw new Error('Bluesky takes a video, and this clip is sound only — it has no picture to write. Export it as a file instead');
    }
    const api = await bluesky();
    const service = await api.blueskyService();
    // The clip's own size: the post's aspect ratio and the encoded video's own size are
    // the same two numbers, read once, so the two cannot disagree.
    const picture = session.clip.size() ?? { width: el.cv.width || 1280, height: el.cv.height || 720 };
    // The same card the export puts at its head, when the clip asks for one — a published
    // video is an exported video too — with its logo decoded before the first frame.
    const intro = introFor(session.clip);
    await frameRenderer.prepare(intro);
    const { uri } = await publishToBluesky(session.clip, {
      export: { audio: session.audio, fadeSeconds: FADE_S, annotations: 'drawn', intro },
      text,
      alt,
      aspectRatio: AspectRatio.of(picture.width, picture.height).reduced(),
    }, {
      service,
      encode: async plan => {
        const encoded = await encoder.encode(plan, frameRenderer, {
          target: 'mp4',
          width: picture.width,
          height: picture.height,
          maxBytes: VIDEO_MAX_BYTES,
          onProgress: source => handlers.onProgress?.({
            stage: 'encoding',
            progress: Math.round((source / Math.max(0.001, plan.total)) * 100),
          }),
        });
        return encoded.blob;
      },
      onProgress: handlers.onProgress,
    });
    keep.forget();
    handlers.onDone({ uri, url: postUrl(uri, await api.blueskyHandle()) });
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : 'the publish failed');
  }
}
