// Composition root: wires the UI to the use cases and boots the app.

import { el, setStatus, toast } from './ui/dom.js';
import { initVersion, appVersion } from './ui/shell/version.js';
import { agentAskedFor, createAgentSurface } from './ui/agent/surface.js';
import { describeClip } from './ui/agent/describe.js';
import { createEditor } from './ui/agent/edit.js';
import { makeAnnotation } from './ui/agent/make.js';
import { createViewer } from './ui/agent/view.js';
import { createTakes, type Recording, type SourceName } from './ui/agent/takes.js';
import { createOut } from './ui/agent/out.js';
import { onPhaseChange, currentPhase, type Phase } from './state.js';
import { session } from './session.js';
import { loadPrefs } from './prefs.js';
import { applyTheme, toggleTheme } from './ui/shell/theme.js';
import { toggleHelp, helpBdClick } from './ui/shell/help.js';
import { drawGrid } from './ui/recording/preview.js';
import { initTimeline, updateTimeUI, updateSizeUI } from './ui/clip/timeline-ui.js';
import { initTimelineMarks } from './ui/cutting/marks.js';
import { initAnnotationCanvas } from './ui/annotating/annotation-canvas.js';
import './ui/annotating/plugins.js';        // registers every kind in the view
import { initAnnotationLane } from './ui/annotating/annotation-lane.js';
import { inspector } from './ui/annotating/properties-inspector.js';
import { textEntry } from './ui/annotating/text-entry.js';
import { initViewLifetime } from './ui/lifecycle/view-lifetime.js';
import { toggleRecord, toggleScreen, syncSources, onScreenEnded, initRecordFlow, startTake, stopRecording, hasPicture } from './ui/recording/record-flow.js';
import { doExport } from './ui/exporting/export-flow.js';
import { startNewSession } from './ui/lifecycle/new-session-flow.js';
import { playback, initPlaybackKeys } from './ui/clip/playback.js';
import { waveform } from './ui/clip/waveform.js';
import { initRegion } from './ui/recording/region.js';
import { initWebcam, toggleWebcam, switchWebcam } from './ui/recording/webcam.js';
import { cameraMenu } from './ui/recording/camera-menu.js';
import { initMic, toggleMic } from './ui/recording/mic.js';
import { initSourceButtons, setScreenAvailable } from './ui/recording/source-buttons.js';
import { chooseFile, onFileChosen } from './ui/recording/import-flow.js';
import { exportMenu } from './ui/exporting/export-menu.js';
import { publishDialog } from './ui/publishing/publish-dialog.js';
import { youtubeDialog } from './ui/publishing/youtube-dialog.js';
import { youTubeAccount, uploadClip } from './ui/publishing/youtube-flow.js';
import { blueskyAccount, publishClip } from './ui/publishing/publish-flow.js';
import { keep } from './ui/keeping/keep.js';
import { resumeClip } from './ui/keeping/resume-flow.js';
import { capture } from './infra/capture.js';

function init(): void {
  // Not every browser can share a screen: Chrome and Firefox on Android do not
  // implement getDisplayMedia (nor did Safari on iOS before 27). That is not
  // "not supported" — the webcam and the mic still work — so the Screen button is
  // out instead (source-buttons.ts), and a browser with no mediaDevices at all is
  // said plainly in the status.
  const hasMedia = !!navigator.mediaDevices;
  const canShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  setStatus(hasMedia ? 'ready' : '', hasMedia ? 'Ready' : 'Not supported');

  // Apply persisted preferences.
  const prefs = loadPrefs();
  if (prefs.theme && prefs.theme !== document.documentElement.dataset.theme) applyTheme(prefs.theme);

  drawGrid();
  initVersion();
  updateTimeUI();
  updateSizeUI();

  // Controls — these used to be inline onclick/onchange handlers in the markup.
  el.themeBtn.addEventListener('click', toggleTheme);
  el.helpBtn.addEventListener('click', toggleHelp);
  el.helpClose.addEventListener('click', toggleHelp);
  el.helpBd.addEventListener('click', helpBdClick);

  el.recBtn.addEventListener('click', toggleRecord);
  el.btnNew.addEventListener('click', startNewSession);
  el.btnExp.addEventListener('click', () => exportMenu.toggle());
  exportMenu.init(choice => {
    if (choice === 'bluesky') void publishDialog.open();
    else if (choice === 'youtube') void youtubeDialog.open();
    // "For editing" is a WebM whose annotations are not drawn in but written beside it,
    // so a clip that goes out to be worked on can come back with them.
    else if (choice === 'editing') void doExport('webm', 'carried');
    else void doExport(choice);
  });
  publishDialog.init();
  youtubeDialog.init();
  el.playBtn.addEventListener('click', () => playback.toggle());
  initPlaybackKeys();   // P plays and pauses, as the button does

  // New is the way back to the share picker — it is how you re-share after
  // forgetting to tick "share audio" — so it is offered while a capture is live
  // ("waiting to record") as well as while a clip is being reviewed. It stays
  // hidden while the recording runs, where a press would be read as "stop"
  // instead.
  const showNew = (phase: Phase) => { el.btnNew.style.display = phase === 'live' || phase === 'review' ? '' : 'none'; };
  onPhaseChange(showNew);
  showNew(currentPhase());

  // Click the timeline to play from that point, mark a section and cut it.
  initTimelineMarks();
  initTimeline();   // the timeline listens to the clip

  // Annotate the picture: the section's action arms a kind, and the shared canvas
  // edits whatever is placed — the arrow today, an image beside it.
  initAnnotationCanvas();
  initAnnotationLane();   // and the timeline shows where the annotations are
  inspector.init();       // and a picked annotation's settings open its properties
  textEntry.init();       // the one dialog for typing a line, for entering and editing

  // Every view resets itself when the clip is cleared. The session names no view.
  initViewLifetime();

  // The clip outlives the page. It is kept written down as it changes — a reload
  // or a new version comes back to it, and the trip a Bluesky sign-in takes is
  // only the one that forced it — and a stored clip is opened back into the
  // review on the way in. The session is over at New, or when the clip is
  // exported, and the kept copy goes with it.
  keep.watch();
  void resumeClip();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    toast('Install DemoClip — click the ⊕ in your address bar', 5000);
  });

  // Keep the audio waveform aligned with the strip on resize.
  window.addEventListener('resize', () => waveform.draw());

  // Drag on the preview to crop the recording to a region.
  initRegion();

  // The preview follows the capture's real size — which is not what a display
  // track's settings say until a tab's or window's first frame lands.
  initRecordFlow();

  // The record sources, independent of one another. Turning the screen off lets
  // the share go; the webcam is the whole picture while the screen is off, so
  // the preview is synced once it has really started or stopped. All three are
  // out when their device is missing and while a take is being set up or runs
  // (source-buttons.ts).
  setScreenAvailable(canShare);
  initSourceButtons();
  el.screenBtn.addEventListener('click', () => void toggleScreen());
  el.webcamBtn.addEventListener('click', async () => { await toggleWebcam(); syncSources(); });
  el.camPickBtn.addEventListener('click', () => cameraMenu.toggle());
  cameraMenu.init(async deviceId => { await switchWebcam(deviceId); syncSources(); });
  initWebcam();
  capture.onEnded(onScreenEnded);

  // A video file already on the machine, brought in as a take beside the
  // recordings: the picker is the browser's, and the choice comes back as change.
  el.fileBtn.addEventListener('click', chooseFile);
  el.fileInput.addEventListener('change', () => void onFileChosen());

  // Microphone toggle + level meter.
  el.micBtn.addEventListener('click', async () => { await toggleMic(); syncSources(); });
  initMic();

  // A Bluesky sign-in only finishes when the authorization server sends us back.
  // The OAuth client is heavy and only needed then, so it loads on demand: a
  // normal load reaches for no network and does not carry it in the bundle.
  const url = new URL(window.location.href);
  const returning = [url.search, url.hash].some(part => part.includes('code=') || part.includes('error='));
  if (returning) void import('./infra/bluesky.js').then(({ initBluesky }) => initBluesky());

  // Nothing is captured on load: every source starts off, and the Screen and
  // Webcam buttons are what start one. A take needs a picture, so Record with
  // nothing on says so rather than reaching for the screen.

  // Service worker: off under Vite's dev server, whose cache-first strategy
  // would shadow HMR; on for builds and `vite preview` (a real, installable,
  // offline-capable PWA). Any leftover worker is removed in dev.
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations()
        .then(rs => rs.forEach(r => r.unregister()))
        .catch(() => {});
    } else {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // The automation surface: published **only** when the page asked to be driven.
  // A page opened without the flag carries nothing at all — no global, no listener,
  // no timer — so a person opening DemoClip gets the app and nothing else. The
  // operations it offers are the app's own; this only hands them over.
  if (agentAskedFor(window.location.search)) {
    // The page says so too. The badge is the visible half of the same gate, decided
    // here and nowhere else, so what the page offers and what it says cannot disagree.
    el.agentChip.classList.add('on');
    window.democlip = createAgentSurface({
      version: appVersion(),
      describe: () => describeClip(session.clip),
      sources: () => recording.sources(),
      takes: createTakes(session.clip, recording),
      edit: createEditor(session.clip, makeAnnotation),
      view: createViewer(playback, currentPhase, () => session.clip.total()),
      out: createOut(
        { export: (target, annotations) => doExport(target, annotations) },
        {
          account: async () => {
            const account = await blueskyAccount();
            return account ? { handle: account.handle } : null;
          },
          publish: (text, alt, handlers) => publishClip(text, alt, handlers),
        },
        {
          account: async () => {
            const account = await youTubeAccount();
            return account ? { channel: account.title } : null;
          },
          upload: (settings, handlers) => uploadClip(settings, handlers),
        },
      ),
    });
  }
}

// What the surface's recording operations drive: the app's own toggles and flows, so
// a take an agent starts is a take a person sees. The screen source is turned *off*
// here and never on — turning it on opens the picker, which is the person's.
const recording: Recording = {
  start: startTake,
  stop: stopRecording,
  hasPicture,
  sources: () => ({
    screen: capture.sources.screen,
    webcam: capture.sources.webcam,
    microphone: capture.sources.mic,
  }),
  turnOff: async (source: SourceName) => {
    if (source === 'screen') await toggleScreen();
    else if (source === 'webcam') { await toggleWebcam(); syncSources(); }
    else { await toggleMic(); syncSources(); }
  },
  turnOn: async (source: SourceName) => {
    if (source === 'webcam') { await toggleWebcam(); syncSources(); }
    else if (source === 'microphone') { await toggleMic(); syncSources(); }
  },
};

init();
