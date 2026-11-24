// The compositor: what a take actually records.
//
// It draws the crop of the screen and the webcam bubble onto a canvas, and mixes
// the system audio with the microphone. With no picture source it draws nothing:
// the stream is the mixed sound alone, which is what a **sound-only** take is. It
// owns the canvas, the audio graph and the hidden video elements it draws from, and
// releases them when the take ends. The bubble's drawing is injected by the
// composition root; the compositor imports no view module.

import type { CompositorInput, CompositorPort, CompositorSession } from '../application/ports/CompositorPort.js';
import type { CropRegion } from '../domain/capture/CropRegion.js';

const SYSTEM_GAIN = 0.8;
const MIC_GAIN = 1.0;

export class CompositorAdapter implements CompositorPort {
  private video: HTMLVideoElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private frame = 0;
  private audio: AudioContext | null = null;
  private stream: MediaStream | null = null;

  open(input: CompositorInput): CompositorSession {
    this.close();
    const audioTracks = this.audioTracks(input);
    const videoTracks = this.videoTracks(input);
    this.stream = new MediaStream([...videoTracks, ...audioTracks]);
    return { stream: this.stream, hasAudio: audioTracks.length > 0 };
  }

  close(): void {
    if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; }
    if (this.video) { this.video.pause(); this.video.srcObject = null; this.video = null; }
    if (this.audio) { void this.audio.close(); this.audio = null; }
    this.context = null;
    this.stream = null;
  }

  private videoTracks(input: CompositorInput): MediaStreamTrack[] {
    const screen = input.screen?.getVideoTracks() ?? [];
    const webcam = input.webcam?.getVideoTracks() ?? [];
    const region = input.region;
    const full = !region || (region.x === 0 && region.y === 0 && region.w === 1 && region.h === 1);
    // The camera alone, when the screen is off: cropped through the canvas when the
    // person cropped it, and otherwise its own bytes, untouched.
    if (!screen.length) {
      if (webcam.length && !full) return this.canvasTracks(input, webcam[0], false);
      return webcam;
    }
    // A whole share with nothing drawn over it is recorded raw, at the screen's own
    // size — there is no crop to take and no bubble to draw, so the canvas would only
    // be a copy. (The signal is the webcam, not `drawBubble`: the view always hands
    // one, because the bubble is drawn when there is a camera and not otherwise.)
    if (full && !webcam.length) return screen;
    return this.canvasTracks(input, screen[0], true);
  }

  /**
   * The picture drawn on a canvas: the crop of a source, and the webcam bubble over it
   * when the source is the screen. The camera, which is the whole picture when the
   * screen is off, is cropped the same way but carries no bubble of itself.
   */
  private canvasTracks(input: CompositorInput, source: MediaStreamTrack, withBubble: boolean): MediaStreamTrack[] {
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([source]);
    void video.play();
    this.video = video;
    const context = canvas.getContext('2d');
    if (!context) return [];
    this.context = context;
    const { region } = input;
    // The canvas is the recording's size, so it has to be right before
    // `captureStream` is taken from it — and the element this draws from has no size
    // yet, its first frame still coming. So the size comes from the picture the app
    // is showing, and the element's own is only a fallback.
    const sourceWidth = input.picture?.width || video.videoWidth || 1280;
    const sourceHeight = input.picture?.height || video.videoHeight || 720;
    const width = Math.max(2, Math.round(region.w * sourceWidth));
    const height = Math.max(2, Math.round(region.h * sourceHeight));
    canvas.width = width;
    canvas.height = height;
    // The picture the app is already showing is a real frame, so the capture starts on
    // it rather than on the blank canvas its own element would leave while it waits for
    // its first frame. The element's own frame takes over as soon as it arrives.
    const first = input.pictureElement;
    if (first && first.readyState >= 2 && first.videoWidth > 0 && first.videoHeight > 0) {
      this.paint(context, first, first.videoWidth, first.videoHeight, canvas, region, withBubble, input);
    }
    const draw = () => {
      if (!this.context || !this.video) return;
      const vw = this.video.videoWidth || canvas.width;
      const vh = this.video.videoHeight || canvas.height;
      this.paint(this.context, this.video, vw, vh, canvas, region, withBubble, input);
      this.frame = requestAnimationFrame(draw);
    };
    draw();
    return canvas.captureStream().getVideoTracks();
  }

  /** Draw one frame of the picture, cropped to the region, with the bubble over it. */
  private paint(
    context: CanvasRenderingContext2D,
    image: CanvasImageSource,
    imageWidth: number,
    imageHeight: number,
    canvas: HTMLCanvasElement,
    region: CropRegion,
    withBubble: boolean,
    input: CompositorInput,
  ): void {
    const sx = region.x * imageWidth;
    const sy = region.y * imageHeight;
    const sw = region.w * imageWidth;
    const sh = region.h * imageHeight;
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (withBubble) input.drawBubble?.(context, canvas.width, canvas.height);
  }

  private audioTracks(input: CompositorInput): MediaStreamTrack[] {
    const system = input.screen?.getAudioTracks() ?? [];
    const mic = input.mic?.getAudioTracks() ?? [];
    if (!input.audio || (!system.length && !mic.length)) return [];
    if (!mic.length) return system;
    const Ctx = window.AudioContext;
    const context = new Ctx();
    this.audio = context;
    const destination = context.createMediaStreamDestination();
    const systemGain = context.createGain();
    systemGain.gain.value = SYSTEM_GAIN;
    const micGain = context.createGain();
    micGain.gain.value = MIC_GAIN;
    if (system.length) {
      context.createMediaStreamSource(new MediaStream(system)).connect(systemGain).connect(destination);
    }
    context.createMediaStreamSource(new MediaStream(mic)).connect(micGain).connect(destination);
    void context.resume();
    return destination.stream.getAudioTracks();
  }
}

export const compositor = new CompositorAdapter();
