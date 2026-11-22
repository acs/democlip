// The encoder adapter: Mediabunny and WebCodecs, offline.
//
// It encodes the plan and draws nothing itself. The annotations, the dissolve and
// the preview come from the FrameRendererPort the composition root injects, so this
// module imports no view.

import {
  AudioBufferSource, BufferSource, BufferTarget, CanvasSource, Input, MP4, Mp4OutputFormat, Output,
  Quality, VideoSampleSink, WEBM, WebMOutputFormat,
} from 'mediabunny';
import type { ExportPlan } from '../domain/clip/ExportPlan.js';
import type { Take } from '../domain/clip/Take.js';
import type { ExportTarget } from '../domain/export/ExportTarget.js';
import type {
  EncodedVideo, EncoderPort, ExportStats, FrameRendererPort, EncodeOptions,
} from '../application/ports/EncoderPort.js';
import { fitsBudget as budgetFits, specFor, videoBitrate } from './export-target.js';
import type { VideoCodecChoice } from './export-target.js';

const AUDIO_BITRATE = 128_000;
const KEYFRAME_S = 2;
const SAMPLE_RATE = 48_000;
const REPORT_EVERY = 8;
/** The card at the head of a file is drawn at this rate — a still, so it costs little. */
const INTRO_FPS = 30;

export class EncoderAdapter implements EncoderPort {
  available(): boolean {
    return typeof VideoEncoder === 'function' && typeof AudioEncoder === 'function';
  }

  fitsBudget(
    target: ExportTarget,
    seconds: number,
    picture: { readonly width: number; readonly height: number },
    maxBytes: number,
  ): boolean {
    // The same picture and the same bitrate the encode below will take, so the answer
    // cannot disagree with what the file would come to.
    const size = specFor(target).picture(picture.width, picture.height);
    return budgetFits(size.width, size.height, { seconds, bytes: maxBytes });
  }

  async encode(plan: ExportPlan, renderer: FrameRendererPort, options: EncodeOptions): Promise<EncodedVideo> {
    const target = options.target;
    const spec = specFor(target);
    const started = performance.now();
    const takes = plan.takes;
    if (!plan.pieces.length) throw new Error('nothing to export');

    const canvas = document.createElement('canvas');
    const picture = spec.picture(options.width ?? 1280, options.height ?? 720);
    canvas.width = picture.width;
    canvas.height = picture.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2D context for the export');

    const bitrate = videoBitrate(canvas.width, canvas.height, options.maxBytes
      ? { seconds: plan.total, bytes: options.maxBytes }
      : undefined);
    const codec = await pickVideoCodec(spec, canvas.width, canvas.height, bitrate);
    if (!codec) throw new Error(`this browser cannot encode ${target.toUpperCase()} offline`);
    const audio = await renderAudio(plan);

    const output = new Output({
      format: target === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const video = new CanvasSource(canvas, {
      codec,
      quality: new Quality({ bitrate }),
      keyFrameInterval: KEYFRAME_S,
    });
    output.addVideoTrack(video);
    const sound = audio
      ? new AudioBufferSource({ codec: spec.audio, quality: new Quality({ bitrate: AUDIO_BITRATE }) })
      : null;
    if (sound) output.addAudioTrack(sound);

    await output.start();
    let frames = 0;

    // The card at the head, if the export has one: the first kept frame held still,
    // with the clip's title and description drawn over it by the renderer.
    if (plan.intro) {
      const still = await firstStill(plan, takes, canvas.width, canvas.height);
      if (still) {
        const step = 1 / INTRO_FPS;
        for (let at = 0; at < plan.intro.seconds - 0.0001; at += step) {
          const duration = Math.min(step, plan.intro.seconds - at);
          context.globalAlpha = 1;
          context.drawImage(still, 0, 0);
          renderer.draw(context, {
            sourceTime: 0,
            outputTime: at,
            annotations: [],
            recordingLength: plan.recordingLength,
            intro: { title: plan.intro.title, description: plan.intro.description },
          });
          renderer.preview(context);
          await video.add(at, duration);
          frames++;
        }
      }
    }

    for (const step of plan.steps) {
      if (step.joinAt !== null) renderer.hold(context);

      const input = new Input({
        source: new BufferSource(await takes[step.takeIndex].blob.arrayBuffer()),
        // A recorded take is a WebM; an imported one may be an MP4. Both are read
        // by the same decoder, so both are offered and the container decides.
        formats: [WEBM, MP4],
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error('a take has no video track');
        const first = await input.getFirstTimestamp();
        const to = step.localTo + first;

        for await (const frame of new VideoSampleSink(track).samples(first, to)) {
          try {
            const source = plan.startOf(step.takeIndex) + (frame.timestamp - first);
            const at = plan.outputTimeOf(source);
            if (at < -0.001 || at > plan.total + 0.001) continue;

            const alpha = step.joinAt === null ? null : renderer.dissolve(context, at - step.joinAt);
            context.globalAlpha = alpha ?? 1;
            frame.draw(context, 0, 0, canvas.width, canvas.height);
            context.globalAlpha = 1;
            renderer.draw(context, {
              sourceTime: source, outputTime: at, annotations: plan.annotationsAt(source),
              recordingLength: plan.recordingLength,
            });
            renderer.preview(context);

            await video.add(at, frame.duration);
            frames++;
            if (frames % REPORT_EVERY === 0) options.onProgress?.(source);
          } finally {
            frame.close();
          }
        }
      } finally {
        input.dispose();
      }
    }
    if (!frames) throw new Error('no frames came back from the takes');
    if (sound && audio) await sound.add(audio);
    await output.finalize();

    const buffer = output.target.buffer;
    if (!buffer) throw new Error('the encoder wrote no file');
    const blob = new Blob([buffer], { type: spec.mime });
    const ms = performance.now() - started;
    const stats: ExportStats = {
      bytes: blob.size,
      seconds: plan.total,
      frames,
      realtime: plan.total > 0 ? plan.total * 1000 / ms : 0,
    };
    return { blob, stats };
  }
}

/**
 * The first kept frame of the export, held on a canvas of the export's own size — what
 * the title card draws as its background. Null when the first take has no picture to take
 * one from. A detached canvas rather than the decoder's own sample, so it stays valid
 * after the input is disposed.
 */
async function firstStill(
  plan: ExportPlan,
  takes: readonly Take[],
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  const piece = plan.pieces[0];
  if (!piece) return null;
  const input = new Input({
    source: new BufferSource(await takes[piece.takeIndex].blob.arrayBuffer()),
    formats: [WEBM, MP4],
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const first = await input.getFirstTimestamp();
    const sample = await new VideoSampleSink(track).getSample(first + piece.from);
    if (!sample) return null;
    const still = document.createElement('canvas');
    still.width = width;
    still.height = height;
    const stillContext = still.getContext('2d');
    if (!stillContext) { sample.close(); return null; }
    sample.draw(stillContext, 0, 0, width, height);
    sample.close();
    return still;
  } finally {
    input.dispose();
  }
}

async function pickVideoCodec(
  spec: ReturnType<typeof specFor>,
  width: number,
  height: number,
  bitrate: number,
): Promise<VideoCodecChoice['name'] | null> {
  for (const choice of spec.video) {
    for (const probe of choice.probes(width, height)) {
      try {
        const support = await VideoEncoder.isConfigSupported({ codec: probe, width, height, bitrate });
        if (support.supported) return choice.name;
      } catch { /* an unknown codec */ }
    }
  }
  return null;
}

async function renderAudio(plan: ExportPlan): Promise<AudioBuffer | null> {
  if (!plan.audio) return null;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(plan.total * SAMPLE_RATE)), SAMPLE_RATE);
  const decoded = new Map<number, AudioBuffer | null>();
  for (let i = 0; i < plan.pieces.length; i++) {
    const piece = plan.pieces[i];
    let buffer = decoded.get(piece.takeIndex);
    if (buffer === undefined) {
      buffer = await decodeOrNull(context, plan.takes[piece.takeIndex].blob);
      decoded.set(piece.takeIndex, buffer);
    }
    // A take with no sound of its own — an imported video — is silence over its
    // stretch, not a reason to fail the whole export.
    if (!buffer) continue;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = 1;
    const length = piece.to - piece.from;
    if (plan.joinsPrev(i)) {
      gain.gain.setValueAtTime(0, piece.at);
      gain.gain.linearRampToValueAtTime(1, piece.at + Math.min(plan.fadeSeconds, length));
    }
    if (plan.joinsNext(i) && length > plan.fadeSeconds) {
      gain.gain.setValueAtTime(1, piece.at + length - plan.fadeSeconds);
      gain.gain.linearRampToValueAtTime(0, piece.at + length);
    }
    source.connect(gain).connect(context.destination);
    source.start(piece.at, piece.from - plan.startOf(piece.takeIndex), length);
  }
  return context.startRendering();
}

/** A take's sound, or null when it has none (an imported video, a silent file). */
async function decodeOrNull(context: BaseAudioContext, blob: Blob): Promise<AudioBuffer | null> {
  try {
    return await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

export const encoder = new EncoderAdapter();
