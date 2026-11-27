// How much room the browser is giving this origin, and how much of it the app is using.
//
// `navigator.storage.estimate()` is the browser's own guess rather than a measurement: it
// counts everything this origin holds — the recordings in IndexedDB, the cache, the service
// worker — and the room the browser would allow it. Both move as another tab writes and as
// the disk fills, so what the overview shows is approximate by nature.
//
// It is the browser boundary and nothing more: no rules live here. A browser that does not
// offer the call, or answers without a usable quota, gives null rather than a wrong number,
// so the overview shows nothing instead of an invented one.

export interface StorageReading {
  /** The bytes this origin is using, as the browser reckons them. */
  readonly usage: number;
  /** The bytes the browser is willing to give this origin. */
  readonly quota: number;
}

/** What the browser says about this origin's storage, or null when it will not say. */
export async function storageReading(): Promise<StorageReading | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const usage = estimate?.usage;
    const quota = estimate?.quota;
    // A zero or missing quota says the browser did not really answer: there is no readout
    // to show, and dividing by it later would give nonsense.
    if (typeof usage !== 'number' || typeof quota !== 'number' || !(quota > 0)) return null;
    return { usage, quota };
  } catch {
    return null;
  }
}
