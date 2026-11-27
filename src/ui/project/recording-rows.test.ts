import { describe, expect, it } from 'vitest';

import { formatLength, recordingLabel, recordingRows } from './recording-rows.js';
import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import type { RecordingSummary } from '../../application/recordings.js';

const recording = (overrides: Partial<RecordingSummary> = {}): RecordingSummary => ({
  id: 'r1',
  projectId: 'p1',
  profile: ClipProfile.DEFAULT.stored(),
  createdAt: new Date('2026-11-27T14:32:00Z').getTime(),
  duration: 127,
  count: 2,
  title: '',
  state: 'finished',
  ...overrides,
});

describe('recordingRows', () => {
  it('uses the clip’s own title when it has one', () => {
    expect(recordingLabel(recording({ title: '  Hello  ' }), 'Launch')).toBe('Hello');
  });

  it('falls back to the project’s name and when it was made', () => {
    const label = recordingLabel(recording(), 'Launch');

    expect(label.startsWith('Launch · ')).toBe(true);
    expect(label.length).toBeGreaterThan('Launch · '.length);
  });

  it('reads a length as minutes and seconds, and hours past one', () => {
    expect(formatLength(0)).toBe('0:00');
    expect(formatLength(7)).toBe('0:07');
    expect(formatLength(127)).toBe('2:07');
    expect(formatLength(3723)).toBe('1:02:03');
    expect(formatLength(-4)).toBe('0:00');
  });

  it('names the profile a recording was made under, and its state', () => {
    const tv = ClipProfile.create('tv', 'DemoTV', {})!.stored();
    const rows = recordingRows([
      recording({ id: 'a', projectId: 'default', profile: tv, state: 'in-progress' }),
      recording({ id: 'b', projectId: 'p1' }),
    ], 'Launch');

    expect(rows[0]!.profileName).toBe('DemoTV');
    expect(rows[0]!.state).toBe('in-progress');
    expect(rows[1]!.state).toBe('finished');
  });
});
