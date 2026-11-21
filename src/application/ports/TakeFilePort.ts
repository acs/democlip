// A video file, read before it becomes a take.
//
// The only two things a file has to tell the app to become a take are how long it
// is and whether it carries sound: the clip's length is the sum of its takes, so a
// take cannot be built without a length, and the session's audio flag — what the
// waveform and the export go by — follows the sound. Neither touches the file's
// bytes, which are kept as they are.

export interface TakeFileInfo {
  /** How long the file plays, in seconds. */
  readonly duration: number;
  /** Does the file carry sound of its own? */
  readonly hasAudio: boolean;
}

export interface TakeFilePort {
  /** Read a file: how long it is, and whether it has sound. Rejects when it is not a video. */
  inspect(file: Blob): Promise<TakeFileInfo>;
}
