// The webcam source.
//
// A toggle starts the camera. With the screen on it is a bubble in the bottom-right
// of the capture region; with the screen off it is the whole picture. The stream is
// acquired and released by the capture adapter; this view attaches it to the video
// element and draws the bubble.
//
// When more than one camera is present, a picker beside the toggle lists them. The
// picker belongs to the webcam source: it is shown while the webcam is on, hidden
// otherwise, and disabled while a take owns the sources.

import { capture } from '../../infra/capture.js';
import { WebcamBubble } from '../../domain/capture/WebcamBubble.js';
import { currentPhase } from '../../state.js';
import { el, toast } from '../dom.js';
import { cameraOptions, shouldShowPicker } from './camera-list.js';
import { cameraMenu } from './camera-menu.js';
import { setCameraPresent } from './source-buttons.js';

let cameras: MediaDeviceInfo[] = [];
let selectedId: string | null = null;

export function initWebcam(): void {
  setCameraPresent(false);                      // until we know a camera is there
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => void onDeviceChange());
  }
  void detectWebcam();
}

export async function detectWebcam(): Promise<void> {
  let present = false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices.filter(device => device.kind === 'videoinput');
    present = cameras.length > 0;
  } catch {
    cameras = [];
  }
  setCameraPresent(present);
  renderCameras();
  if (!present) {
    if (capture.sources.webcam) toast('The camera was disconnected', 4000);
    stopWebcam();
  }
}

// A device came or went. The active camera leaving stops the preview; another
// camera leaving just shrinks the list.
async function onDeviceChange(): Promise<void> {
  const wasSelected = selectedId;
  await detectWebcam();
  if (wasSelected && !cameras.some(camera => camera.deviceId === wasSelected)) {
    selectedId = null;
    if (capture.sources.webcam) {
      stopWebcam();
      toast('The camera was disconnected', 4000);
    } else {
      renderCameras();
    }
  }
}

// Async, so the caller can sync the preview once the camera is really on.
export async function toggleWebcam(): Promise<void> {
  if (capture.sources.webcam) stopWebcam();
  else                        await startWebcam();
}

async function startWebcam(): Promise<void> {
  if (capture.sources.webcam) return;
  const wanted = rememberedCamera();
  try {
    const stream = await capture.startWebcam(wanted);
    el.wcv.srcObject = stream;
    await el.wcv.play();
    selectedId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? wanted ?? null;
    el.webcamBtn.classList.add('active');
    el.webcamBtn.setAttribute('aria-pressed', 'true');
    await detectWebcam();                       // labels are only readable after permission
  } catch (error) {
    const name = (error as { name?: string }).name;
    toast('Could not start the webcam' + (name ? ` (${name})` : ''), 4000);
  }
}

// Switch to another camera without ending the session. The adapter stops the old
// stream first (a phone's hardware can only be open once) and restores the
// previous camera if the new one cannot be read, so the preview stays alive.
export async function switchWebcam(deviceId: string): Promise<void> {
  if (!capture.sources.webcam || deviceId === selectedId) return;
  try {
    const stream = await capture.switchWebcam(deviceId);
    el.wcv.srcObject = stream;
    await el.wcv.play();
    selectedId = deviceId;
    renderCameras();
  } catch (error) {
    const name = (error as { name?: string }).name;
    toast('Could not switch the camera' + (name ? ` (${name})` : ''), 4000);
    const current = capture.currentWebcam();
    if (current) {
      el.wcv.srcObject = current;
      await el.wcv.play().catch(() => {});
    } else {
      stopWebcam();
    }
    renderCameras();
  }
}

export function stopWebcam(): void {
  capture.stopWebcam();
  el.wcv.srcObject = null;
  el.webcamBtn.classList.remove('active');
  el.webcamBtn.setAttribute('aria-pressed', 'false');
  renderCameras();
}

// The camera chosen last, if it is still present. The first start has none, so
// the browser's default camera is used.
function rememberedCamera(): string | undefined {
  return selectedId && cameras.some(camera => camera.deviceId === selectedId)
    ? selectedId
    : undefined;
}

// The picker's options and visibility. Called whenever the device list or the
// webcam's own state changes. The trigger only appears while the webcam is on
// and there is more than one camera; the menu is rebuilt from the same list.
function renderCameras(): void {
  const options = cameraOptions(cameras);
  const show = shouldShowPicker(cameras.length, capture.sources.webcam);
  el.camPickBtn.hidden = !show;
  if (!show) cameraMenu.close();
  cameraMenu.setItems(options, selectedId);
}

// The sitting's placement of the bubble, and the gesture that sets it.
//
// It belongs to the webcam view — the widget is here — and its lifetime is the sitting:
// `reset()` at the session's end makes the default corner again, and a reload starts
// there too, because nothing is written down. Exported so the preview's drag router can
// ask it, and the end of a session can clear it.

// How far into the circle, and out past it, a press still counts as its edge — so the rim
// is grabbable from either side of the line a person sees. The inner share is a fraction
// of the radius; the outer is a fraction of the region's shorter side.
const RIM_IN = 0.25;
const RIM_OUT = 0.06;

/** Which gesture a press on the region begins. */
type BubbleGesture = 'move' | 'resize';

class BubblePlacer {
  private placed: WebcamBubble | null = null;
  private gesture: BubbleGesture | null = null;
  private pointX = 0;
  private pointY = 0;
  private grabX = 0;   // where within the bubble the pointer took hold, as fractions
  private grabY = 0;

  /** The placement to draw for a region: the gesture in flight, the sitting's own, or the default corner. */
  for(width: number, height: number): WebcamBubble {
    const base = this.base(width, height);
    if (this.gesture === 'resize') {
      // The drag's distance from the (fixed) centre is the new radius.
      const { cx, cy } = base.geometry(width, height);
      const diameter = Math.hypot(this.pointX - cx, this.pointY - cy) * 2;
      return base.withSize(diameter / Math.min(width, height), width, height);
    }
    if (this.gesture === 'move') {
      // The bubble keeps the point it was taken hold of, so it does not jump under the hand.
      return base.withCentre(
        this.pointX / width - this.grabX,
        this.pointY / height - this.grabY,
        width,
        height,
      );
    }
    return base;
  }

  /** Is a gesture in flight? */
  get active(): boolean {
    return this.gesture !== null;
  }

  /**
   * Where a press on the region lands: the middle of the circle moves it, a press on its
   * edge — a little inside or a little outside the line — resizes it, and further out is
   * the crop's. Pressing the visible edge must resize: it is what the rim handle invites,
   * and reading a press just inside the line as the middle used to shunt the whole bubble
   * sideways, so a hand aiming at the rim moved the bubble instead.
   */
  hit(x: number, y: number, width: number, height: number): BubbleGesture | null {
    const { cx, cy, r } = this.base(width, height).geometry(width, height);
    const reach = Math.hypot(x - cx, y - cy);
    if (reach <= r * (1 - RIM_IN)) return 'move';
    if (reach <= r + Math.min(width, height) * RIM_OUT) return 'resize';
    return null;
  }

  /** A gesture begins where the pointer landed, remembering the point it took hold of. */
  begin(x: number, y: number, gesture: BubbleGesture, width: number, height: number): void {
    const { cx, cy } = this.base(width, height).geometry(width, height);
    this.gesture = gesture;
    this.pointX = x;
    this.pointY = y;
    this.grabX = (x - cx) / width;
    this.grabY = (y - cy) / height;
  }

  /** ...and the bubble follows the pointer. */
  move(x: number, y: number): void {
    this.pointX = x;
    this.pointY = y;
  }

  /** The pointer came up: the placement it made is the sitting's. */
  end(width: number, height: number): void {
    this.placed = this.for(width, height);
    this.gesture = null;
  }

  /** The pointer was cancelled: nothing was committed. */
  cancel(): void {
    this.gesture = null;
  }

  /** The sitting is over: back to the default corner. */
  reset(): void {
    this.placed = null;
    this.gesture = null;
  }

  private base(width: number, height: number): WebcamBubble {
    return this.placed ? this.placed.fitted(width, height) : WebcamBubble.default(width, height);
  }
}

export const bubblePlacer = new BubblePlacer();

// Paint the webcam, mirrored, as a circle at the sitting's placement — the default corner
// unless the person has moved or resized it. The circle is drawn on the rectangle the
// caller gives it: the preview's region, or the recording's whole canvas, so the two
// agree. The video is scaled to cover the circle — centre-cropped, never stretched.
export function drawWebcamOverlay(
  context: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
): void {
  const video = el.wcv;
  if (!capture.sources.webcam || video.readyState < 2 || !video.videoWidth) return;
  const { cx, cy, r } = bubblePlacer.for(width, height).geometry(width, height);
  const centreX = x + cx;
  const centreY = y + cy;
  const diameter = r * 2;
  // Cover the circle: scale the video so its shorter side fills the diameter, and centre
  // it, so the circle crops the picture instead of squashing it.
  const cover = Math.max(diameter / video.videoWidth, diameter / video.videoHeight);
  const dw = video.videoWidth * cover;
  const dh = video.videoHeight * cover;
  context.save();
  context.beginPath();
  context.arc(centreX, centreY, r, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.translate(centreX, centreY);
  context.scale(-1, 1);
  context.drawImage(video, -dw / 2, -dh / 2, dw, dh);
  context.restore();

  // A handle on the rim, while the preview is live, is where the bubble is resized. It is
  // not drawn during a take or in review, so it never reaches the recording.
  if (currentPhase() === 'live') {
    const handle = Math.max(3, r * 0.12);
    context.save();
    context.beginPath();
    context.arc(centreX + r, centreY, handle, 0, Math.PI * 2);
    context.closePath();
    context.fillStyle = 'rgba(255,255,255,0.92)';
    context.strokeStyle = 'rgba(6,7,16,0.6)';
    context.lineWidth = Math.max(1, handle * 0.25);
    context.fill();
    context.stroke();
    context.restore();
  }
}
