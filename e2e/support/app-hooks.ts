// The one module the suite imports into the page.
//
// Vite serves this module and rewrites its imports to the same URLs the app
// loaded, so the suite and the app share one instance of each module. Importing
// `/src/session.js` from the page directly would create a *second* instance — the
// app loads `/src/session.ts` — and the app's views would never see the seeded clip.
//
// Everything a check reaches into the app through goes here, so the URLs are
// resolved in one place.

export { session } from '../../src/session.js';
export { player } from '../../src/ui/clip/clip.js';
export { strip } from '../../src/ui/clip/timeline-ui.js';
export { setPhase, currentPhase } from '../../src/state.js';
export { openReview } from '../../src/ui/clip/review-flow.js';
export { capture } from '../../src/infra/capture.js';
