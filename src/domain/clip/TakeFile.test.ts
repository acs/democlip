import { describe, expect, it } from 'vitest';
import { TakeFile } from './TakeFile.js';

describe('TakeFile', () => {
  it('takes the two containers the export can read back, for a picture or for sound only', () => {
    expect(TakeFile.of('clip.webm', 'video/webm')?.container).toBe('webm');
    expect(TakeFile.of('clip.mp4', 'video/mp4')?.container).toBe('mp4');
    expect(TakeFile.of('voice.webm', 'audio/webm')?.container).toBe('webm');
    expect(TakeFile.of('voice.mp4', 'audio/mp4')?.container).toBe('mp4');
  });

  it('reads past a codecs parameter', () => {
    expect(TakeFile.of('clip.webm', 'video/webm;codecs=vp9,opus')?.container).toBe('webm');
  });

  it('falls back to the name when the browser gives no type', () => {
    expect(TakeFile.of('clip.mp4', '')?.container).toBe('mp4');
    expect(TakeFile.of('clip.webm', '')?.container).toBe('webm');
    expect(TakeFile.of('clip.M4V', '')?.container).toBe('mp4');
  });

  it('refuses a container we do not take, whatever the name says', () => {
    expect(TakeFile.of('clip.mov', 'video/quicktime')).toBeNull();
    expect(TakeFile.of('clip.mkv', 'video/x-matroska')).toBeNull();
    expect(TakeFile.of('voice.mp3', 'audio/mpeg')).toBeNull();
    expect(TakeFile.of('voice.wav', 'audio/wav')).toBeNull();
  });

  it('refuses a file that is not a recording at all', () => {
    expect(TakeFile.of('notes.txt', 'text/plain')).toBeNull();
    expect(TakeFile.of('notes.txt', '')).toBeNull();
    expect(TakeFile.of('noextension', '')).toBeNull();
  });

  it('answers with the media type its bytes are', () => {
    expect(TakeFile.of('clip.webm', 'video/webm')?.mime).toBe('video/webm');
    expect(TakeFile.of('clip.mp4', 'video/mp4')?.mime).toBe('video/mp4');
    expect(TakeFile.of('voice.webm', 'audio/webm')?.mime).toBe('audio/webm');
    expect(TakeFile.of('voice.mp4', 'audio/mp4')?.mime).toBe('audio/mp4');
  });
});
