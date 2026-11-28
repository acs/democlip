// The loopback tenant: the host everything is served from, the port it is fixed to,
// and the browser profile that keeps one tenant per host.
//
// DemoClip is a client-only app. Its projects and profiles live in localStorage and
// its recordings in IndexedDB, and browser storage is keyed by the whole origin —
// scheme, host *and port*. So an origin that moves is a tenant that moves: the port
// is fixed (`DEMOCLIP_PORT`) and the browser profile is **persistent** and kept per
// **host name**, so every session on a host is one tenant and past demos stay
// openable. Nothing is served to the network: loopback only.

import { homedir } from 'node:os';
import { join } from 'node:path';

/** The host the app is served from and driven on. Loopback, and only loopback. */
export const LOOPBACK_HOST = '127.0.0.1';

/** The port the app is served on unless `DEMOCLIP_PORT` says otherwise. */
export const DEFAULT_PORT = 57364;

/** The port to serve on, from `DEMOCLIP_PORT` or the fixed default. */
export function appPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DEMOCLIP_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DEMOCLIP_PORT must be a port number, got "${raw}"`);
  }
  return port;
}

/**
 * The persistent browser profile for a host: one tenant per **host name**, whatever
 * the port. `DEMOCLIP_PROFILE` moves the base; by default it is
 * `~/.democlip/browser/<host>`.
 */
export function profileDirFor(host: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = env.DEMOCLIP_PROFILE ?? join(homedir(), '.democlip', 'browser');
  return join(base, host);
}
