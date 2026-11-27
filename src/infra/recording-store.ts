// Where recordings outlive the page: IndexedDB.
//
// A project is a body of work, so the store holds many recordings, not one. Each is
// kept under its own id: the small half (cuts, annotations, properties, the profile
// snapshot, the project) in one store, the take blobs in another, and the pictures an
// image annotation draws in a third. A take is megabytes and never changes; the small
// half is a few kilobytes and moves on every cut. Written apart, a cut writes nothing
// but itself, and a take is written once as it arrives.
//
// The **open pointer** says which recording the sitting is on. It is written in the same
// transaction as a recording's first meta, so a crash leaves either both or neither.
//
// The previous version's single clip lives in the old `takes`, `meta` and `images`
// stores. They are read once by the migration and then cleared; nothing else reads them.
//
// This is deliberately the browser boundary and nothing more: no rules live here, and a
// failure to write is reported to the caller rather than swallowed.

import type { Clip, ClipSnapshot } from '../domain/clip/Clip.js';
import type { Picture } from '../domain/clip/ClipSize.js';
import type { StoredAnnotation } from '../domain/annotation/Annotation.js';
import { ClipProfile } from '../domain/clip/ClipProfile.js';
import type {
  LegacyRecording,
  LoadedRecording,
  OpenRecording,
  RecordingHeader,
  RecordingPlace,
  RecordingStorePort,
  StoredRecordingMeta,
} from '../application/ports/RecordingStorePort.js';
import { takeFile } from './take-file.js';

const DB_NAME = 'democlip';
const DB_VERSION = 4;          // 4 gives each recording its own id, and many of them
const RECORDINGS = 'recordingMeta';
const RECORDING_TAKES = 'recordingTakes';
const RECORDING_IMAGES = 'recordingImages';
const APP = 'app';
const APP_KEY = 'current';
const LEGACY_TAKES = 'takes';
const LEGACY_META = 'meta';
const LEGACY_IMAGES = 'images';
const LEGACY_META_KEY = 'current';
const FORMAT = 1;

/** One take as it is kept: the recording, how long it is, its picture and its sound. */
interface StoredTake {
  blob: Blob;
  duration: number;
  picture?: Picture;
  hasAudio?: boolean;
}

/** The previous version's small half. Read once, by the migration. */
interface LegacyMeta {
  version: number;
  count: number;
  cuts: Array<{ s: number; e: number }>;
  annotations?: StoredAnnotation[];
  properties?: Record<string, string>;
  watermark?: readonly string[];
  audio: boolean;
}

// One transaction at a time, in the order the calls came: a save queued before a clear
// has to land before it, not after.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => {});
  return run;
}

/** A take arrived: write it, the small half, and the pointer together. */
export function saveTake(recordingId: string, clip: Clip, index: number, place: RecordingPlace): Promise<void> {
  return serial(async () => {
    const take = clip.takes.at(index);
    if (!take) return;
    const db = await openDb();
    const tx = db.transaction([RECORDING_TAKES, RECORDINGS, APP], 'readwrite');
    tx.objectStore(RECORDING_TAKES).put(takeOf(take), [recordingId, index]);
    tx.objectStore(RECORDINGS).put(metaOf(clip, place), recordingId);
    tx.objectStore(APP).put(pointerOf(recordingId, place), APP_KEY);
    await txComplete(tx);
  });
}

/** The cuts moved: only the small half changes. */
export function saveMeta(recordingId: string, clip: Clip, place: RecordingPlace): Promise<void> {
  return serial(async () => {
    if (clip.takes.isEmpty()) return;
    const db = await openDb();
    const tx = db.transaction(RECORDINGS, 'readwrite');
    tx.objectStore(RECORDINGS).put(metaOf(clip, place), recordingId);
    await txComplete(tx);
  });
}

/** Write the whole recording down — every take that is not there yet, and the small half. */
export function saveAll(recordingId: string, clip: Clip, place: RecordingPlace): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const have = new Set(
      (await keysOf(db, RECORDING_TAKES))
        .filter((key): key is [string, number] => Array.isArray(key) && key[0] === recordingId)
        .map(key => key[1]),
    );
    const takes = clip.takes.all();
    const tx = db.transaction([RECORDING_TAKES, RECORDINGS, APP], 'readwrite');
    takes.forEach((take, index) => {
      if (have.has(index)) return;
      tx.objectStore(RECORDING_TAKES).put(takeOf(take), [recordingId, index]);
    });
    tx.objectStore(RECORDINGS).put(metaOf(clip, place), recordingId);
    tx.objectStore(APP).put(pointerOf(recordingId, place), APP_KEY);
    await txComplete(tx);
  });
}

/** One recording read back, or null when it is not there or not usable. */
export function loadRecording(recordingId: string): Promise<LoadedRecording | null> {
  return serial(async () => {
    const db = await openDb();
    const meta = await readMeta(db, recordingId);
    if (!meta || meta.version !== FORMAT || !(meta.count > 0)) return null;
    const takes = await readTakesFor(db, recordingId, meta.count);
    // Every take the small half counts has to be there, or the clip is not one to hand
    // back: a missing take would make every position after it wrong.
    if (takes.length !== meta.count || takes.some(take => !take || !(take.duration > 0))) return null;
    const kept = takes as StoredTake[];
    for (const take of kept) {
      if (take.picture && take.hasAudio !== undefined) continue;
      const info = await measured(take.blob);
      if (!take.picture) take.picture = info?.picture ?? undefined;
      if (take.hasAudio === undefined) take.hasAudio = info?.hasAudio ?? !!meta.audio;
    }
    const profile = ClipProfile.restore(meta.profile) ?? ClipProfile.DEFAULT;
    return {
      snapshot: {
        takes: kept,
        cuts: meta.cuts,
        annotations: meta.annotations ?? [],
        properties: meta.properties ?? {},
        watermark: meta.watermark ?? [],
        profile: profile.stored(),
      },
      projectId: meta.projectId,
      profile: profile.stored(),
      createdAt: meta.createdAt,
      title: meta.properties?.title ?? '',
    };
  }).catch(() => null);
}

/** Every recording's header, in the order they were made. */
export function listRecordings(): Promise<RecordingHeader[]> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction(RECORDINGS, 'readonly');
    const store = tx.objectStore(RECORDINGS);
    const keys = store.getAllKeys();
    const values = store.getAll();
    await txDone(tx);
    const ids = keys.result as IDBValidKey[];
    const metas = values.result as StoredRecordingMeta[];
    return metas
      .map((meta, at) => headerOf(String(ids[at]), meta))
      .sort((a, b) => a.createdAt - b.createdAt);
  }).catch(() => []);
}

/** Destroy one recording's bytes: takes, meta and pictures. */
export function deleteRecording(recordingId: string): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction([RECORDINGS, RECORDING_TAKES, RECORDING_IMAGES], 'readwrite');
    tx.objectStore(RECORDINGS).delete(recordingId);
    await deleteFor(tx, RECORDING_TAKES, recordingId);
    await deleteFor(tx, RECORDING_IMAGES, recordingId);
    await txComplete(tx);
  });
}

/** Move a recording to another project, without touching its bytes. */
export function setRecordingProject(recordingId: string, projectId: string): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction(RECORDINGS, 'readwrite');
    const store = tx.objectStore(RECORDINGS);
    const meta = await req<StoredRecordingMeta | undefined>(store.get(recordingId));
    if (!meta) { tx.abort(); throw new Error('that recording is not here'); }
    store.put({ ...meta, projectId }, recordingId);
    await txComplete(tx);
  });
}

/** The recording the sitting is on, or null. */
export function openRecording(): Promise<OpenRecording | null> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction(APP, 'readonly');
    const pointer = await req<OpenRecording | undefined>(tx.objectStore(APP).get(APP_KEY));
    return pointer && typeof pointer.recordingId === 'string' ? pointer : null;
  }).catch(() => null);
}

/** Point the sitting at a recording (or a draft). */
export function setOpenRecording(open: OpenRecording): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction(APP, 'readwrite');
    tx.objectStore(APP).put(open, APP_KEY);
    await txComplete(tx);
  });
}

/** There is no recording open: the last one is finished. */
export function clearOpenRecording(): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction(APP, 'readwrite');
    tx.objectStore(APP).delete(APP_KEY);
    await txComplete(tx);
  }).catch(() => {});
}

/** The previous version's one clip, or null when there is none to adopt. */
export function readLegacyRecording(): Promise<LegacyRecording | null> {
  return serial(async () => {
    const db = await openDb();
    const meta = await readLegacyMeta(db);
    if (!meta || meta.version !== FORMAT || !(meta.count > 0)) return null;
    const takes = await readLegacyTakes(db, meta.count);
    if (takes.length !== meta.count || takes.some(take => !take || !(take.duration > 0))) return null;
    const kept = takes as StoredTake[];
    for (const take of kept) {
      if (take.picture && take.hasAudio !== undefined) continue;
      const info = await measured(take.blob);
      if (!take.picture) take.picture = info?.picture ?? undefined;
      if (take.hasAudio === undefined) take.hasAudio = info?.hasAudio ?? !!meta.audio;
    }
    const images = await readLegacyImages(db);
    return {
      snapshot: {
        takes: kept,
        cuts: meta.cuts,
        annotations: meta.annotations ?? [],
        properties: meta.properties ?? {},
        watermark: meta.watermark ? [...meta.watermark] : [],
      },
      images,
    };
  }).catch(() => null);
}

/** Adopt the legacy clip under this id, in one transaction: meta, takes, pictures, pointer. */
export function adoptLegacyRecording(recordingId: string, legacy: LegacyRecording, place: RecordingPlace): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction([RECORDINGS, RECORDING_TAKES, RECORDING_IMAGES, APP], 'readwrite');
    tx.objectStore(RECORDINGS).put(metaFromSnapshot(legacy.snapshot, place), recordingId);
    legacy.snapshot.takes.forEach((take, index) => {
      tx.objectStore(RECORDING_TAKES).put(takeOf(take), [recordingId, index]);
    });
    for (const { id, blob } of legacy.images) {
      tx.objectStore(RECORDING_IMAGES).put(blob, [recordingId, id]);
    }
    tx.objectStore(APP).put(pointerOf(recordingId, place), APP_KEY);
    await txComplete(tx);
  });
}

/** The legacy stores are no longer needed. */
export function clearLegacyRecording(): Promise<void> {
  return serial(async () => {
    const db = await openDb();
    const tx = db.transaction([LEGACY_TAKES, LEGACY_META, LEGACY_IMAGES], 'readwrite');
    tx.objectStore(LEGACY_TAKES).clear();
    tx.objectStore(LEGACY_META).delete(LEGACY_META_KEY);
    tx.objectStore(LEGACY_IMAGES).clear();
    await txComplete(tx);
  }).catch(() => {});
}

/** The port the recordings use cases see. */
export const recordingStore: RecordingStorePort = {
  saveTake,
  saveMeta,
  saveAll,
  load: loadRecording,
  list: listRecordings,
  delete: deleteRecording,
  setProject: setRecordingProject,
  open: openRecording,
  setOpen: setOpenRecording,
  clearOpen: clearOpenRecording,
  readLegacy: readLegacyRecording,
  adopt: adoptLegacyRecording,
  clearLegacy: clearLegacyRecording,
};

// ── the small half ───────────────────────────────────────────────────────────

function metaOf(clip: Clip, place: RecordingPlace): StoredRecordingMeta {
  const snapshot = clip.snapshot();
  return {
    version: FORMAT,
    projectId: place.projectId,
    profile: place.profile,
    createdAt: place.createdAt,
    duration: clip.total(),
    count: clip.takes.count(),
    cuts: snapshot.cuts.map(span => ({ s: span.s, e: span.e })),
    annotations: snapshot.annotations ? snapshot.annotations.map(annotation => ({ ...annotation })) : [],
    properties: { ...(snapshot.properties ?? {}) },
    watermark: snapshot.watermark ? [...snapshot.watermark] : [],
    audio: clip.hasSound(),
  };
}

function metaFromSnapshot(snapshot: ClipSnapshot, place: RecordingPlace): StoredRecordingMeta {
  return {
    version: FORMAT,
    projectId: place.projectId,
    profile: place.profile,
    createdAt: place.createdAt,
    duration: snapshot.takes.reduce((total, take) => total + take.duration, 0),
    count: snapshot.takes.length,
    cuts: snapshot.cuts.map(span => ({ s: span.s, e: span.e })),
    annotations: (snapshot.annotations ?? []).map(annotation => ({ ...annotation })),
    properties: { ...(snapshot.properties ?? {}) },
    watermark: snapshot.watermark ? [...snapshot.watermark] : [],
    audio: snapshot.takes.some(take => !!take.hasAudio),
  };
}

function headerOf(id: string, meta: StoredRecordingMeta): RecordingHeader {
  return {
    id,
    projectId: meta.projectId,
    profile: ClipProfile.restore(meta.profile)?.stored() ?? ClipProfile.DEFAULT.stored(),
    createdAt: meta.createdAt,
    duration: meta.duration,
    count: meta.count,
    title: meta.properties?.title ?? '',
  };
}

function takeOf(take: { blob: Blob; duration: number; picture?: Picture | null; hasAudio?: boolean }): StoredTake {
  return {
    blob: take.blob,
    duration: take.duration,
    picture: take.picture ?? undefined,
    hasAudio: !!take.hasAudio,
  };
}

function pointerOf(recordingId: string, place: RecordingPlace): OpenRecording {
  return {
    recordingId,
    projectId: place.projectId,
    profile: place.profile,
    createdAt: place.createdAt,
  };
}

// ── the IndexedDB calls ──────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

/** The one open database: the recordings, their takes and pictures, and the pointer. */
export function openClipDb(): Promise<IDBDatabase> {
  return openDb();
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('this browser has no IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // The one-record store this replaced at version 3: gone, and nothing reads it.
      if (db.objectStoreNames.contains('clip')) db.deleteObjectStore('clip');
      for (const store of [RECORDINGS, RECORDING_TAKES, RECORDING_IMAGES, APP]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
      // The previous version's stores: kept so the migration can read them, and cleared
      // once it has. A fresh database gets them empty, so the migration can ask.
      for (const store of [LEGACY_TAKES, LEGACY_META, LEGACY_IMAGES]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('could not open the recording store'));
  });
  return dbPromise;
}

async function readMeta(db: IDBDatabase, id: string): Promise<StoredRecordingMeta | undefined> {
  const tx = db.transaction(RECORDINGS, 'readonly');
  return await req<StoredRecordingMeta | undefined>(tx.objectStore(RECORDINGS).get(id));
}

async function readTakesFor(db: IDBDatabase, id: string, count: number): Promise<Array<StoredTake | undefined>> {
  const keys = (await keysOf(db, RECORDING_TAKES))
    .filter((key): key is [string, number] => Array.isArray(key) && key[0] === id)
    .sort((a, b) => a[1] - b[1]);
  const tx = db.transaction(RECORDING_TAKES, 'readonly');
  const store = tx.objectStore(RECORDING_TAKES);
  const out: Array<StoredTake | undefined> = [];
  for (const key of keys.slice(0, count)) out.push(await req<StoredTake | undefined>(store.get(key)));
  return out;
}

async function readLegacyMeta(db: IDBDatabase): Promise<LegacyMeta | undefined> {
  if (!db.objectStoreNames.contains(LEGACY_META)) return undefined;
  const tx = db.transaction(LEGACY_META, 'readonly');
  return await req<LegacyMeta | undefined>(tx.objectStore(LEGACY_META).get(LEGACY_META_KEY));
}

async function readLegacyTakes(db: IDBDatabase, count: number): Promise<Array<StoredTake | undefined>> {
  if (!db.objectStoreNames.contains(LEGACY_TAKES)) return [];
  const tx = db.transaction(LEGACY_TAKES, 'readonly');
  return await req<Array<StoredTake | undefined>>(tx.objectStore(LEGACY_TAKES).getAll(null, count));
}

async function readLegacyImages(db: IDBDatabase): Promise<Array<{ id: string; blob: Blob }>> {
  if (!db.objectStoreNames.contains(LEGACY_IMAGES)) return [];
  const tx = db.transaction(LEGACY_IMAGES, 'readonly');
  const store = tx.objectStore(LEGACY_IMAGES);
  const keys = store.getAllKeys();
  const values = store.getAll();
  await txDone(tx);
  const ids = keys.result as IDBValidKey[];
  const blobs = values.result as Blob[];
  return ids.map((key, at) => ({ id: String(key), blob: blobs[at] }));
}

async function keysOf(db: IDBDatabase, store: string): Promise<IDBValidKey[]> {
  const tx = db.transaction(store, 'readonly');
  return await req<IDBValidKey[]>(tx.objectStore(store).getAllKeys());
}

async function deleteFor(tx: IDBTransaction, store: string, recordingId: string): Promise<void> {
  const objectStore = tx.objectStore(store);
  const keys = await req<IDBValidKey[]>(objectStore.getAllKeys());
  for (const key of keys) {
    if (Array.isArray(key) && key[0] === recordingId) objectStore.delete(key);
  }
}

// A read stands in for its request; a write stands in for its transaction, so the
// bytes are handed over before it is said to have happened.
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('the recording store refused'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('the recording store refused'));
    tx.onabort = () => reject(tx.error ?? new Error('the recording store gave up'));
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return txDone(tx);
}

/** A stored take's picture and sound, measured from its blob, or null when it will not say. */
async function measured(blob: Blob): Promise<{ picture?: Picture; hasAudio?: boolean } | null> {
  try {
    const info = await takeFile.inspect(blob);
    return { picture: info.picture ?? undefined, hasAudio: info.hasAudio };
  } catch {
    return null;
  }
}