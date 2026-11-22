// A video file, read before it becomes a take.
//
// The three things a file has to tell the app to become a take are how long it is,
// whether it carries sound (the clip's length is the sum of its takes, so a take
// cannot be built without a length, and the session's audio flag follows the sound),
// and the size of its picture, which the clip's own size is derived from. None of
// them touches the file's bytes, which are kept as they are.

import type { Picture } from '../../domain/clip/ClipSize.js';

export interface TakeFileInfo {
  /** How long the file plays, in seconds. */
  readonly duration: number;
  /** Does the file carry sound of its own? */
  readonly hasAudio: boolean;
  /** The size of its picture, or null/absent when the file will not say. */
  readonly picture?: Picture | null;
}

export interface TakeFilePort {
  /** Read a file: how long it is, whether it has sound, and its picture size. Rejects when it is not a video. */
  inspect(file: Blob): Promise<TakeFileInfo>;
}
