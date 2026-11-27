// How much room the recordings are using, as the project overview shows it.
//
// Presentation only, so it sits beside the overview's other drawing rules rather than in the
// domain: it turns the two byte counts the browser gives into the words a person reads. The
// unit follows the size, so a few megabytes are not shown as 0 GB and a large quota is not
// shown as 20000 MB, and the number keeps a decimal only while the figure is small enough for
// it to mean something — 1.5 GB reads as itself, 120 MB does not need one.

import type { StorageReading } from '../../infra/storage.js';

const KB = 1_000;
const MB = 1_000_000;
const GB = 1_000_000_000;

/** A byte count as a person reads it: 0 B, 512 kB, 4.1 MB, 120 MB, 2 GB. */
export function formatBytes(bytes: number): string {
  const whole = Math.max(0, bytes);
  if (whole >= GB) return inUnit(whole, GB, 'GB');
  if (whole >= MB) return inUnit(whole, MB, 'MB');
  if (whole >= KB) return inUnit(whole, KB, 'kB');
  return `${Math.round(whole)} B`;
}

/** The count in one unit: a whole number, or one decimal below ten and a trailing zero dropped. */
function inUnit(bytes: number, scale: number, unit: string): string {
  const value = bytes / scale;
  const shown = value >= 10
    ? String(Math.round(value))
    : value.toFixed(1).replace(/\.0$/, '');
  return `${shown} ${unit}`;
}

/** The overview's storage sentence, or null when there is no reading to show. */
export function storageLine(reading: StorageReading | null): { used: string; total: string } | null {
  if (!reading) return null;
  return { used: formatBytes(reading.usage), total: formatBytes(reading.quota) };
}
