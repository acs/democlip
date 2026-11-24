// Which record sources are on: the screen, the webcam and the microphone.
//
// Three independent toggles, all off at start. A take needs a **source**: a
// picture — the screen or the webcam — or the microphone alone, which makes a
// **sound-only** take. The set holds the intent; the capture adapter holds the
// device. A source is on only while its device is held, so the adapter reports a
// set that matches what it has.

export class SourceSet {
  static readonly NONE = new SourceSet(false, false, false);

  private constructor(
    readonly screen: boolean,
    readonly webcam: boolean,
    readonly mic: boolean,
  ) {}

  static of(screen: boolean, webcam: boolean, mic: boolean): SourceSet {
    if (!screen && !webcam && !mic) return SourceSet.NONE;
    return new SourceSet(screen, webcam, mic);
  }

  /** Is there a picture to record — the screen or the webcam? */
  get hasPicture(): boolean {
    return this.screen || this.webcam;
  }

  /** Is there a source to record at all: a picture, or the microphone on its own? */
  get canRecord(): boolean {
    return this.screen || this.webcam || this.mic;
  }

  /** The microphone alone: a take with sound and no picture. */
  get soundOnly(): boolean {
    return this.mic && !this.hasPicture;
  }

  get any(): boolean {
    return this.screen || this.webcam || this.mic;
  }

  withScreen(on: boolean): SourceSet {
    return SourceSet.of(on, this.webcam, this.mic);
  }

  withWebcam(on: boolean): SourceSet {
    return SourceSet.of(this.screen, on, this.mic);
  }

  withMic(on: boolean): SourceSet {
    return SourceSet.of(this.screen, this.webcam, on);
  }

  equals(other: SourceSet): boolean {
    return this.screen === other.screen && this.webcam === other.webcam && this.mic === other.mic;
  }
}
