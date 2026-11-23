// Where a clip outlives the page: IndexedDB.
//
// A Bluesky sign-in leaves the page — the authorization server sends the browser
// away and back — and everything the page held in memory goes with it. The takes
// are the recording itself, the most valuable thing DemoClip has, so the clip is
// written down before that trip and read back on the way in.
//
// IndexedDB is the only store here that takes a Blob, which is what a take is;
// localStorage holds a string and a few megabytes at most. The record is the
// clip's own shape (`ClipSnapshot`), so nothing outside this module knows how it
// is kept — and the calls are serialized, because a save queued before a clear
// must not land after it.
//
// The takes and the clip's cuts are kept in two stores on purpose. A take is
// megabytes and never changes once recorded; the cuts are a few bytes and change
// on every cut. Written as one record, every cut re-writes the whole recording —
// measured at ~15 ms for 24 MB on a desktop, and worse on a phone. Written apart,
// a take is written once as it arrives and a cut writes nothing but itself.
//
// This is deliberately the browser boundary and nothing more: no rules live here,
// and a failure to write is reported to the caller rather than swallowed.

import type { Clip, ClipSnapshot } from '../domain/clip/Clip.js';
import type { Picture } from '../domain/clip/ClipSize.js';
import type { StoredAnnotation } from '../domain/annotation/Annotation.js';
import type { KeptClipPort } from '../application/ports/KeptClipPort.js';
import { takeFile } from './take-file.js';

const DB_NAME = 'democlip';
const DB_VERSION = 3;          // 3 adds the pictures an image annotation draws
const TAKES = 'takes';
const META = 'meta';
const IMAGES = 'images';
const META_KEY = 'current';
const FORMAT = 1;

/** A clip as it is kept: what it is made of, and whether it had sound. */
export interface StoredClip {
  clip: ClipSnapshot;
  audio: boolean;
}

/** One take as it is kept: the recording, how long it is, and the size of its picture. */
interface StoredTake {
  blob: Blob;
  duration: number;
  picture?: Picture;
}

/** The small half: how many takes, the cuts, the annotations, what it says, and the sound. */
interface Meta {
  version: number;
  count: number;
  cuts: Array<{ s: number; e: number }>;
  annotations?: StoredAnnotation[];
  properties?: Record<string, string>;
  /** The ids of the clip's **watermark** — the annotations it wears over the whole clip. */
  watermark?: readonly string[];
  audio: boolean;
}

// One transaction at a time, in the order the calls came: a save queued before a
// clear has to land before it, not after.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => {});
  return run;
}

/** A take arrived: write it down, and the clip's small half with it. */
export function saveTake(clip: Clip, index: number, audio: boolean): Promise<void> {
  return serial(async () => {
    const take = clip.takes.at(index);
    if (!take) return;
    const db = await openDb();
    const tx = db.transaction([TAKES, META], 'readwrite');
    const record: StoredTake = { blob: take.blob, duration: take.duration, picture: take.picture ?? undefined };
    tx.objectStore(TAKES).put(record, index);
    tx.objectStore(META).put(metaOf(clip, audio), META_KEY);
    await txComplete(tx);
  });
}

/** The cuts moved: only the small half changes. */
export function saveMeta(clip: Clip, audio: boolean): Promise<void> {
  return serial(async () => {
    if (clip.takes.isEmpty()) return;
    const db = await openDb();
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put(metaOf(clip, audio), META_KEY);
    await txComplete(tx);
  });
}

/**
 * Write the whole clip down — every take that is not there yet, and the small
 * half — in one transaction. This is what a sign-in asks for before it leaves
 * the page: it re-attempts any take an earlier write failed to keep, and it
 * settles on the transaction's completion, because the caller is about to go.
 */
export function saveClip(clip: Clip, audio: boolean): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const have = new Set(await keysOf(db, TAKES));
    const takes = clip.takes.all();
    const tx = db.transaction([TAKES, META], 'readwrite');
    takes.forEach((take, i) => {
      if (have.has(i)) return;
      const record: StoredTake = { blob: take.blob, duration: take.duration, picture: take.picture ?? undefined };
      tx.objectStore(TAKES).put(record, i);
    });
    tx.objectStore(META).put(metaOf(clip, audio), META_KEY);
    await txComplete(tx);
  });
}

/** The clip that was written down, or null when there is none usable. */
export function loadClip(): Promise<StoredClip | null> {
  return serial(async () => {
    const db = await openDb();
    const meta = await readMeta(db);
    if (!meta || meta.version !== FORMAT || !(meta.count > 0)) return null;
    const takes = await readTakes(db, meta.count);
    // Every take the small half counts has to be there, or the clip is not one
    // to hand back: a missing take would make every position after it wrong.
    if (takes.length !== meta.count || takes.some(take => !take || !(take.duration > 0))) return null;
    // A take written before the clip size existed carries no picture of its own;
    // measure it now, so the clip still knows the size to be shown and exported at.
    const kept = takes as StoredTake[];
    for (const take of kept) {
      if (!take.picture) take.picture = await measuredPicture(take.blob);
    }
    return { clip: { takes: kept, cuts: meta.cuts, annotations: meta.annotations ?? [], properties: meta.properties ?? {}, watermark: meta.watermark ?? [] }, audio: !!meta.audio };
  }).catch(() => null);
}

/** Nothing is kept any more. */
export function clearClip(): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction([TAKES, META, IMAGES], 'readwrite');
    tx.objectStore(TAKES).clear();
    tx.objectStore(META).delete(META_KEY);
    tx.objectStore(IMAGES).clear();
    await txComplete(tx);
  }).catch(() => {});
}

/** The port the keep and restore use cases see. */
export const keptClip: KeptClipPort = {
  saveTake,
  saveMeta,
  saveClip,
  load: loadClip,
  clear: clearClip,
};

/** A stored take's picture size, measured from its blob, or undefined when it will not say. */
async function measuredPicture(blob: Blob): Promise<Picture | undefined> {
  try { return (await takeFile.inspect(blob)).picture ?? undefined; } catch { return undefined; }
}

function metaOf(clip: Clip, audio: boolean): Meta {
  return {
    version: FORMAT,
    count: clip.takes.count(),
    cuts: clip.cuts.spans.map(span => ({ s: span.s, e: span.e })),
    annotations: clip.annotations.all.map(annotation => annotation.stored()),
    properties: clip.properties.toRecord(),
    watermark: clip.snapshot().watermark,
    audio,
  };
}

// ── the IndexedDB calls ──────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

/** The one open database: the takes, the small half, and the pictures. */
export function openClipDb(): Promise<IDBDatabase> {
  return openDb();
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('this browser has no IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // The one-record store this replaced: gone, and nothing reads it.
      if (db.objectStoreNames.contains('clip')) db.deleteObjectStore('clip');
      if (!db.objectStoreNames.contains(TAKES)) db.createObjectStore(TAKES);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('could not open the clip store'));
  });
  return dbPromise;
}

async function readMeta(db: IDBDatabase): Promise<Meta | undefined> {
  const tx = db.transaction(META, 'readonly');
  return await req<Meta | undefined>(tx.objectStore(META).get(META_KEY));
}

async function readTakes(db: IDBDatabase, count: number): Promise<Array<StoredTake | undefined>> {
  const tx = db.transaction(TAKES, 'readonly');
  // All of them, up to the count the small half gives, in key order — the order
  // they were recorded in.
  return await req<Array<StoredTake | undefined>>(tx.objectStore(TAKES).getAll(null, count));
}

async function keysOf(db: IDBDatabase, store: string): Promise<IDBValidKey[]> {
  const tx = db.transaction(store, 'readonly');
  return await req<IDBValidKey[]>(tx.objectStore(store).getAllKeys());
}

// A read stands in for its request; a write stands in for its transaction, so the
// bytes are handed over before it is said to have happened.
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('the clip store refused'));
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('the clip store refused'));
    tx.onabort = () => reject(tx.error ?? new Error('the clip store gave up'));
  });
}
