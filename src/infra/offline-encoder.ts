// The encoder adapter: Mediabunny and WebCodecs, offline.
//
// It encodes the plan and draws nothing itself. The annotations, the dissolve and
// the preview come from the FrameRendererPort the composition root injects, so this
// module imports no view.

import {
  AudioBufferSource, BufferSource, BufferTarget, CanvasSource, Input, MP4, Mp4OutputFormat, Output,
  Quality, VideoSampleSink, WEBM, WebMOutputFormat,
} from 'mediabunny';
import type { ExportPlan, ExportStep } from '../domain/clip/ExportPlan.js';
import type { Take } from '../domain/clip/Take.js';
import { ClipSize } from '../domain/clip/ClipSize.js';
import type { Frame } from '../domain/clip/ClipSize.js';
import type { ExportTarget } from '../domain/export/ExportTarget.js';
import type {
  EncodedVideo, EncoderPort, ExportStats, FrameRendererPort, EncodeOptions,
} from '../application/ports/EncoderPort.js';
import { fitsBudget as budgetFits, specFor, videoBitrate } from './export-target.js';
import type { VideoCodecChoice } from './export-target.js';
import { firstPresentedSample } from './first-sample.js';
import { gainOf, measureKept } from './sound-boost.js';

const AUDIO_BITRATE = 128_000;
const KEYFRAME_S = 2;
const SAMPLE_RATE = 48_000;
const REPORT_EVERY = 8;
/** The card at the head of a file is drawn at this rate — a still, so it costs little. */
const INTRO_FPS = 30;
/** The rate a sound-only stretch is filled at in a file that has a picture elsewhere. */
const BLACK_FPS = 30;

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

    // A clip of sound-only takes is written as a sound file: no canvas, no video codec,
    // and no title card, which is a picture drawn over another picture.
    if (plan.soundOnly) return encodeSound(plan, target, spec, started, options.onProgress);

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
            intro: { title: plan.intro.title, description: plan.intro.description, stamp: plan.intro.stamp, logo: plan.intro.logo },
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
        // A sound-only take in a clip that has a picture elsewhere: its stretch is
        // written as black, the way a video player with no frame would show it, and its
        // sound still comes through the audio track.
        if (!track) {
          frames += await addBlackFrames(plan, context, video, renderer, step);
          continue;
        }
        const first = await input.getFirstTimestamp();
        const to = step.localTo + first;

        for await (const frame of new VideoSampleSink(track).samples(first, to)) {
          try {
            const source = plan.startOf(step.takeIndex) + (frame.timestamp - first);
            const at = plan.outputTimeOf(source);
            if (at < -0.001 || at > plan.total + 0.001) continue;

            const alpha = step.joinAt === null ? null : renderer.dissolve(context, at - step.joinAt);
            if (alpha === null) {
              // No dissolve in play: the letterbox around a take of another shape is
              // the clip's background, not the frame the last take left behind.
              context.globalAlpha = 1;
              context.fillStyle = '#000';
              context.fillRect(0, 0, canvas.width, canvas.height);
            }
            const fit = fitIn(canvas.width, canvas.height, { width: frame.displayWidth, height: frame.displayHeight });
            context.globalAlpha = alpha ?? 1;
            frame.draw(context, fit.x, fit.y, fit.width, fit.height);
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
 * A **sound-only** clip written as a sound file: the audio track alone, in the
 * container the target names — WebM's Opus, or MP4's AAC — and no video track at all.
 * The file is what a person hears, which is the whole of the clip.
 */
async function encodeSound(
  plan: ExportPlan,
  target: ExportTarget,
  spec: ReturnType<typeof specFor>,
  started: number,
  onProgress?: (source: number) => void,
): Promise<EncodedVideo> {
  if (!plan.audio) throw new Error('this clip has no sound to write');
  const audio = await renderAudio(plan);
  if (!audio) throw new Error('the sound could not be read back from the takes');

  const output = new Output({
    format: target === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const sound = new AudioBufferSource({ codec: spec.audio, quality: new Quality({ bitrate: AUDIO_BITRATE }) });
  output.addAudioTrack(sound);
  await output.start();
  await sound.add(audio);
  await output.finalize();
  onProgress?.(plan.to);

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('the encoder wrote no file');
  const blob = new Blob([buffer], { type: target === 'mp4' ? 'audio/mp4' : 'audio/webm' });
  const ms = performance.now() - started;
  return {
    blob,
    stats: {
      bytes: blob.size,
      seconds: plan.total,
      frames: 0,
      realtime: plan.total > 0 ? plan.total * 1000 / ms : 0,
    },
  };
}

/**
 * A stretch of a **sound-only** take, inside a file that has a picture elsewhere: black
 * frames at the take's place on the output timeline, with whatever is drawn over the
 * clip, so the file's picture and sound stay in step across the join.
 */
async function addBlackFrames(
  plan: ExportPlan,
  context: CanvasRenderingContext2D,
  video: CanvasSource,
  renderer: FrameRendererPort,
  step: ExportStep,
): Promise<number> {
  let frames = 0;
  for (const piece of plan.pieces) {
    if (piece.takeIndex !== step.takeIndex) continue;
    const end = piece.at + (piece.to - piece.from);
    for (let at = piece.at; at < end - 0.0001; at += 1 / BLACK_FPS) {
      const duration = Math.min(1 / BLACK_FPS, end - at);
      const source = piece.from + (at - piece.at);
      context.globalAlpha = 1;
      context.fillStyle = '#000';
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      renderer.draw(context, {
        sourceTime: source,
        outputTime: at,
        annotations: plan.annotationsAt(source),
        recordingLength: plan.recordingLength,
      });
      renderer.preview(context);
      await video.add(at, duration);
      frames++;
    }
  }
  return frames;
}

/**
 * The rectangle a sample is drawn into for the export's picture: the whole of it,
 * scaled and centred, with the clip's background around it. The picture edge is the
 * one that runs out first, so nothing is cropped and nothing is stretched.
 */
function fitIn(width: number, height: number, picture: { width: number; height: number }): Frame {
  const size = ClipSize.of(width, height);
  return size ? size.frameFor(picture) : { x: 0, y: 0, width, height };
}

/**
 * The first kept frame of the export, held on a canvas of the export's own size — what
 * the title card draws as its background. Null when no kept take has a picture to take one
 * from. The stretches are walked until one has a picture, since a **sound-only** take may
 * be the first and the card is drawn on the first picture the clip holds. A detached canvas
 * rather than the decoder's own sample, so it stays valid after the input is disposed.
 */
async function firstStill(
  plan: ExportPlan,
  takes: readonly Take[],
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  for (const piece of plan.pieces) {
    const input = new Input({
      source: new BufferSource(await takes[piece.takeIndex].blob.arrayBuffer()),
      formats: [WEBM, MP4],
    });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) continue;
      const first = await input.getFirstTimestamp();
      const sample = await firstPresentedSample(new VideoSampleSink(track), first + piece.from);
      if (!sample) continue;
      const still = document.createElement('canvas');
      still.width = width;
      still.height = height;
      const stillContext = still.getContext('2d');
      if (!stillContext) { sample.close(); continue; }
      stillContext.fillStyle = '#000';
      stillContext.fillRect(0, 0, width, height);
      const fit = fitIn(width, height, { width: sample.displayWidth, height: sample.displayHeight });
      sample.draw(stillContext, fit.x, fit.y, fit.width, fit.height);
      sample.close();
      return still;
    } finally {
      input.dispose();
    }
  }
  return null;
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
  const mixed = await context.startRendering();
  // The clip's own switch: bring the sound to the target with peak safety. It is one gain over
  // the mix, measured from the takes the mix was decoded from, so the export measures exactly
  // what the review does and pays no second decode for it.
  if (!plan.soundBoost) return mixed;
  const gain = gainOf(measureKept(decoded, plan.localPieces()));
  if (gain === 1) return mixed;
  for (let c = 0; c < mixed.numberOfChannels; c++) {
    const data = mixed.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return mixed;
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
