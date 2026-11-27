// Many recordings, kept across a page load, named without IndexedDB.
//
// A recording is the clip plus the few facts that place it: the project it belongs to,
// the profile it was made under, when its first take landed, and the small header facts a
// list reads without opening take bytes. The port is what the use cases see; the adapter
// in `src/infra/recording-store.ts` owns the browser.
//
// The **open pointer** is the app's record of which recording the sitting is on. It is
// written in the same transaction as a recording's first meta, so a take can never exist
// without the pointer that reveals it, and a crash leaves either both or neither.

import type { Clip, ClipSnapshot } from '../../domain/clip/Clip.js';
import type { StoredClipProfile } from '../../domain/clip/ClipProfile.js';
import type { StoredAnnotation } from '../../domain/annotation/Annotation.js';

/** What a recording's write needs to know besides the clip itself. */
export interface RecordingPlace {
  readonly projectId: string;
  readonly profile: StoredClipProfile;
  /** Epoch milliseconds, set when the recording's first take lands. */
  readonly createdAt: number;
}

/** The recording the sitting is on. */
export interface OpenRecording extends RecordingPlace {
  readonly recordingId: string;
}

/** The few facts a list shows, read from the small half only. */
export interface RecordingHeader {
  readonly id: string;
  readonly projectId: string;
  readonly profile: StoredClipProfile;
  readonly createdAt: number;
  readonly duration: number;
  readonly count: number;
  readonly title: string;
}

/** A recording read back whole, with the facts that place it. */
export interface LoadedRecording extends RecordingPlace {
  readonly snapshot: ClipSnapshot;
  readonly title: string;
}

/** The previous version's one clip, as the migration reads it. */
export interface LegacyRecording {
  readonly snapshot: ClipSnapshot;
  readonly images: ReadonlyArray<{ id: string; blob: Blob }>;
}

export interface RecordingStorePort {
  /** A take arrived: write it, the small half, and the open pointer together. */
  saveTake(recordingId: string, clip: Clip, index: number, place: RecordingPlace): Promise<void>;
  /** The cuts or the annotations moved: only the small half changes. */
  saveMeta(recordingId: string, clip: Clip, place: RecordingPlace): Promise<void>;
  /** Write the whole recording now — every take that is not there yet, and the small half. */
  saveAll(recordingId: string, clip: Clip, place: RecordingPlace): Promise<void>;
  /** The recording read back, or null when it is not there or not usable. */
  load(recordingId: string): Promise<LoadedRecording | null>;
  /** Every recording's header, in the order they were made. */
  list(): Promise<RecordingHeader[]>;
  /** Destroy one recording's bytes: takes, meta and pictures. */
  delete(recordingId: string): Promise<void>;
  /** Move a recording to another project, without touching its bytes. */
  setProject(recordingId: string, projectId: string): Promise<void>;
  /** The recording the sitting is on, or null. */
  open(): Promise<OpenRecording | null>;
  /** Point the sitting at a recording (or a draft), or move the pointer on. */
  setOpen(open: OpenRecording): Promise<void>;
  /** There is no recording open: the last one is finished. */
  clearOpen(): Promise<void>;
  /** The previous version's one clip, or null when there is none to adopt. */
  readLegacy(): Promise<LegacyRecording | null>;
  /** Adopt the legacy clip under this id, with its takes, pictures and the pointer, in one transaction. */
  adopt(recordingId: string, legacy: LegacyRecording, place: RecordingPlace): Promise<void>;
  /** The legacy stores are no longer needed. */
  clearLegacy(): Promise<void>;
}

/** The small half as it is kept; exported for adapters and tests that read it. */
export interface StoredRecordingMeta {
  version: number;
  projectId: string;
  profile: StoredClipProfile;
  createdAt: number;
  duration: number;
  count: number;
  cuts: Array<{ s: number; e: number }>;
  annotations?: StoredAnnotation[];
  properties?: Record<string, string>;
  watermark?: string[];
  audio: boolean;
}