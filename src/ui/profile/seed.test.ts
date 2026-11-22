import { describe, expect, it } from 'vitest';

import { seedActiveProfile } from './seed.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { Take } from '../../domain/clip/Take.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';

// The seeding rule, proved in node. It is the one place a profile reaches a clip, so what
// matters is the three ways it does not: a clip with a take, a setting it does not carry,
// and a setting for a property this build does not preload.

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

const bookWith = (values: Record<string, string>): Profiles => {
  const profile = Profile.create('tv', 'DemoClipTV', values)!;
  return Profiles.starting().add(profile)!.choose('tv')!;
};

describe('seedActiveProfile', () => {
  it('gives an empty clip the active profile’s setting', () => {
    const clip = Clip.empty(new FakeTakes());
    seedActiveProfile(clip, bookWith({ addToExport: 'true' }));
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('leaves a clip that already holds a take exactly as it is', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.addTake(new Blob(['x']), 2);
    seedActiveProfile(clip, bookWith({ addToExport: 'true' }));
    expect(clip.properties.get('addToExport')).toBe('');
  });

  it('leaves the clip’s own value when the profile says nothing about the property', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.setProperty('addToExport', 'true');   // the person set it before the profile was chosen
    seedActiveProfile(clip, bookWith({}));
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('does not apply a setting for a property this build does not preload', () => {
    const clip = Clip.empty(new FakeTakes());
    seedActiveProfile(clip, bookWith({ title: 'A demo', addToExport: 'true' }));
    expect(clip.properties.get('title')).toBe('');
    expect(clip.properties.get('addToExport')).toBe('true');
  });

  it('seeds the built-in default’s emptiness over nothing, changing nothing', () => {
    const clip = Clip.empty(new FakeTakes());
    seedActiveProfile(clip, Profiles.starting());
    expect(clip.properties.toRecord()).toEqual({});
  });
});
