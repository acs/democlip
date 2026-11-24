// Keeping a clip across a page load, named without IndexedDB.

import type { Clip, ClipSnapshot } from '../../domain/clip/Clip.js';

export interface KeptClipPort {
  saveTake(clip: Clip, index: number): Promise<void>;
  saveMeta(clip: Clip): Promise<void>;
  saveClip(clip: Clip): Promise<void>;
  load(): Promise<ClipSnapshot | null>;
  clear(): Promise<void>;
}
