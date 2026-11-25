// Keeping a stock sound's bytes, named without the browser.
//
// A sound annotation holds the **name** of an app sound, never its bytes. The bytes are the
// app's own file, served beside it, decoded once and held — exactly as an image annotation's
// picture is kept in a store and drawn from the decoded copy. This port is the sound's half of
// it: the name a sound annotation carries, resolved to a buffer the review and the export can
// play.

export interface StockSoundPort {
  /** The decoded sound for a name, decoding it once; null when the app cannot read it. */
  buffer(name: string): Promise<AudioBuffer | null>;
  /** The decoded sound if it is already there, else null — nothing waits on this. */
  get(name: string): AudioBuffer | null;
  /** Resolves when every sound asked for so far is decoded. */
  ready(): Promise<void>;
  /** Let the decoded sounds go. */
  clear(): void;
}
