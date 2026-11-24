// A fixture take, encoded in the browser.
//
// This module runs in page context — a check imports it through the dev server —
// and builds a real, decodable WebM in milliseconds with WebCodecs and Mediabunny,
// the same path src/infra/offline-encoder.ts uses for the export. It is never a
// MediaRecorder file: those are real-time and report `duration = 0`.
//
// Nothing here is application code. It is test support, and it lives outside src/.

import {
  AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat,
} from 'mediabunny';

export interface FixtureSpec {
  width?: number;
  height?: number;
  seconds: number;
  fps?: number;
  hasAudio?: boolean;
  pattern?: string;
  /** Which container to write: WebM (the app's own recording) or MP4 (an import). */
  container?: 'webm' | 'mp4';
  /** Write the sound alone — a tone with no video track — for a sound-only take. */
  soundOnly?: boolean;
}

export interface EncodedTake {
  blob: Blob;
  seconds: number;
  shape: string;
  hasAudio: boolean;
}

const BITRATE = 2_000_000;

/** A numbered solid colour per frame, so two cells of the strip are distinguishable. */
function drawFrame(ctx: CanvasRenderingContext2D, index: number, total: number, spec: FixtureSpec): void {
  const width = spec.width ?? 640;
  const height = spec.height ?? 360;
  const hue = Math.round((index / total) * 360);
  ctx.fillStyle = `hsl(${hue} 70% 45%)`;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(height / 6)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), width / 2, height / 2);
}

/** A short tone, so a take can carry sound for the waveform and the mixed export. */
async function tone(seconds: number, sampleRate = 48_000): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 440;
  oscillator.connect(context.destination);
  oscillator.start(0);
  oscillator.stop(seconds);
  return context.startRendering();
}

export async function encodeTake(spec: FixtureSpec): Promise<EncodedTake> {
  const fps = spec.fps ?? 30;
  const frames = Math.max(1, Math.round(spec.seconds * fps));
  const mp4 = spec.container === 'mp4';
  const soundOnly = !!spec.soundOnly;
  const hasAudio = soundOnly || !!spec.hasAudio;

  const output = new Output({
    format: mp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let video: CanvasSource | null = null;
  if (!soundOnly) {
    canvas = document.createElement('canvas');
    canvas.width = spec.width ?? 640;
    canvas.height = spec.height ?? 360;
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('fixture: no 2D context');
    video = new CanvasSource(canvas, {
      codec: mp4 ? 'avc' : 'vp8',
      quality: new Quality({ bitrate: BITRATE }),
    });
    output.addVideoTrack(video);
  }
  const sound = hasAudio
    ? new AudioBufferSource({ codec: mp4 ? 'aac' : 'opus', quality: new Quality({ bitrate: 128_000 }) })
    : null;
  if (sound) output.addAudioTrack(sound);

  await output.start();
  if (video && ctx && canvas) {
    for (let i = 0; i < frames; i++) {
      drawFrame(ctx, i, frames, spec);
      await video.add(i / fps, 1 / fps);
    }
  }
  if (sound) await sound.add(await tone(spec.seconds));
  await output.finalize();

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('fixture: the encoder wrote no file');
  return {
    blob: new Blob([buffer], {
      type: soundOnly ? (mp4 ? 'audio/mp4' : 'audio/webm') : mp4 ? 'video/mp4' : 'video/webm',
    }),
    seconds: spec.seconds,
    shape: soundOnly ? '0×0' : `${spec.width ?? 640}×${spec.height ?? 360}`,
    hasAudio,
  };
}
