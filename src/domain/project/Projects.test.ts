import { describe, expect, it } from 'vitest';

import { Projects, PROJECTS_FORMAT, type StoredProjects } from './Projects.js';
import { Project } from './Project.js';
import { Profiles } from '../profile/Profiles.js';

const named = (id: string, name: string) =>
  Project.create({ id, name, motivation: 'Why', objectives: 'What', defaultProfileId: Profiles.DEFAULT_ID })!;

describe('Projects', () => {
  it('starts with the Default project alone, current', () => {
    const book = Projects.starting();

    expect(book.all.map(p => p.name)).toEqual(['Default']);
    expect(book.currentId).toBe(Projects.DEFAULT_ID);
    expect(book.current().id).toBe(Projects.DEFAULT_ID);
  });

  it('adds a project and keeps the current one', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!;

    expect(book.all.map(p => p.name)).toEqual(['Default', 'Launch']);
    expect(book.currentId).toBe(Projects.DEFAULT_ID);
  });

  it('refuses an id already here and a name already used, ignoring case and spaces', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!;

    expect(book.create(named('p1', 'Other'))).toBeNull();
    expect(book.create(named('p2', '  launch '))).toBeNull();
    expect(book.create(named('p2', '  default '))).toBeNull();
  });

  it('selects a project, and refuses one that is not here', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!;

    expect(book.select('p1')!.currentId).toBe('p1');
    expect(book.select('nope')).toBeNull();
  });

  it('renames one of the person’s projects, refusing the Default and a taken name', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!.create(named('p2', 'Series'))!;

    expect(book.rename('p1', 'Launch video')!.get('p1')!.name).toBe('Launch video');
    expect(book.rename(Projects.DEFAULT_ID, 'Mine')).toBeNull();
    expect(book.rename('p1', 'Series')).toBeNull();
    expect(book.rename('p1', '  ')).toBeNull();
    expect(book.rename('nope', 'X')).toBeNull();
  });

  it('describes a project without moving its name or profile', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!;

    const described = book.describe('p1', 'New why', 'New what')!;

    expect(described.get('p1')!.description()).toEqual({ motivation: 'New why', objectives: 'New what' });
    expect(described.get('p1')!.name).toBe('Launch');
    expect(book.describe('nope', 'x', 'y')).toBeNull();
  });

  it('removes one, falling back to Default when it was current; never the Default', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!.select('p1')!;

    const removed = book.remove('p1')!;

    expect(removed.has('p1')).toBe(false);
    expect(removed.currentId).toBe(Projects.DEFAULT_ID);
    expect(book.remove(Projects.DEFAULT_ID)).toBeNull();
    expect(book.remove('nope')).toBeNull();
  });

  it('changes a project’s default profile, refusing an empty one', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!;

    expect(book.setDefaultProfile('p1', 'tv')!.get('p1')!.defaultProfileId).toBe('tv');
    expect(book.setDefaultProfile('p1', '')).toBeNull();
    expect(book.setDefaultProfile('nope', 'tv')).toBeNull();
  });

  it('writes down and reads back the book', () => {
    const book = Projects.starting().create(named('p1', 'Launch'))!.select('p1')!;

    expect(Projects.of(book.stored()).stored()).toEqual(book.stored());
  });

  it('repairs a stored book: the Default is the app’s own, duplicates go, current falls back', () => {
    const stored: StoredProjects = {
      version: PROJECTS_FORMAT,
      currentId: 'gone',
      projects: [
        { id: 'default', name: 'Not the Default', motivation: 'Why the app', objectives: 'What it does', defaultProfileId: 'tv' },
        { id: 'p1', name: 'Launch', motivation: '', objectives: '', defaultProfileId: Profiles.DEFAULT_ID },
        { id: 'p1', name: 'Duplicate', motivation: '', objectives: '', defaultProfileId: Profiles.DEFAULT_ID },
        { id: '', name: 'Bad', motivation: '', objectives: '', defaultProfileId: Profiles.DEFAULT_ID },
      ],
    };

    const book = Projects.of(stored);

    expect(book.all.map(p => p.id)).toEqual([Projects.DEFAULT_ID, 'p1']);
    expect(book.current().name).toBe('Default');
    // The name is the app's, but the person's description and default profile are kept.
    expect(book.current().description()).toEqual({ motivation: 'Why the app', objectives: 'What it does' });
    expect(book.current().defaultProfileId).toBe('tv');
  });

  it('starts fresh when the stored book is not one it can read', () => {
    expect(Projects.of(null).currentId).toBe(Projects.DEFAULT_ID);
    expect(Projects.of({} as StoredProjects).currentId).toBe(Projects.DEFAULT_ID);
  });
});