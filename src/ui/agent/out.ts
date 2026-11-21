// The surface's output operations: the file, the post, and the video.
//
// All are the app's own flows. An export is what the Export menu does — the file is
// encoded offline and handed to the browser's download, and this answers with what was
// written. A publish is what the Publish button does, from the person's own account,
// signed in in this window: on **Bluesky** it is a post, and on **YouTube** a video on
// their own channel.
//
// Nothing leaves the machine unless a person asked for it: with nobody signed in, a
// publish is refused with a reason and nothing is sent.
//
// A destination is one operation gaining a second place to go, not a second operation —
// as it is for a person, who picks it in the same menu.

import type { ExportTarget } from '../../domain/export/ExportTarget.js';
import type { AnnotationExport } from '../../domain/clip/ExportPlan.js';
import type { PublishHandlers } from '../publishing/publish-flow.js';
import type { Result } from './surface.js';

/** What an export came to, in the app's own terms. */
export type ExportResult =
  | { kind: 'exported'; bytes: number; filename: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

export interface Exporter {
  export(target: ExportTarget, annotations: AnnotationExport): Promise<ExportResult>;
}

export interface Publisher {
  /** The account signed in in this window, or null when nobody is. */
  account(): Promise<{ readonly handle: string | null } | null>;
  /** Post the clip, from that account. */
  publish(text: string, alt: string, handlers: PublishHandlers): Promise<void>;
}

/** Where a clip goes when it is published. Bluesky is what the operation was before there were two. */
export const DESTINATIONS: readonly string[] = ['bluesky', 'youtube'];

/** What a publish is given: the destination, and that destination's own details. */
export interface PublishOptions {
  destination?: string;
  /** Bluesky: the post's words, and what the video shows. */
  text?: string;
  alt?: string;
  /** YouTube: the video's title, and who may see it. */
  title?: string;
  visibility?: string;
}

export interface YouTubePublisher {
  /** The channel signed in in this window, or null when nobody is. */
  account(): Promise<{ readonly channel: string } | null>;
  /** Upload the clip to that channel. */
  upload(settings: { title?: string; visibility?: string }, handlers: {
    onDone: (video: { readonly url: string }) => void;
    onError: (reason: string) => void;
  }): Promise<void>;
}

export interface Out {
  export(target: string, annotations?: string): Promise<Result<{ filename: string }>>;
  publish(options: PublishOptions): Promise<Result<{ url: string }>>;
}

const ANNOTATIONS: readonly string[] = ['drawn', 'carried'];

export function createOut(exporter: Exporter, publisher: Publisher, video: YouTubePublisher): Out {
  return {
    async export(target, annotations = 'drawn') {
      if (!TARGETS.includes(target)) {
        return { ok: false, reason: `the app exports ${TARGETS.join(' or ')}, not ${target}` };
      }
      if (!ANNOTATIONS.includes(annotations)) {
        return {
          ok: false,
          reason: `the app writes the annotations ${ANNOTATIONS.join(' or ')} — in the picture, or beside it — not ${annotations}`,
        };
      }
      const outcome = await exporter.export(target as ExportTarget, annotations as AnnotationExport);
      if (outcome.kind === 'exported') return { ok: true, filename: outcome.filename };
      return { ok: false, reason: outcome.reason };
    },

    async publish(options) {
      const destination = options.destination ?? 'bluesky';
      if (!DESTINATIONS.includes(destination)) {
        return { ok: false, reason: `the app publishes to ${DESTINATIONS.join(' or ')}, not ${destination}` };
      }
      if (destination === 'youtube') return uploadToChannel(video, options);

      const account = await publisher.account();
      if (!account) {
        return { ok: false, reason: 'nobody is signed in to publish — sign in to Bluesky in this window first' };
      }
      return new Promise<Result<{ url: string }>>(resolve => {
        void publisher.publish(options.text ?? '', options.alt ?? '', {
          onDone: post => resolve({ ok: true, url: post.url }),
          onError: reason => resolve({ ok: false, reason }),
        });
      });
    },
  };
}

const TARGETS: readonly string[] = ['webm', 'mp4'];

/** The YouTube half: a video on the channel the person signed in to, or a refusal. */
async function uploadToChannel(video: YouTubePublisher, options: PublishOptions): Promise<Result<{ url: string }>> {
  const account = await video.account();
  if (!account) {
    return { ok: false, reason: 'nobody is signed in to upload to YouTube — sign in to Google in this window first' };
  }
  return new Promise<Result<{ url: string }>>(resolve => {
    void video.upload({ title: options.title, visibility: options.visibility }, {
      onDone: uploaded => resolve({ ok: true, url: uploaded.url }),
      onError: reason => resolve({ ok: false, reason }),
    });
  });
}
