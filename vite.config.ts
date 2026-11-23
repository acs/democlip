import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The version shown beside the logo. `package.json` is the one place it is
// written; the deploy workflow bumps it on every merge to main (see
// VERSIONING.md), so the git tag, the deployed build and the number on screen
// all say the same thing.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// The notices name the libraries we bundle and the versions we bundle, and the
// versions are read from what is installed rather than typed in — so they cannot
// go stale the next time a dependency is bumped.
function thirdPartyNotices(): string {
  return readFileSync('THIRD-PARTY-NOTICES.template.txt', 'utf8')
    .replace(/\{\{([@a-z0-9/.-]+)\}\}/g, (_match, pkg: string) => {
      const meta = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')) as { version: string };
      return meta.version;
    });
}

// Plain HTTP is the default, on a loopback host: that is a secure context already —
// screen capture works — and it is the one origin atproto's OAuth lets a dev server
// sign in from, so publishing to Bluesky works with nothing deployed. HTTPS is there
// for what needs it, such as the service worker, which will not register on an
// untrusted certificate: `--mode https`, or `npm run dev:https` / `preview:https`.
export default defineConfig(({ mode }) => ({
  // The web shell — `index.html`, `styles.css` and `public/` — lives in `web/`, so the
  // repository root holds the project's config and docs and no application files. The
  // app's own code stays in `src/`, reached from the page by a relative path, so
  // `src/` keeps exactly the four layers it documents.
  root: 'web',
  // Relative asset URLs, so the build works from any base path
  // (localhost root, a GitHub Pages project page, a custom domain).
  base: './',
  // Baked into the bundle so the app can show which build it is (src/ui/shell/version.ts).
  define: { __APP_VERSION__: JSON.stringify(version) },
  optimizeDeps: {
    // The publish client is reached only through a dynamic import — nothing loads it
    // until a clip is published — so Vite discovers it late, re-optimizes while the
    // page is live, and leaves that import asking for a dependency URL that no longer
    // exists: "Failed to fetch dynamically imported module", with a 504 behind it.
    // Naming it here has it optimized before anything can reference it.
    include: ['@atproto/oauth-client-browser'],
  },
  plugins: [
    ...(mode === 'https' ? [basicSsl()] : []),
    {
      // `version.json` says which version the deployment is serving, for the app
      // to compare its own against and offer a reload when a newer build is out
      // (see src/ui/shell/version.ts). Written for the build only: under the dev
      // server there is no deployment that could be newer.
      name: 'democlip-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
      },
    },
    {
      // Carry the licences of what we bundle. Vite's minifier drops every comment
      // and does not take esbuild's `legalComments` for it, so the notices are
      // written out here — after minification, where they survive. Mediabunny,
      // which the offline export brings in, is MPL-2.0, and its notice is meant
      // to travel with the copies made of it. They ship as a file beside the app
      // too, so they can be read without opening a minified bundle.
      name: 'democlip-notices',
      apply: 'build',
      generateBundle(_options, bundle) {
        const notices = thirdPartyNotices();
        this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: notices });
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk') file.code += '\n/*!\n' + notices + '*/\n';
        }
      },
    },
  ],
  server: {
    port: 5173,
    // The app's code is outside the Vite root (`web/`), one level up; the dev server
    // has to be allowed to serve it. `..` is the repository root, which also holds
    // `node_modules`.
    fs: { allow: ['..'] },
  },
  preview: { port: 5173 },
  // Two pages: the app, and the complete guide (`help.html`) the instructions
  // dialog links to. Both are entries, so the guide is built with its own
  // stylesheet and script rather than copied in beside the app.
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./web/index.html', import.meta.url)),
        help: fileURLToPath(new URL('./web/help.html', import.meta.url)),
      },
    },
  },
}));
