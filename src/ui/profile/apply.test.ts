import { describe, expect, it } from 'vitest';

import { applyClipProfile } from './apply.js';
import { ClipProfile } from '../../domain/clip/ClipProfile.js';
import { boostsSound } from '../../domain/sound/SoundBoost.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Take } from '../../domain/clip/Take.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';

// The rule that puts a profile's declarations on the clip, proved in node. It is the one place
// a profile reaches a clip, so what matters is what it does *not* touch: a clip with a take, an
// item the profile does not control, and a declaration for an item this build does not know.

class FakeTakes implements TakeRepository {
  private takes: Take[] = [];
  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) { for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i; return Math.max(0, this.takes.length - 1); }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

const under = (controls: Record<string, string>): Clip =>
  Clip.empty(new FakeTakes(), ClipProfile.create('tv', 'DemoClipTV', controls)!);

describe('applyClipProfile', () => {
  it('fixes an item the active profile controls onto an empty clip', () => {
    const clip = under({ addToExport: 'true' });
    applyClipProfile(clip);
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('fixes the colour a new annotation is made in, so the clip\'s arrows and text take it', () => {
    const clip = under({ annotationColour: '#3182ce' });
    applyClipProfile(clip);
    expect(clip.properties.get('annotationColour')).toBe('#3182ce');
  });

  it('leaves a clip that already holds a take exactly as it is', () => {
    const clip = under({ addToExport: 'true' });
    clip.addTake(new Blob(['x']), 2);
    applyClipProfile(clip);
    expect(clip.properties.get('addToExport')).toBe('');
  });

  it('leaves the clip’s own value when the profile does not control the item', () => {
    const clip = under({});
    clip.setProperty('addToExport', 'true');   // the person's, before any profile was chosen
    applyClipProfile(clip);
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('fixes an item the profile controls off, over what the clip held', () => {
    const clip = under({ addToExport: '' });
    clip.setProperty('addToExport', 'true');
    applyClipProfile(clip);
    expect(clip.properties.get('addToExport')).toBe('');
  });

  it('fixes the sound boost on, off or free, and tells the three apart', () => {
    const off = under({ soundBoost: '' });
    applyClipProfile(off);
    // The switch's default is on, so a profile fixing it off must store an explicit off —
    // otherwise "fixed off" and "never set" would be the same value on the clip.
    expect(off.properties.get('soundBoost')).toBe('false');
    expect(boostsSound(off.properties)).toBe(false);

    const on = under({ soundBoost: 'true' });
    applyClipProfile(on);
    expect(on.properties.get('soundBoost')).toBe('');
    expect(boostsSound(on.properties)).toBe(true);

    // Free: the profile says nothing, so the clip is the person's — and reads as on.
    const free = under({});
    applyClipProfile(free);
    expect(boostsSound(free.properties)).toBe(true);
  });

  it('fixes the export resolution, so a clip made under a production is written at its size', () => {
    const clip = under({ exportResolution: '1080' });
    applyClipProfile(clip);
    expect(clip.properties.get('exportResolution')).toBe('1080');
  });

  it('fixes nothing for a value the app does not offer, so no clip waits on a size it cannot write', () => {
    const clip = under({ exportResolution: '999' });
    applyClipProfile(clip);
    expect(clip.properties.get('exportResolution')).toBe('');
  });

  it('does not apply a declaration for an item this build does not preload', () => {
    const clip = under({ title: 'A demo', addToExport: 'true' });
    applyClipProfile(clip);
    expect(clip.properties.get('title')).toBe('');
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('is not what the one undo takes back: a profile’s value stays', () => {
    const clip = under({ addToExport: 'true' });
    clip.setProperty('title', 'A demo');        // the person's last change
    applyClipProfile(clip);
    clip.undo();                                // takes the title back, and only that
    expect(clip.properties.get('title')).toBe('');
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('changes nothing for the built-in default, which controls nothing', () => {
    const clip = under({});
    applyClipProfile(clip);
    expect(clip.properties.toRecord()).toEqual({});
  });
});
