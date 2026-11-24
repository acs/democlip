# Versioning

The build's version is shown beside the logo in the header — `DemoClip v1.0.5` —
so it is plain which deployed build a window is running, and whether a reload
really did pick up a new deploy. That matters for a PWA, which can go on serving
an older shell from the service worker's cache.

## Where the number comes from

`package.json`'s `version` is the one place it is written. Vite bakes it into the
bundle at build time (`vite.config.ts` → `__APP_VERSION__`) and
`src/ui/version.ts` puts it in the corner, so the tag, `main` and the number on
screen cannot drift apart.

## Automatic bump on every merge

1. Merge a pull request into `main`.
2. The **Deploy** workflow (`.github/workflows/deploy.yml`) runs
   `npm version patch` — `1.0.5` → `1.0.6`.
3. It commits that back to `main` (`chore: bump version to v1.0.6 [skip ci]`)
   and tags it `v1.0.6`.
4. It builds with that version and deploys to GitHub Pages.
5. The header shows `v1.0.6`.

## Bumping by hand

A new feature or a breaking change deserves more than a patch bump, so bump it by
hand before merging:

```bash
npm version minor   # 1.0.6 -> 1.1.0   (new feature, nothing broken)
npm version major   # 1.1.0 -> 2.0.0   (breaking change)
git push origin <branch>
```

CI carries on bumping patches from the new base: `2.0.0` → `2.0.1` → `2.0.2`.

## Semantic versioning

`MAJOR.MINOR.PATCH` — [SemVer](https://semver.org/):

- **PATCH** (automatic) — bug fixes, small adjustments, every merge
- **MINOR** (by hand) — new features, nothing broken
- **MAJOR** (by hand) — breaking changes

## History

```bash
git tag -l "v*"        # every version, in order
git show v1.0.6        # what went into one
```

## Knowing a newer build is out

The number on screen says which build you are on; `version.json`, written beside
the bundle at build time, lets the app say when a **newer** one has been deployed.

On load, whenever the tab is brought back to the front, and every 15 minutes, the
app fetches `version.json` and compares it with its own version. If they differ it
offers a reload in the header — `v1.0.5 → v1.0.6 · reload` — which is also how you
tell the difference between "the deploy has not run yet" and "my window is on a
cached shell".

It **never reloads on its own**: a recording in progress would go with it. The
service worker is told never to cache `version.json`, so the offer is always about
the deployment rather than a stale copy of it.

## One deliberate difference

The workflow this is modelled on (Graditone's) fetches `main` and **force-pushes**
its bump commit. This one pushes without `--force`, so if someone merges while
the run is going the push is rejected and the run fails loudly rather than
rewriting a commit someone else just landed. The next run bumps from whatever
`main` then says, so nothing is lost.

## Troubleshooting

**The version does not change after a deploy.** The service worker may still be
serving the page it cached. A plain reload usually fixes it — the worker is
network-first for documents, so the page comes from the network — otherwise
clear the site data (DevTools → Application → Storage → Clear site data) or
hard-refresh (`Cmd/Ctrl+Shift+R`).

**The bump step failed.** Look at the run under the **Actions** tab. It is nearly
always a push rejected because `main` moved while the workflow was running, or a
conflict on `package.json`. On a repository or organisation that restricts the
token, it can also be a refused write — the workflow asks for `contents: write`,
which can be capped in **Settings → Actions → General → Workflow permissions**.
