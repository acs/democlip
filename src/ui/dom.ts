// Central element registry and low-level view helpers.
//
// Every other module reads DOM nodes from here instead of calling
// getElementById itself, so the markup-to-code coupling lives in one place.

export function byId<T extends Element>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`DemoClip: missing #${id}`);
  return node as unknown as T;
}

export const el = {
  cv:        byId<HTMLCanvasElement>('preview'),
  sv:        byId<HTMLVideoElement>('sv'),
  rv:        byId<HTMLVideoElement>('rv'),
  idleOv:    byId<HTMLElement>('idle-ov'),
  badge:     byId<HTMLElement>('rec-badge'),
  timeline:  byId<HTMLElement>('timeline'),
  recBtn:    byId<HTMLButtonElement>('rec-btn'),
  ctrl:      byId<HTMLElement>('ctrl'),
  ring3:     byId<HTMLElement>('ring-3'),
  sText:     byId<HTMLElement>('s-text'),
  recLbl:    byId<HTMLElement>('rec-lbl'),
  btnNew:    byId<HTMLButtonElement>('btn-new'),
  btnExp:    byId<HTMLButtonElement>('btn-exp'),
  expMenu:   byId<HTMLElement>('exp-menu'),
  expWebm:   byId<HTMLButtonElement>('exp-webm'),
  expMp4:    byId<HTMLButtonElement>('exp-mp4'),
  expEditing: byId<HTMLButtonElement>('exp-editing'),
  expBluesky: byId<HTMLButtonElement>('exp-bluesky'),
  expYoutube: byId<HTMLButtonElement>('exp-youtube'),
  pubBd:     byId<HTMLElement>('pub-bd'),
  pubClose:  byId<HTMLButtonElement>('pub-close'),
  pubSigninView: byId<HTMLElement>('pub-signin-view'),
  pubHandle: byId<HTMLInputElement>('pub-handle'),
  pubSignin: byId<HTMLButtonElement>('pub-signin'),
  pubComposeView: byId<HTMLElement>('pub-compose-view'),
  pubAs:     byId<HTMLElement>('pub-as'),
  pubSignout: byId<HTMLButtonElement>('pub-signout'),
  pubText:   byId<HTMLTextAreaElement>('pub-text'),
  pubAlt:    byId<HTMLInputElement>('pub-alt'),
  pubCancel: byId<HTMLButtonElement>('pub-cancel'),
  pubGo:     byId<HTMLButtonElement>('pub-go'),
  pubStatus: byId<HTMLElement>('pub-status'),
  pubError:  byId<HTMLElement>('pub-error'),
  ytBd:      byId<HTMLElement>('yt-bd'),
  ytClose:   byId<HTMLButtonElement>('yt-close'),
  ytNote:    byId<HTMLElement>('yt-note'),
  ytSigninView: byId<HTMLElement>('yt-signin-view'),
  ytSignin:  byId<HTMLButtonElement>('yt-signin'),
  ytComposeView: byId<HTMLElement>('yt-compose-view'),
  ytAs:      byId<HTMLElement>('yt-as'),
  ytSignout: byId<HTMLButtonElement>('yt-signout'),
  ytTitle:   byId<HTMLInputElement>('yt-title'),
  ytDescription: byId<HTMLTextAreaElement>('yt-description'),
  ytVisibility: byId<HTMLSelectElement>('yt-visibility'),
  ytCancel:  byId<HTMLButtonElement>('yt-cancel'),
  ytGo:      byId<HTMLButtonElement>('yt-go'),
  ytStatus:  byId<HTMLElement>('yt-status'),
  ytError:   byId<HTMLElement>('yt-error'),
  playhead:  byId<HTMLElement>('playhead'),
  playBtn:   byId<HTMLButtonElement>('play-btn'),
  tNow:      byId<HTMLElement>('t-now'),
  waveform:  byId<HTMLCanvasElement>('waveform'),
  thumbs:    byId<HTMLElement>('thumbs'),
  tlMarks:   byId<HTMLElement>('tl-marks'),
  tlAnnots:  byId<HTMLElement>('tl-annots'),
  tClip:     byId<HTMLElement>('t-clip'),
  toastEl:   byId<HTMLElement>('toast'),
  agentChip: byId<HTMLElement>('agent-chip'),
  tSize:     byId<HTMLElement>('t-size'),
  tCut:      byId<HTMLElement>('t-cut'),
  tLabels:   byId<HTMLElement>('t-labels'),
  tLive:     byId<HTMLElement>('t-live'),
  tLiveTime: byId<HTMLElement>('t-live-time'),
  tlLabel:   byId<HTMLElement>('tl-label'),
  cutWrap:     byId<HTMLElement>('t-cut-wrap'),
  cutUndo:  byId<HTMLButtonElement>('cut-undo'),
  helpBd:    byId<HTMLElement>('help-bd'),
  helpSteps: byId<HTMLElement>('help-steps'),
  helpBtn:   byId<HTMLButtonElement>('help-btn'),
  helpClose: byId<HTMLButtonElement>('help-close'),
  ver:       byId<HTMLAnchorElement>('ver'),
  verNew:    byId<HTMLButtonElement>('ver-new'),
  helpVer:   byId<HTMLElement>('help-ver'),
  screenBtn: byId<HTMLButtonElement>('screen-btn'),
  webcamBtn: byId<HTMLButtonElement>('webcam-btn'),
  camPickBtn: byId<HTMLButtonElement>('cam-pick-btn'),
  fileBtn:   byId<HTMLButtonElement>('file-btn'),
  fileInput: byId<HTMLInputElement>('file-input'),
  camMenu:   byId<HTMLElement>('cam-menu'),
  propMenu:  byId<HTMLElement>('prop-menu'),
  propsBtn:  byId<HTMLButtonElement>('props-btn'),
  annotateBar: byId<HTMLElement>('annotate-bar'),
  clipPropMenu: byId<HTMLElement>('clip-prop-menu'),
  textEntry: byId<HTMLElement>('text-entry'),
  textEntryInput: byId<HTMLInputElement>('text-entry-input'),
  textEntryCancel: byId<HTMLButtonElement>('text-entry-cancel'),
  textEntryAdd: byId<HTMLButtonElement>('text-entry-add'),
  wcv:       byId<HTMLVideoElement>('wcv'),
  micBtn:    byId<HTMLButtonElement>('mic-btn'),
  vu:        byId<HTMLElement>('vu'),
  vuFill:    byId<HTMLElement>('vu-fill'),
  metaTheme: byId<HTMLMetaElement>('meta-theme'),
  themeIco:  byId<SVGElement>('theme-ico'),
  themeBtn:  byId<HTMLButtonElement>('theme-btn'),
  profileBtn:  byId<HTMLButtonElement>('profile-btn'),
  profileInitials: byId<HTMLElement>('profile-initials'),
  profileMenu: byId<HTMLElement>('profile-menu'),
  profileDefBd:    byId<HTMLElement>('profile-def-bd'),
  profileDefTitle: byId<HTMLElement>('profile-def-title'),
  profileDefRows:  byId<HTMLElement>('profile-def-rows'),
  profileDefDone:  byId<HTMLButtonElement>('profile-def-done'),
};

export const ctx: CanvasRenderingContext2D = (() => {
  const c = el.cv.getContext('2d');
  if (!c) throw new Error('DemoClip: 2D canvas context unavailable');
  return c;
})();

// Seconds as m:ss, for the readouts in the timeline.
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Say what the app is doing: announced by the page's live region, drawn nowhere. */
export function setStatus(txt: string): void {
  el.sText.textContent = txt;
}

let toastTimer: number | undefined;
export function toast(msg: string, dur = 3000): void {
  el.toastEl.textContent = msg;
  el.toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toastEl.classList.remove('show'), dur);
}
