// Stand-ins for what a machine cannot drive: the share picker and the devices.
//
// `getDisplayMedia` needs a user gesture and a browser pane, so a check never opens
// the picker. It stands in for what comes *back* from one — a canvas stream — which
// is where the app's handling lives, and where the recent regressions were.

import type { Page } from '@playwright/test';

export interface StandInShareOptions {
  /** Resolve a stream with no audio track, so the app reports a silent share. */
  silent?: boolean;
  width?: number;
  height?: number;
  /**
   * Report a different size from the track's settings than the picture really is,
   * as a display track does until a tab's first frame lands — so a check can prove
   * the app sizes the capture from the picture, not from the settings.
   */
  settingsSize?: { width: number; height: number };
}

interface AskedWindow {
  __e2eAskedFor?: DisplayMediaStreamOptions | null;
  __e2eActivationAtShare?: boolean | null;
}

/** Install before `boot.goto()`, so the stand-in is in place before the app loads. */
export async function installStandInShare(page: Page, options: StandInShareOptions = {}): Promise<void> {
  await page.addInitScript((opts: StandInShareOptions) => {
    const media = navigator.mediaDevices;
    if (!media) return;

    media.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
      (window as unknown as AskedWindow).__e2eAskedFor = constraints ?? null;
      // A browser only opens the picker for a transient activation, so whether the
      // call carried one is the half of the picker a check *can* hold. Read here,
      // where the app's own call is made.
      (window as unknown as AskedWindow).__e2eActivationAtShare = navigator.userActivation?.isActive ?? null;

      const canvas = document.createElement('canvas');
      canvas.width = opts.width ?? 1280;
      canvas.height = opts.height ?? 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#3366ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(canvas.width * 0.3, canvas.height * 0.3, canvas.width * 0.4, canvas.height * 0.4);
      }

      const stream = canvas.captureStream(30);

      if (opts.settingsSize) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const real = track.getSettings.bind(track);
          track.getSettings = () => ({ ...real(), width: opts.settingsSize!.width, height: opts.settingsSize!.height });
        }
      }

      if (!opts.silent) {
        try {
          const audio = new AudioContext();
          const destination = audio.createMediaStreamDestination();
          const oscillator = audio.createOscillator();
          oscillator.connect(destination);
          oscillator.start();
          for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
        } catch {
          // No audio available; the share is silent, which is itself worth covering.
        }
      }

      return stream;
    };
  }, options);
}

export interface StandInMicOptions {
  /**
   * The tone's frequency, in Hz. A value of the check's own, so a mix of this and the share's
   * audio can be read one tone at a time.
   */
  frequency?: number;
  /** The tone's amplitude, 0…1 — a quiet one, as a voice a little far from the microphone. */
  amplitude?: number;
}

/**
 * A **synthesized microphone**: an audio request to `getUserMedia` comes back as a steady tone
 * of a known frequency and level. Chromium's fake device is a beep of no known shape, which is
 * enough to prove that *a* sound arrives and not enough to say how loud a voice lands beside a
 * shared tab's own audio. A request carrying a picture is passed through to the real one.
 *
 * Install before `boot.goto()`, so the stand-in is in place before the app loads.
 */
export async function installStandInMic(page: Page, options: StandInMicOptions = {}): Promise<void> {
  await page.addInitScript((opts: StandInMicOptions) => {
    const media = navigator.mediaDevices;
    if (!media) return;
    const real = media.getUserMedia.bind(media);

    media.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (!constraints?.audio) return real(constraints);      // a picture is the browser's own

      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = opts.frequency ?? 700;
      const gain = context.createGain();
      gain.gain.value = opts.amplitude ?? 0.05;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      void context.resume();                                  // a context built outside a gesture

      const track = destination.stream.getAudioTracks()[0];
      const stream = new MediaStream(track ? [track] : []);
      if (constraints.video) {
        const video = await real({ video: constraints.video });
        for (const one of video.getVideoTracks()) stream.addTrack(one);
      }
      return stream;
    };
  }, options);
}

export interface StandInCameraOptions {
  /**
   * What this camera tops out at: the size it hands back whatever it is asked, as a
   * modest camera does when the app names a size it does not have. Left out, the ask
   * goes to the browser's real device — Chromium's fake one under the suite — so a
   * check can see what a plain camera does with it.
   */
  topOut?: { width: number; height: number };
}

interface AskedCameraWindow extends AskedWindow {
  __e2eWebcamFor?: MediaStreamConstraints | null;
}

/**
 * A **stand-in camera**, and the ask it heard. A `getUserMedia` request carrying a
 * picture is recorded here first, then either handed to the real device or answered
 * with a canvas stream of the camera's own size — which is how a camera that cannot
 * meet the app's request answers: with what it has, not with a failure.
 *
 * Install before `boot.goto()`, so the stand-in is in place before the app loads.
 */
export async function installStandInCamera(page: Page, options: StandInCameraOptions = {}): Promise<void> {
  await page.addInitScript((opts: StandInCameraOptions) => {
    const media = navigator.mediaDevices;
    if (!media) return;
    const real = media.getUserMedia.bind(media);

    media.getUserMedia = async (constraints: MediaStreamConstraints = {}) => {
      if (!constraints.video) return real(constraints);       // the microphone is the browser's
      (window as unknown as AskedCameraWindow).__e2eWebcamFor = constraints;
      const topOut = opts.topOut;
      if (!topOut) return real(constraints);

      const canvas = document.createElement('canvas');
      canvas.width = topOut.width;
      canvas.height = topOut.height;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#3366ff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      return canvas.captureStream(30);
    };
  }, options);
}

/**
 * The constraints the app passed to `getUserMedia` for a picture, or null if it asked
 * for none — the camera half of `askedFor`.
 */
export async function webcamAskedFor(page: Page): Promise<MediaTrackConstraints | null> {
  return page.evaluate(() => {
    const asked = (window as unknown as AskedCameraWindow).__e2eWebcamFor;
    return asked?.video && typeof asked.video === 'object' ? asked.video : null;
  });
}

/** The constraints the app passed to `getDisplayMedia`, or null if it was not asked. */export async function askedFor(page: Page): Promise<DisplayMediaStreamOptions | null> {
  return page.evaluate(() => (window as unknown as AskedWindow).__e2eAskedFor ?? null);
}

/**
 * Did the call to `getDisplayMedia` carry a transient user activation? A browser only
 * opens the picker for one, so this is the half of the picker a check can hold — the
 * other half is the person choosing, which is theirs.
 */
export async function activationAtShare(page: Page): Promise<boolean | null> {
  return page.evaluate(() => (window as unknown as AskedWindow).__e2eActivationAtShare ?? null);
}

/**
 * Make every `AudioContext` come up suspended, as a browser strict about autoplay
 * hands one back, and let a `resume()` bring it round. Chromium under the suite
 * starts contexts running, so a check for what an app does with a suspended one has
 * no other way to see it. `suspend()` is awaited before `resume()` runs: the two are
 * control messages, and a resume that overtook its suspend would make the stand-in
 * hand back something the real browser never would.
 */
export async function installSuspendedAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pending = new WeakMap<AudioContext, Promise<void>>();
    const Real = window.AudioContext;

    class SuspendedFirst extends Real {
      constructor(options?: AudioContextOptions) {
        super(options);
        pending.set(this, super.suspend());
      }

      override resume(): Promise<void> {
        const suspended = pending.get(this) ?? Promise.resolve();
        return suspended.then(() => super.resume());
      }
    }

    window.AudioContext = SuspendedFirst as unknown as typeof AudioContext;
  });
}
