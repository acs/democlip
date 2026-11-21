// The surface's output operations: the file, and the post.
//
// Both are the app's own flows. An export is what the Export menu does — the file is
// encoded offline and handed to the browser's download, and this answers with what
// was written. A publish is what the Bluesky button does, from the person's own
// account, signed in in this window.
//
// Nothing leaves the machine unless a person asked for it: with nobody signed in, a
// publish is refused with a reason and nothing is sent.

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

export interface Out {
  export(target: string, annotations?: string): Promise<Result<{ filename: string }>>;
  publish(options: { text?: string; alt?: string }): Promise<Result<{ url: string }>>;
}

const TARGETS: readonly string[] = ['webm', 'mp4'];
const ANNOTATIONS: readonly string[] = ['drawn', 'carried'];

export function createOut(exporter: Exporter, publisher: Publisher): Out {
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
