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

// Paint the webcam, mirrored, as a circle in the bottom-right of the rectangle the
// compositor gives it. The circle sits a margin inside the corner, and the video is
// scaled to cover it — centre-cropped, never stretched to the circle's square.
export function drawWebcamOverlay(
  context: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
): void {
  const video = el.wcv;
  if (!capture.sources.webcam || video.readyState < 2 || !video.videoWidth) return;
  const size = Math.min(width, height) * 0.28;   // the bubble's diameter
  const cx = x + width - size * 0.7;             // its centre, a margin in from the corner
  const cy = y + height - size * 0.7;
  // Cover the circle: scale the video so its shorter side fills the diameter, and centre
  // it, so the circle crops the picture instead of squashing it.
  const cover = Math.max(size / video.videoWidth, size / video.videoHeight);
  const dw = video.videoWidth * cover;
  const dh = video.videoHeight * cover;
  context.save();
  context.beginPath();
  context.arc(cx, cy, size / 2, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.translate(cx, cy);
  context.scale(-1, 1);
  context.drawImage(video, -dw / 2, -dh / 2, dw, dh);
  context.restore();
}
