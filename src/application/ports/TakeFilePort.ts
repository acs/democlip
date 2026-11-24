// A media file, read before it becomes a take — a recording with a picture, or a
// sound-only one.
//
// The three things a file has to tell the app to become a take are how long it is,
// whether it carries sound (the clip's length is the sum of its takes, so a take
// cannot be built without a length, and the session's audio flag follows the sound),
// and the size of its picture, which the clip's own size is derived from — null for a
// file that has no picture at all. None of them touches the file's bytes, which are
// kept as they are.

import type { Picture } from '../../domain/clip/ClipSize.js';

export interface TakeFileInfo {
  /** How long the file plays, in seconds. */
  readonly duration: number;
  /** Does the file carry sound of its own? */
  readonly hasAudio: boolean;
  /** The size of its picture, or null/absent when it has none. */
  readonly picture?: Picture | null;
}

export interface TakeFilePort {
  /** Read a file: how long it is, whether it has sound, and its picture size. Rejects when it is not a recording. */
  inspect(file: Blob): Promise<TakeFileInfo>;
}
