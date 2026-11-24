# Deploy your own

A PWA has to be served over HTTP(S) from an origin — opening `web/index.html`
from disk will not register the service worker (it needs a secure context).

Pushing to `main` runs the **Deploy** workflow, which runs `npm run build` and
publishes `dist/` to GitHub Pages. Enable it once in
**Settings → Pages → Source → GitHub Actions** (the workflow also attempts to
enable Pages itself).

The same workflow bumps the patch version, tags it and commits it back to `main`,
so every deploy has its own number beside the logo — see
[VERSIONING.md](VERSIONING.md).

To deploy elsewhere, run `npm run build` and publish the `dist/` folder.

## Uploading to YouTube

Publishing needs no server and no secret: the app signs in with Google's own token
model, and the token lives in the page for as long as it is open — nothing about the
account is written down. What a deployment does have to do once:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and
   enable the **YouTube Data API v3**.
2. Create an **OAuth client ID** of type *Web application*, and add the origins the app is
   served from — the deployed host and, for development, `http://127.0.0.1:5173` and
   `http://127.0.0.1:5174`.
3. While the consent screen is in **Testing**, list the Google accounts that may upload as
   test users. Letting everyone in needs Google's own review of the upload permission,
   which is a separate step.
4. Put the client ID in `web/public/youtube-client.json`:

```json
{ "clientId": "1234567890-abc.apps.googleusercontent.com" }
```

That file is the app's registration: public, not a secret, and a fork sets its own. Until
it is set, the app says it is not set up rather than offering a sign-in that cannot work.
The upload allowance — 100 videos a day — belongs to the project rather than to each
person, which is the other reason the reach is deliberately small for now.
