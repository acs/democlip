import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { appPort, DEFAULT_PORT, LOOPBACK_HOST, profileDirFor } from './loopback.js';

// The tenant's two anchors: a fixed port (so the origin does not move) and a profile
// named for the host (so a host is one tenant, whatever the port).

describe('the fixed port', () => {
  it('is the default when DEMOCLIP_PORT is not set', () => {
    expect(LOOPBACK_HOST).toBe('127.0.0.1');
    expect(appPort({})).toBe(DEFAULT_PORT);
  });

  it('comes from DEMOCLIP_PORT when it is', () => {
    expect(appPort({ DEMOCLIP_PORT: '4100' })).toBe(4100);
  });

  it('refuses a value that is not a port', () => {
    expect(() => appPort({ DEMOCLIP_PORT: 'nope' })).toThrow(/port number/);
    expect(() => appPort({ DEMOCLIP_PORT: '70000' })).toThrow(/port number/);
    expect(() => appPort({ DEMOCLIP_PORT: '1.5' })).toThrow(/port number/);
  });
});

describe('the profile that names the tenant', () => {
  it('is keyed by host name, not port', () => {
    expect(profileDirFor('127.0.0.1', {})).toBe(join(homedir(), '.democlip', 'browser', '127.0.0.1'));
    expect(profileDirFor('localhost', {})).toBe(join(homedir(), '.democlip', 'browser', 'localhost'));
  });

  it('moves with DEMOCLIP_PROFILE', () => {
    expect(profileDirFor('127.0.0.1', { DEMOCLIP_PROFILE: join('tmp', 'tenant') })).toBe(
      join('tmp', 'tenant', '127.0.0.1'),
    );
  });
});
