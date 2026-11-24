# Development

Requires [Node.js](https://nodejs.org/). Install the dev dependencies once:

```bash
npm install
```

| Command | Does |
|---|---|
| `npm run dev` | Starts the Vite dev server at **http://127.0.0.1:5173** — plain HTTP on a loopback host — with hot module replacement |
| `npm run dev:https` | The same over HTTPS with a self-signed certificate, for what needs a secure origin |
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the built site (`dist/`) over plain HTTP on 127.0.0.1, with the PWA/service worker active |
| `npm run preview:https` | The same over HTTPS |
| `npm run typecheck` | Type-checks without emitting |
| `npm run lint` | ESLint (use `npm run lint:fix` to auto-fix) |
| `npm test` | Runs the Vitest unit tests (`npm run test:watch` to watch) |

The dev server disables the service worker — its cache-first strategy would
shadow HMR — so use `npm run preview` to exercise the real PWA locally.

HTTPS is one flag away — `npm run dev:https`, and `preview:https` — using a
self-signed certificate from `@vitejs/plugin-basic-ssl`. Browsers warn until that
certificate is trusted, and the service worker will not register on an untrusted
one — so trust it (add it to your keychain) if you need HTTPS for install or
offline testing.

Plain HTTP is the default for both servers, on `127.0.0.1`. That is a **secure
context** already, so screen capture works, and it is the only origin atproto's
OAuth allows a dev server to sign in from — which is how publishing to Bluesky is
tested without deploying anything, and without a tunnel. The app still redirects any
`http://` access to `https://` except on a loopback host, so a deployment reached
over http is upgraded.

Linting runs on every commit through a Husky pre-commit hook, and the CI
workflow runs lint, type-check, tests and the build on every push and pull
request. A separate `e2e` job runs the end-to-end suite in a headless Chromium.

Unit tests live beside the rules they prove (`src/domain/`, `src/application/`);
anything drawn, played or encoded is proven by a committed check in the
end-to-end suite. Run it with `npm run test:e2e`; it drives the real app on the
dev server, builds a clip from deterministic fixture takes without recording
one, and leaves a trace, screenshot and video when a check fails. The CI job
keeps the report and that evidence as downloadable artifacts, the way GitLab
does. What counts as proof, and what to say about what you could not check, is in
[`.agents/skills/verification`](../.agents/skills/verification/SKILL.md).

**How the project is worked on is written down**, so it does not have to be
rediscovered: [`GLOSSARY.md`](GLOSSARY.md) holds the words — a *take* is not a
*mark*, a *section* is not yet a *cut* — and `.agents/skills/` holds
[verification](../.agents/skills/verification/SKILL.md) (what counts as proving a
change), the [domain model](../.agents/skills/domain-model/SKILL.md) (where a rule
belongs), the [workflow](../.agents/skills/project-workflow/SKILL.md) (branches,
commits, pull requests) and [branding](../.agents/skills/branding/SKILL.md) (the mark,
the name and the colours).
