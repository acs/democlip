// Keeping an image annotation's picture, named without IndexedDB.
//
// The picture is megabytes and never changes once it is chosen — exactly like a take —
// so it is written once, apart from the clip's small half (the cuts and the annotation
// geometries, which change on every drag). That split is what `src/infra/recording-store.ts`
// was built for; this port is the picture's half of it.
//
// The annotation itself carries only an `imageId`; the bytes are here, addressed by it.

export interface StoredImage {
  readonly id: string;
  readonly blob: Blob;
}

export interface ImageStorePort {
  /** Write a picture once, under its id. Rejects when the picture cannot be read. */
  put(id: string, blob: Blob): Promise<void>;
  /** Every kept picture, for a restore. */
  all(): Promise<StoredImage[]>;
}
