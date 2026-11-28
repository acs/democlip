// The profiles an agent may drive: list them, make one, and change what it fixes.
//
// It adds no rule of its own. Every operation asks the same use case a button asks, and every
// refusal is the use case's own words. There is deliberately no removal here: taking a profile
// away needs the person's confirmation, and the tool list is the boundary.
//
// It is free of the DOM, so it is proved in node with a fake behind the same shape.

import type { Profiles } from '../../domain/profile/Profiles.js';
import type { ProfileSummary, ProfilesSurface, Result } from './surface.js';

export interface ProfileAgentDeps {
  /** The book in hand: what the list reads and what a change is checked against. */
  readonly list: () => Profiles;
  /** The id of the profile the clip in front of the person is made under. */
  readonly activeId: () => string;
  readonly create: (name: string) => Promise<Result<{ id: string }>>;
  readonly declare: (id: string, property: string, value: string | null) => Promise<Result<object>>;
  readonly rename: (id: string, name: string) => Promise<Result<object>>;
}

export function createProfilesSurface(deps: ProfileAgentDeps): ProfilesSurface {
  const summary = (id: string): ProfileSummary | null => {
    const profile = deps.list().get(id);
    if (!profile) return null;
    return {
      id: profile.id,
      name: profile.name,
      controls: { ...profile.controls },
      active: profile.id === deps.activeId(),
    };
  };

  const read = (id: string): Result<{ profile: ProfileSummary }> => {
    const profile = summary(id);
    return profile ? { ok: true, profile } : { ok: false, reason: `there is no profile called ${id}` };
  };

  /** Set the whole set of items the profile fixes: declare each wanted, hand back the rest. */
  const setControls = async (id: string, controls: Readonly<Record<string, string>>): Promise<Result<object>> => {
    const current = deps.list().get(id);
    if (!current) return { ok: false, reason: `there is no profile called ${id}` };
    for (const property of Object.keys(current.controls)) {
      if (!Object.prototype.hasOwnProperty.call(controls, property)) {
        const freed = await deps.declare(id, property, null);
        if (!freed.ok) return freed;
      }
    }
    for (const [property, value] of Object.entries(controls)) {
      const declared = await deps.declare(id, property, value);
      if (!declared.ok) return declared;
    }
    return { ok: true };
  };

  return {
    list() {
      const book = deps.list();
      return {
        ok: true,
        activeId: deps.activeId(),
        profiles: book.all.map(profile => ({
          id: profile.id,
          name: profile.name,
          controls: { ...profile.controls },
          active: profile.id === deps.activeId(),
        })),
      };
    },

    async create(input) {
      const made = await deps.create(input.name);
      if (!made.ok) return made;
      if (input.controls !== undefined) {
        const set = await setControls(made.id, input.controls);
        if (!set.ok) return set;
      }
      return read(made.id);
    },

    async edit(id, input) {
      if (!deps.list().get(id)) return { ok: false, reason: `there is no profile called ${id}` };
      if (input.name !== undefined) {
        const renamed = await deps.rename(id, input.name);
        if (!renamed.ok) return renamed;
      }
      if (input.controls !== undefined) {
        const set = await setControls(id, input.controls);
        if (!set.ok) return set;
      }
      return read(id);
    },
  };
}
