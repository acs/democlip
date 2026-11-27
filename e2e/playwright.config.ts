// The end-to-end runner: Playwright Test over the real app on the dev server.
//
// The suite drives the app's own index.html — no copy, no injected script — so it
// needs the dev server running; Playwright starts it here. The config lives in
// e2e/, so paths that belong to the repository root (the webServer, the reports)
// are resolved against the parent directory.

import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './checks',
  fullyParallel: true,
  // Each check encodes its own fixture takes in the page. A worker per core lets 16
  // checks each encode a 120-frame vp8 take at once, and the encode that costs 0.9 s
  // alone takes longer than the 30 s test timeout under that contention. Four workers
  // keep the suite inside its budget without starving the encoders.
  //
  // The same number runs locally and in CI. The CI job is two shards, each on a standard
  // four-core runner, so each shard has its own four workers and its own encoders rather
  // than competing with the other shard for them.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../playwright-report' }],
  ],
  outputDir: '../test-results',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // A stand-in camera and microphone, and no gesture needed to play sound —
          // so the webcam and mic record flow is drivable, and a check never waits
          // on a person to allow one.
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  // A dedicated port, and never a server the suite did not start. The dev server's
  // default 5173 is shared with whatever else a developer has running — another
  // worktree, a second checkout — and reusing it silently tests the wrong app:
  // the page stays "Initialising" and the suite's own modules 404. The suite
  // starts its own server on 5174 every run, so a run never depends on what is
  // already listening (FR-013).
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    cwd: root,
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
