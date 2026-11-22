// The card's logo, decoded once and drawn on every frame of the card.
//
// A logo is a file the app serves itself (`ui/logos.ts`), so it is loaded **by name** from the
// app's own folder: nothing is uploaded, and nothing comes from anywhere else. It is decoded
// before the first frame is encoded, the way an image annotation's picture is, so the card's
// very first frame wears it — a card is read the moment it appears.
//
// A logo that will not load draws nothing and the export goes on: a missing file is the same
// outcome as a clip with no logo, which is the ordinary case.

import { logoFile } from '../logos.js';

const decoded = new Map<string, HTMLImageElement>();

/** The decoded logo a name means, or null while it is not loaded — or will not load. */
export function logoImage(name: string): HTMLImageElement | null {
  return decoded.get(name) ?? null;
}

/** Load and decode the logo a name means. Nothing at all for '', or for a name with no file. */
export async function loadLogo(name: string): Promise<void> {
  if (!name || decoded.has(name)) return;
  const file = logoFile(name);
  if (!file) return;
  const image = new Image();
  image.src = file;
  try {
    await image.decode();
    decoded.set(name, image);
  } catch {
    // Nothing to do and nothing to say: the card is drawn without it.
  }
}
