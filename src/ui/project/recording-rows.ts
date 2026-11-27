// What a project's recording list draws, and the rules for drawing it.
//
// Two small rules live here, both free of the DOM so they can be read in node: the label a
// recording is listed under — its own title, or a fallback made from the project and when
// it was made — and the length a person reads. The row itself is assembled in
// `project-overview.ts`; what it says comes from here, so a check and the page agree.

import type { RecordingSummary } from '../../application/recordings.js';

export interface RecordingRow {
  readonly id: string;
  readonly title: string;
  readonly seconds: number;
  readonly state: 'in-progress' | 'finished';
  readonly projectId: string;
  /** The profile the recording was made under, by name. */
  readonly profileName: string;
}

/** The label a recording is listed under. */
export function recordingLabel(
  recording: Pick<RecordingSummary, 'title' | 'createdAt'>,
  projectName: string,
): string {
  const title = recording.title.trim();
  if (title !== '') return title;
  const when = new Date(recording.createdAt);
  const stamp = Number.isNaN(when.getTime())
    ? ''
    : ` · ${when.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  return `${projectName}${stamp}`;
}

/** A recording's length as a person reads it: 3:07, or 1:02:03 past an hour. */
export function formatLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}

/** The rows of a project's recordings, in the order the store gave them. */
export function recordingRows(
  recordings: readonly RecordingSummary[],
  projectName: string,
): RecordingRow[] {
  return recordings.map(recording => ({
    id: recording.id,
    title: recordingLabel(recording, projectName),
    seconds: recording.duration,
    state: recording.state,
    projectId: recording.projectId,
    profileName: recording.profile.name,
  }));
}