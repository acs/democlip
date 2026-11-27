// What the recording store has written down for the open recording.
//
// The e2e checks reach the real IndexedDB rather than a test hook: the app keeps one
// pointer to the recording it is on, and one small record per recording. This reads both,
// so a check can await the debounced write and then assert what a reload will find.

import type { Page } from '@playwright/test';

export interface StoredRecording {
  properties?: Record<string, string>;
  annotations?: Array<{ kind: string }>;
}

export const storedRecording = (page: Page): Promise<StoredRecording | null> =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opened = indexedDB.open('democlip');
      opened.onsuccess = () => resolve(opened.result);
      opened.onerror = () => reject(opened.error);
    });
    if (!db.objectStoreNames.contains('app') || !db.objectStoreNames.contains('recordingMeta')) return null;
    const pointer = await new Promise<{ recordingId: string } | undefined>((resolve, reject) => {
      const request = db.transaction('app', 'readonly').objectStore('app').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!pointer) return null;
    return await new Promise<StoredRecording | null>((resolve, reject) => {
      const request = db.transaction('recordingMeta', 'readonly')
        .objectStore('recordingMeta')
        .get(pointer.recordingId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  });