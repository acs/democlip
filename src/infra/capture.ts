// The browser's capture capabilities: screen, webcam and microphone.
//
// One adapter owns the tracks and releases them. The screen is the CapturePort;
// the webcam and the microphone are their own ports over the same adapter.

import type { CapturePort, CaptureSession } from '../application/ports/CapturePort.js';
import type { WebcamPort } from '../application/ports/WebcamPort.js';
import type { MicrophonePort } from '../application/ports/MicrophonePort.js';
import { SourceSet } from '../domain/capture/SourceSet.js';
import { CropRegion } from '../domain/capture/CropRegion.js';

export type ScreenCapture = CaptureSession;

/**
 * Conditional Focus, which is Chrome's and not in the DOM types: a captured **tab** or
 * window takes the focus when the share starts, so the app the person is driving goes
 * behind what they are recording — the preview carries on, but their controls are
 * hidden. A `CaptureController` lets the app say which surface keeps the focus, and
 * `'no-focus-change'` keeps this tab in front, which is where the app belongs.
 */
interface FocusController {
  setFocusBehavior(behavior: 'focus-captured-surface' | 'no-focus-change'): void;
}

/** Chrome's controller, when this browser has one; null anywhere else. */
function focusController(): FocusController | null {
  const Controller = (globalThis as { CaptureController?: new () => FocusController }).CaptureController;
  return Controller ? new Controller() : null;
}

/**
 * What the app asks a camera for: the chosen device, and a **size it would like**.
 *
 * The size is a preference and never a demand. Without one the browser answers with
 * its own default — 640×480 on every camera for years — however much the hardware can
 * do, so a 1080p webcam recorded at 480p. `ideal` lets the browser deliver the nearest
 * mode it actually has: a phone's small camera still opens at its own size rather than
 * failing, and a camera that tops out below the ask records what it tops out at. Never
 * `min` or `exact` here — either one would turn a modest camera into "Could not start
 * the webcam".
 *
 * 1280×720 is the ask, not the ceiling: a webcam is either the whole picture (where
 * that is a reasonable clip) or a bubble drawn small over a screen, and a larger camera
 * costs real encode work for a bubble it cannot show. The frame rate is left alone, so
 * the camera keeps whatever a browser would have given it.
 */
function webcamVideo(deviceId?: string): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

export class CaptureAdapter implements CapturePort {
  private screenCapture: CaptureSession | null = null;
  private webcamStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private endedListeners = new Set<() => void>();

  sources = SourceSet.NONE;
  region = CropRegion.FULL;
  width = 0;
  height = 0;

  setRegion(region: CropRegion): void {
    this.region = region;
  }

  /**
   * The picture's own size, once a frame has landed. A display track's settings
   * report the **display's** size until the first frame of a tab or window arrives
   * — the whole screen, for a small tab — so the settings alone would size the
   * preview to the screen. The element the capture is drawn from knows the truth,
   * and it also follows a shared window or tab that is resized.
   */
  setSize(width: number, height: number): void {
    if (!(width > 0) || !(height > 0)) return;
    this.width = width;
    this.height = height;
  }

  async start(): Promise<CaptureSession> {
    // The request the app has always made, bar the pane: `cursor: 'always'` puts the
    // pointer in the recording, `frameRate` asks for 30. The picker is left to open
    // on whatever pane it likes — `displaySurface` used to point it at the screen,
    // which works against recording a tab or a window. `systemAudio: 'include'` asks
    // for the sound of what is shared as well as the tab's — only a hint, since
    // Chrome decides whether the option appears and whether its box starts ticked,
    // and the user still has to agree, so a share without audio is possible and the
    // flow says so.
    //
    // The `controller` asks for the other half of the same thing: the **focus**. Sharing
    // a tab or a window otherwise brings it to the front, and the app — whose preview is
    // where the share is watched — goes behind it. See `focusController`.
    const videoConstraints = {
      frameRate: { ideal: 30, max: 60 },
      cursor: 'always',
    } as MediaTrackConstraints;
    const controller = focusController();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: videoConstraints, audio: true, systemAudio: 'include',
      ...(controller ? { controller } : {}),
    } as DisplayMediaStreamOptions);
    // This tab is the one that stays in front, whichever surface was picked.
    try { controller?.setFocusBehavior('no-focus-change'); } catch { /* a surface that takes no focus */ }

    const hasAudio = stream.getAudioTracks().length > 0;
    this.screenCapture = { stream, hasAudio };
    this.sources = this.sources.withScreen(true);
    const video = stream.getVideoTracks()[0];
    if (video) {
      const settings = video.getSettings();
      this.width = settings.width ?? this.width;
      this.height = settings.height ?? this.height;
      video.addEventListener('ended', () => this.endScreen(), { once: true });
    }
    return this.screenCapture;
  }

  current(): CaptureSession | null {
    return this.screenCapture;
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  stop(): void {
    this.screenCapture?.stream.getTracks().forEach(track => track.stop());
    this.screenCapture = null;
    this.sources = this.sources.withScreen(false);
  }

  async startWebcam(deviceId?: string): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: webcamVideo(deviceId),
      audio: false,
    });
    this.webcamStream = stream;
    this.sources = this.sources.withWebcam(true);
    const settings = stream.getVideoTracks()[0]?.getSettings();
    this.width = settings?.width ?? this.width;
    this.height = settings?.height ?? this.height;
    return stream;
  }

  // A phone's camera hardware can only be open once, so the old stream is stopped
  // before the chosen one opens. If the new camera cannot be read, the previous
  // one is opened again so the preview is not left dead.
  async switchWebcam(deviceId: string): Promise<MediaStream> {
    const previousId = this.webcamStream?.getVideoTracks()[0]?.getSettings().deviceId;
    this.webcamStream?.getTracks().forEach(track => track.stop());
    this.webcamStream = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: webcamVideo(deviceId),
        audio: false,
      });
      this.webcamStream = stream;
      this.sources = this.sources.withWebcam(true);
      const settings = stream.getVideoTracks()[0]?.getSettings();
      this.width = settings?.width ?? this.width;
      this.height = settings?.height ?? this.height;
      return stream;
    } catch (error) {
      if (previousId) {
        try {
          const restored = await navigator.mediaDevices.getUserMedia({
            video: webcamVideo(previousId),
            audio: false,
          });
          this.webcamStream = restored;
          this.sources = this.sources.withWebcam(true);
          const settings = restored.getVideoTracks()[0]?.getSettings();
          this.width = settings?.width ?? this.width;
          this.height = settings?.height ?? this.height;
        } catch {
          // The previous camera is gone too; leave the source stopped.
        }
      }
      if (!this.webcamStream) this.sources = this.sources.withWebcam(false);
      throw error;
    }
  }

  currentWebcam(): MediaStream | null {
    return this.webcamStream;
  }

  stopWebcam(): void {
    this.webcamStream?.getTracks().forEach(track => track.stop());
    this.webcamStream = null;
    this.sources = this.sources.withWebcam(false);
  }

  async startMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.micStream = stream;
    this.sources = this.sources.withMic(true);
    return stream;
  }

  currentMic(): MediaStream | null {
    return this.micStream;
  }

  stopMic(): void {
    this.micStream?.getTracks().forEach(track => track.stop());
    this.micStream = null;
    this.sources = this.sources.withMic(false);
  }

  private endScreen(): void {
    this.screenCapture = null;
    this.sources = this.sources.withScreen(false);
    for (const listener of this.endedListeners) listener();
  }
}

export const capture = new CaptureAdapter();

export const webcamPort: WebcamPort = {
  start: (deviceId?: string) => capture.startWebcam(deviceId),
  stop: () => capture.stopWebcam(),
  current: () => capture.currentWebcam(),
};

export const microphonePort: MicrophonePort = {
  start: () => capture.startMic(),
  stop: () => capture.stopMic(),
  current: () => capture.currentMic(),
};
