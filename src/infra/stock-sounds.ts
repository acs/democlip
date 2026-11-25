// Where the app's own sounds are kept, and the decoded buffer each is played from.
//
// A stock sound is the app's file, served **beside** it (`./sounds/…`, as the logos are), so
// nothing is uploaded and nothing is fetched from anywhere else. The bytes are read once and
// decoded once into an `AudioBuffer`, held by name: the review plays it and the export mixes
// it, each from the same decoded copy, so neither decodes it twice.
//
// A name the app does not serve, a fetch that fails and a decode that fails all answer the
// same way — **null** — and are cached as such: a sound that will not read is silence, never a
// failed clip or export. The store is the browser boundary and nothing more; no rules live
// here beyond keeping the cache consistent with what is read.

import { stockSound } from '../domain/sound/StockSounds.js';
import type { StockSoundPort } from '../application/ports/StockSoundPort.js';

/** The rate the app decodes and mixes at — the export's own mixing rate. */
const DECODE_RATE = 48_000;

export class StockSoundStore implements StockSoundPort {
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly inFlight = new Set<Promise<unknown>>();

  /** `decode` is injectable so the cache can be proved in node, with no browser. */
  constructor(private readonly decode: (file: string) => Promise<AudioBuffer | null> = decodeAtRate) {}

  /** The decoded sound for a name — decoding it once, and answering null when it will not read. */
  buffer(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name) ?? null);
    const file = stockSound(name)?.file;
    if (!file) { this.buffers.set(name, null); return Promise.resolve(null); }
    return this.track(this.decode(file).then(
      buffer => { this.buffers.set(name, buffer); return buffer; },
      () => { this.buffers.set(name, null); return null; },
    ));
  }

  /** The decoded sound if it is already there — never waits. */
  get(name: string): AudioBuffer | null {
    return this.buffers.get(name) ?? null;
  }

  /** Resolves when every sound asked for so far is decoded. */
  async ready(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  /** Let the decoded sounds go. */
  clear(): void {
    this.buffers.clear();
  }

  private track<T>(pending: Promise<T>): Promise<T> {
    this.inFlight.add(pending);
    void pending.finally(() => this.inFlight.delete(pending)).catch(() => {});
    return pending;
  }
}

/** Fetch the app's file for a sound and decode it at the mixing rate. Null on any failure. */
async function decodeAtRate(file: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(file);
    if (!response.ok) return null;
    return await decodeContext().decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}

let context: OfflineAudioContext | null = null;

/** One decode context, made lazily — the rate the buffers are held at. */
function decodeContext(): OfflineAudioContext {
  if (!context) context = new OfflineAudioContext(2, 1, DECODE_RATE);
  return context;
}

export const stockSounds = new StockSoundStore();
