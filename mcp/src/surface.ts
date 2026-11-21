// Reaching the app's automation surface in the page.
//
// One way in, so every tool and every delivery asks the app the same way. The path is
// dotted for a group — `edit.cut`, `view.seek` — and an operation the page does not
// offer is an error rather than a silent `undefined`, because a drifted name is a bug
// in the pair of releases, not something to answer around.

import type { Session } from './session.js';

export async function callSurface<T>(session: Session, path: string, ...args: unknown[]): Promise<T> {
  return session.page.evaluate(
    ({ path, args }) => {
      const surface = (globalThis as { democlip?: Record<string, unknown> }).democlip;
      if (!surface) throw new Error('the page has no automation surface');
      const parts = path.split('.');
      let owner: unknown = surface;
      for (const part of parts.slice(0, -1)) {
        owner = (owner as Record<string, unknown> | undefined)?.[part];
      }
      const fn = (owner as Record<string, unknown> | undefined)?.[parts[parts.length - 1]];
      if (typeof fn !== 'function') throw new Error(`the app offers no ${path}`);
      return (fn as (...a: unknown[]) => unknown).apply(owner, args);
    },
    { path, args },
  ) as Promise<T>;
}
