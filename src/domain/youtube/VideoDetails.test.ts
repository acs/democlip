import { describe, expect, it } from 'vitest';

import { Visibility } from './Visibility.js';
import {
  CATEGORY_ID, DESCRIPTION_MAX, TITLE_MAX, VideoDetails, defaultTitle, watchUrl,
} from './VideoDetails.js';

const when = new Date('2026-11-21T10:30:00.000Z');

describe('VideoDetails', () => {
  it('is the title, the description and the visibility the person chose', () => {
    const details = VideoDetails.of({ title: 'A demo', description: 'What it shows', visibility: Visibility.of('unlisted') }, when);
    expect(details.title).toBe('A demo');
    expect(details.description).toBe('What it shows');
    expect(details.visibility.name).toBe('unlisted');
  });

  it('starts at private when the person said nothing about it', () => {
    expect(VideoDetails.of({}, when).visibility.name).toBe('private');
  });

  it('defaults a blank title rather than uploading an untitled video', () => {
    expect(VideoDetails.of({}, when).title).toBe(defaultTitle(when));
    expect(VideoDetails.of({ title: '   ' }, when).title).toBe(defaultTitle(when));
    // The default is the app's name and the moment, so two clips do not collide.
    expect(defaultTitle(when)).toBe('DemoClip 2026-11-21 10:30');
  });

  it('takes a title right at the limit and refuses one over it', () => {
    expect(VideoDetails.of({ title: 'x'.repeat(TITLE_MAX) }, when).title.length).toBe(TITLE_MAX);
    expect(() => VideoDetails.of({ title: 'x'.repeat(TITLE_MAX + 1) }, when)).toThrow(/at most 100 characters/);
  });

  it('takes a description right at the limit and refuses one over it', () => {
    expect(VideoDetails.of({ description: 'x'.repeat(DESCRIPTION_MAX) }, when).description.length).toBe(DESCRIPTION_MAX);
    expect(() => VideoDetails.of({ description: 'x'.repeat(DESCRIPTION_MAX + 1) }, when)).toThrow(/at most 5000 characters/);
  });

  it('an empty description is the absence of one, not a refusal', () => {
    expect(VideoDetails.of({}, when).description).toBe('');
  });

  it('always sends a privacyStatus, because an unset one means public to YouTube', () => {
    const record = VideoDetails.of({}, when).record();
    expect(record.status.privacyStatus).toBe('private');
    expect(record.snippet).toEqual({
      title: defaultTitle(when),
      description: '',
      categoryId: CATEGORY_ID,
    });
  });

  it('sends the visibility the person chose, and no other', () => {
    const record = VideoDetails.of({ visibility: Visibility.of('public') }, when).record();
    expect(record.status.privacyStatus).toBe('public');
  });

  it('addresses an uploaded video by the id YouTube gave it', () => {
    expect(watchUrl('abc123')).toBe('https://youtu.be/abc123');
  });
});
