// The YouTube flow: the dialog's parts, the Google sign-in and the encode.
//
// The rules live in the publish use case; this module sequences the browser work and
// reports progress. Google's client and the upload are loaded only when they are
// needed, as the Bluesky client is, so a normal load carries neither.
//
// There is no `keep.persist()` here as the Bluesky sign-in takes: the consent is a
// popup in the same page, so there is no trip away for the clip to survive.

import { session } from '../../session.js';
import { publishToYouTube, type YouTubePublicationProgress } from '../../application/publish-to-youtube.js';
import { encoder } from '../../infra/offline-encoder.js';
import { frameRenderer } from '../exporting/frame-renderer.js';
import { introFor } from '../exporting/intro.js';
import { keep } from '../keeping/keep.js';
import { el } from '../dom.js';
import { VideoDetails } from '../../domain/youtube/VideoDetails.js';
import { Visibility } from '../../domain/youtube/Visibility.js';
import { FADE_S } from '../clip/fade.js';

export type YouTubeProgress = YouTubePublicationProgress;

/** What an upload came to: the video YouTube made, and where it can be watched. */
export interface YouTubeVideoLink {
  id: string;
  url: string;
}

/** The channel a clip will go to, which the dialog shows before anything is sent. */
export interface YouTubeAccount {
  /** The channel's own name, when YouTube will say it; null when it will not. */
  channel: string | null;
}

/** What the person said about the video, as the fields hold it. */
export interface YouTubeSettings {
  title?: string;
  description?: string;
  visibility?: string;
}

export interface YouTubeHandlers {
  onProgress?: (progress: YouTubeProgress) => void;
  onDone: (video: YouTubeVideoLink) => void;
  onError: (message: string) => void;
}

const youtube = () => import('../../infra/youtube.js');

/** Whether this build is set up to upload at all. */
export async function youtubeConfigured(): Promise<boolean> {
  return (await youtube()).configured();
}

/**
 * The account a clip will go to, or `null` when nobody is signed in.
 *
 * The channel inside it is best effort: the app asks YouTube to name it and does without
 * when it will not. That is not the app's to decide — the upload scope does not authorize
 * the read — and it must not be read as "you have no channel".
 */
export async function youTubeAccount(): Promise<YouTubeAccount | null> {
  const api = await youtube();
  if (!api.signedIn()) return null;
  const channel = await api.youTubeChannel();
  return { channel: channel?.title ?? null };
}

export async function signInToYouTube(): Promise<void> {
  await (await youtube()).signIn();
}

export async function signOutOfYouTube(): Promise<void> {
  await (await youtube()).signOut();
}

/**
 * Upload the kept clip to the signed-in channel: write the MP4, send it, and wait for
 * YouTube to finish with it. Throws nothing — every refusal and failure is handed to
 * `onError` as the sentence a person reads, because the dialog and the automation
 * surface both want the reason rather than an exception.
 */
export async function uploadClip(settings: YouTubeSettings, handlers: YouTubeHandlers): Promise<void> {
  try {
    const details = VideoDetails.of({
      title: settings.title,
      description: settings.description,
      visibility: settings.visibility ? Visibility.of(settings.visibility) : undefined,
    }, new Date());

    const api = await youtube();
    const service = await api.youtubeService();
    // The clip's own size: the encoder is given it so every take is written at the size
    // the review showed.
    const picture = session.clip.size() ?? { width: el.cv.width || 1280, height: el.cv.height || 720 };
    const video = await publishToYouTube(session.clip, {
      // The same card the export puts at its head, when the clip asks for one: a
      // published video is an exported video too.
      export: { audio: session.audio, fadeSeconds: FADE_S, annotations: 'drawn', intro: introFor(session.clip) },
      details,
    }, {
      service,
      encode: async plan => {
        const encoded = await encoder.encode(plan, frameRenderer, {
          target: 'mp4',
          width: picture.width,
          height: picture.height,
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
    handlers.onDone({ id: video.id, url: video.url });
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : 'the upload failed');
  }
}
