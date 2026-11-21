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
  sDot:      byId<HTMLElement>('s-dot'),
  sText:     byId<HTMLElement>('s-text'),
  recLbl:    byId<HTMLElement>('rec-lbl'),
  btnNew:    byId<HTMLButtonElement>('btn-new'),
  btnExp:    byId<HTMLButtonElement>('btn-exp'),
  expMenu:   byId<HTMLElement>('exp-menu'),
  expWebm:   byId<HTMLButtonElement>('exp-webm'),
  expMp4:    byId<HTMLButtonElement>('exp-mp4'),
  expEditing: byId<HTMLButtonElement>('exp-editing'),
  expBluesky: byId<HTMLButtonElement>('exp-bluesky'),
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
  playhead:  byId<HTMLElement>('playhead'),
  playBtn:   byId<HTMLButtonElement>('play-btn'),
  tNow:      byId<HTMLElement>('t-now'),
  waveform:  byId<HTMLCanvasElement>('waveform'),
  thumbs:    byId<HTMLElement>('thumbs'),
  tlMarks:   byId<HTMLElement>('tl-marks'),
  tlAnnots:  byId<HTMLElement>('tl-annots'),
  tClip:     byId<HTMLElement>('t-clip'),
  toastEl:   byId<HTMLElement>('toast'),
  resBadge:  byId<HTMLElement>('res-badge'),
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
  helpBtn:   byId<HTMLButtonElement>('help-btn'),
  helpClose: byId<HTMLButtonElement>('help-close'),
  ver:       byId<HTMLElement>('ver'),
  verNew:    byId<HTMLButtonElement>('ver-new'),
  helpVer:   byId<HTMLElement>('help-ver'),
  screenBtn: byId<HTMLButtonElement>('screen-btn'),
  webcamBtn: byId<HTMLButtonElement>('webcam-btn'),
  camPickBtn: byId<HTMLButtonElement>('cam-pick-btn'),
  fileBtn:   byId<HTMLButtonElement>('file-btn'),
  fileInput: byId<HTMLInputElement>('file-input'),
  camMenu:   byId<HTMLElement>('cam-menu'),
  propMenu:  byId<HTMLElement>('prop-menu'),
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

export function setStatus(cls: string, txt: string): void {
  el.sDot.className = 's-dot ' + cls;
  el.sText.textContent = txt;
}

let toastTimer: number | undefined;
export function toast(msg: string, dur = 3000): void {
  el.toastEl.textContent = msg;
  el.toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toastEl.classList.remove('show'), dur);
}
