import { describe, expect, it } from 'vitest';

import { Project, DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, defaultProject } from './Project.js';
import { Profiles } from '../profile/Profiles.js';

const project = (overrides: Partial<Parameters<typeof Project.create>[0]> = {}) =>
  Project.create({ id: 'p1', name: 'Onboarding videos', defaultProfileId: Profiles.DEFAULT_ID, ...overrides });

describe('Project', () => {
  it('is named, described and given a profile', () => {
    const p = project({ motivation: 'New users are lost.', objectives: 'Explain the first run.' })!;

    expect(p.name).toBe('Onboarding videos');
    expect(p.description()).toEqual({
      motivation: 'New users are lost.',
      objectives: 'Explain the first run.',
    });
    expect(p.defaultProfileId).toBe(Profiles.DEFAULT_ID);
  });

  it('keeps the description exactly as written, and lets it be empty', () => {
    expect(project()!.description()).toEqual({ motivation: '', objectives: '' });
    expect(project({ motivation: '  spaced  ' })!.motivation).toBe('  spaced  ');
  });

  it('trims the name and refuses one with nothing in it', () => {
    expect(project({ name: '  Launch  ' })!.name).toBe('Launch');
    expect(project({ name: '   ' })).toBeNull();
  });

  it('refuses an empty id or an unnamed default profile', () => {
    expect(project({ id: '' })).toBeNull();
    expect(project({ defaultProfileId: '' })).toBeNull();
  });

  it('renames, refuses an empty name, and keeps everything else', () => {
    const p = project()!;

    expect(p.renamed('Launch')!.name).toBe('Launch');
    expect(p.renamed('   ')).toBeNull();
    expect(p.renamed('Launch')!.defaultProfileId).toBe(p.defaultProfileId);
  });

  it('takes a new description without touching the profile or the name', () => {
    const p = project()!;

    const next = p.described('Why', 'What');

    expect(next.description()).toEqual({ motivation: 'Why', objectives: 'What' });
    expect(next.name).toBe(p.name);
    expect(next.defaultProfileId).toBe(p.defaultProfileId);
  });

  it('takes a new default profile, and refuses an empty one', () => {
    const p = project()!;

    expect(p.withDefaultProfile('p-tv')!.defaultProfileId).toBe('p-tv');
    expect(p.withDefaultProfile('')).toBeNull();
  });

  it('writes down and reads back the whole project', () => {
    const p = project({ motivation: 'Why', objectives: 'What' })!;

    expect(Project.restore(p.stored())!.stored()).toEqual(p.stored());
    expect(Project.restore(null)).toBeNull();
  });

  it('has one spelling for the built-in project', () => {
    expect(defaultProject().id).toBe(DEFAULT_PROJECT_ID);
    expect(defaultProject().name).toBe(DEFAULT_PROJECT_NAME);
    expect(defaultProject().defaultProfileId).toBe(Profiles.DEFAULT_ID);
  });
});