# Quickstart — proving Projects

How to run and validate the feature end to end. It names what to look at, not how it is
built; the data model and the contracts carry the details.

## Prerequisites

- Node 22 and the repository's dependencies: `npm install`.
- A modern Chrome for the end-to-end suite (its own browser; nothing is downloaded).
- No server, no account, no network: the app is local, and the checks stand in for anything
  that would leave the machine.

## The commands

| What | Command | What it proves |
|---|---|---|
| Type and lint | `npm run build` | The types line up; not proof of behaviour |
| Rules and use cases | `npm test` | Every project, clip-profile, recording and migration rule in node |
| The browser suite | `npm run test:e2e` | The person's path and the agent's path, in a real browser |
| The MCP server | `npm run test:mcp` | The six tools, their schemas, and the boundary |
| The app by hand | `npm run dev` | What no check can do: a real share, a real take, a real reload |

## 1. The domain and use cases (node)

```bash
npx vitest run src/domain/project src/domain/clip/Clip.test.ts src/application/projects.test.ts src/application/recordings.test.ts src/application/adopt-recording.test.ts
npx vitest run
```

What must hold, by test:

- `Projects.starting()` holds the Default project alone and it is current; `create` refuses
  a duplicate name ignoring case; `rename`/`remove` refuse Default.
- `remove` of the current project lands on Default, and the use case moves its recordings
  to Default.
- `Clip.chooseProfile` succeeds on an empty clip and is refused after a take; a snapshot
  writes and reads the profile; a snapshot without one restores as the built-in Default.
- A recording is in progress only while it is the open one with a take; a project's counts
  agree with its list.
- `adopt-recording` over a fake store writes the recording, its takes, its images and the
  pointer in one transaction, is idempotent on a second run, and leaves the old store
  untouched on a failure.
- The MCP tool list contains the six project tools and no deletion tool.

## 2. The end-to-end suite (browser)

```bash
npx playwright test --config e2e/playwright.config.ts e2e/checks/projects.spec.ts
```

Two checks, one per independent story:

1. **The person's path.** Seed a version-3 store with a take, a cut and an annotation, open
   the app on the new build: the recording appears in **Default** with its length and cut.
   Create a project, select it, add takes (fixtures — editing checks never record), end the
   session with **New**, reload, open the overview: the recording is listed as finished,
   the progress counts it, and **Remove** moves it to Default while it stays whole.
2. **The agent's path.** Open with `?agent=1`, ask for the projects, create one, select it,
   and move a recording into it; assert the person's window shows each change without a
   reload and the overview's counts agree.

Expected: both pass; a failure leaves a trace, screenshot and video under `test-results/`.

## 3. By hand (the recorder is the person's)

```bash
npm run dev
```

1. The app opens in a project — **Default** at first — shown by the pill in the toolbar.
2. Create **Onboarding videos** with a motivation and objectives. It becomes current.
3. Record a short take with the screen, webcam or microphone; the recording joins the
   project.
4. Press **New**. The recording counts as finished in the overview.
5. Reload: the app comes back to the current project, and the finished recording is listed.
6. Open the recording, record another take, end the session: it is finished again.
7. Give the project a default profile that fixes a visible item (for example **Add to
   export**). A new recording starts with it, locked and named. Change the clip's profile
   before recording: the new profile's declarations apply and lock.
8. Remove the recording from the project: it moves to **Default**. Delete it there only
   after the confirmation, and see the storage freed.
9. Try removing or renaming **Default**: there is no way, and the app says why.

The share picker is the person's; a check cannot open it. Say so in the pull request.

## 4. The agent, from a chat

With the server configured, ask:

- "What projects are there, and what is in the Launch one?" → one `list_projects`, one
  `read_project`.
- "Create a project called Launch, for the launch video, objective: explain the feature." →
  `create_project`.
- "Make Launch current and move the last recording there." → `select_project`, `move_recording`.
- "Delete the recording and remove the project." → the agent says the person must do it,
  because no such tool exists.

## What is not proved

- The screen-share picker and a real multi-minute recording (no check can open the share;
  the user runs it).
- IndexedDB quota exhaustion on a device with a nearly full disk: the failure path is a
  unit test with a fake store, not a filled browser.
- Wall-clock timings are headless numbers; the 2-second listing target is asserted
  functionally, not benchmarked on a slow device.