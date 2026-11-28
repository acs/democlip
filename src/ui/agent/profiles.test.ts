import { describe, expect, it } from 'vitest';

import { createProfilesSurface } from './profiles.js';
import { Profiles } from '../../domain/profile/Profiles.js';
import { Profile } from '../../domain/profile/Profile.js';

// A profile book an agent's operations change — stood in for by the domain itself, so what the
// surface answers is read against the same rules the app uses.

function build(activeId = 'brand') {
  let book = Profiles.starting().add(Profile.create('brand', 'Brand', { logo: 'graditone' })!)!;
  const surface = createProfilesSurface({
    list: () => book,
    activeId: () => activeId,
    create: async name => {
      const id = `p${book.all.length}`;
      const made = Profile.create(id, name);
      if (!made) return { ok: false, reason: 'a profile needs a name' };
      book = book.add(made)!;
      return { ok: true, id };
    },
    declare: async (id, property, value) => {
      const next = book.declare(id, property, value);
      if (!next) return { ok: false, reason: `there is no profile called ${id}` };
      book = next;
      return { ok: true };
    },
    rename: async (id, name) => {
      const next = book.rename(id, name);
      if (!next) return { ok: false, reason: 'that profile cannot be renamed' };
      book = next;
      return { ok: true };
    },
  });
  return { surface, book: () => book };
}

describe('the profiles surface', () => {
  it('lists every profile with what it fixes, and marks the clip’s own', () => {
    const { surface } = build();

    const listed = surface.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.activeId).toBe('brand');
    expect(listed.profiles.map(one => one.name)).toEqual(['Empty', 'Brand']);
    expect(listed.profiles.find(one => one.id === 'brand')!.controls).toEqual({ logo: 'graditone' });
    expect(listed.profiles.find(one => one.id === 'brand')!.active).toBe(true);
    expect(listed.profiles.find(one => one.id === 'default')!.active).toBe(false);
  });

  it('makes a profile that fixes the items it is given', async () => {
    const { surface, book } = build('default');

    const made = await surface.create({
      name: 'Graditone',
      controls: { logo: 'graditone', annotationColour: '#ff6c23' },
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.profile.name).toBe('Graditone');
    expect(made.profile.controls).toEqual({ logo: 'graditone', annotationColour: '#ff6c23' });
    // And the book itself holds the declarations, not just the answer.
    expect(book().get(made.profile.id)!.valueFor('annotationColour')).toBe('#ff6c23');
  });

  it('replaces the whole set on edit, handing back an item left out', async () => {
    const { surface } = build();

    const edited = await surface.edit('brand', { controls: { title: 'A demo' } });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.profile.controls).toEqual({ title: 'A demo' });
  });

  it('refuses to edit a profile that is not there', async () => {
    const { surface } = build();

    expect(await surface.edit('missing', { name: 'x' })).toMatchObject({ ok: false });
  });
});
