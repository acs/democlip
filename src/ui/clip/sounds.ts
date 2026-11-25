// The added sounds in the review: a stock sound plays as the playhead crosses it, and a sound
// is heard from its own **play** button before it is chosen.
//
// The review plays the recording through the media element and **jumps over cuts by seeking**, so
// kept time is not linear and a sound cannot be pre-scheduled against the audio clock — a cut jump
// would move the clock under the schedule. Instead the playback loop says where the playhead is in
// **kept** time each frame, and this module plays a sound whose start the playhead has just crossed,
// stopping it at its end. A pause, a seek or a cut jump resets the crossing, so a jump fires nothing
// and a backward seek fires nothing twice — and the sounds it plays are the plan's own `soundings()`,
// the same the file is mixed from, so the review and the file place a sound at the same moment.
//
// The sounds have their **own** `AudioContext` — not the media-element graph the recording plays
// through. That graph is made by routing the `<video>` element into it, which a browser may refuse
// (and then the recording plays on by itself and the boost's node is never made); the added sounds
// do not need it, and routing them through their own context means they are heard whatever the
// element's graph does — and they sit beside the recording rather than inside the boost, which is
// what the mix asks for anyway.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { planExport } from '../../application/export-clip.js';
import { stockSounds } from '../../infra/stock-sounds.js';
import { SOUND_LEVEL } from '../../domain/sound/StockSounds.js';
import type { Sounding } from '../../domain/clip/ExportPlan.js';
import { FADE_S } from './fade.js';
import { toast } from '../dom.js';

/** The kept parts of the clip's sound annotations, in the file's own seconds. */
let soundings: readonly Sounding[] = [];
/** Where the playhead was last seen, in kept time; -1 means "no crossing is owed". */
let lastKept = -1;
/** The sounds currently playing, so a reset can stop them. */
let playing: AudioBufferSourceNode[] = [];

/** The context the added sounds play from — their own, made once, resumed on the press. */
let ctx: AudioContext | null = null;

function soundsContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { ctx = new Ctx(); } catch { return null; }
  return ctx;
}

/** Watch the clip: its sounds, its cuts and its length all move where a sound lands. */
export function initSounds(): void {
  session.clip.onChange(event => {
    if (event.type === 'cleared') { clearSounds(); return; }
    if (event.type === 'annotation-added' || event.type === 'annotation-removed'
      || event.type === 'annotation-changed' || event.type === 'take-added'
      || event.type === 'cut-approved' || event.type === 'cut-undone') {
      refreshSounds();
    }
  });
  refreshSounds();
}

/** Take the sounds and where they land again — the review's answer, from the clip's own plan. */
export function refreshSounds(): void {
  resetSounds();
  if (currentPhase() !== 'review' || !(session.clip.total() > 0)) { soundings = []; return; }
  const plan = planExport(session.clip, { fadeSeconds: FADE_S, annotations: 'drawn', intro: null });
  soundings = plan?.soundings() ?? [];
  // Decode them now, so a play is not a decode at the moment the sound is due.
  for (const name of new Set(soundings.map(sounding => sounding.sound))) void stockSounds.buffer(name);
}

/** The clip is gone: nothing to play. */
export function clearSounds(): void {
  resetSounds();
  soundings = [];
}

/**
 * Make the sounds' context ready to play, on the press that starts playback. A browser starts a
 * context suspended, and only a gesture may resume it — so it is awoken here, on the play press,
 * rather than mid-playback where there is no gesture and an un-resumed context plays nothing.
 */
export function unlockSounds(): void {
  const context = soundsContext();
  if (context && context.state !== 'running') void context.resume().catch(() => {});
}

/** Stop everything and forget the crossing — a pause, a seek or a cut jump. */
export function resetSounds(): void {
  lastKept = -1;
  for (const source of playing) {
    try { source.stop(); } catch { /* already stopped or never started */ }
  }
  playing = [];
}

/**
 * The playhead is at `kept` (seconds of kept time). Play the sound it has just crossed while
 * moving forward; on a fresh start — a resume, a seek, a backward move — play whatever sound
 * it lands **inside** (so a resume picks a sound up where it had got to) and start crossing
 * from here.
 */
export function tickSounds(kept: number): void {
  if (!(kept >= 0)) return;
  if (lastKept < 0 || kept < lastKept) {
    lastKept = kept;
    for (const sounding of soundings) {
      if (kept >= sounding.at && kept < sounding.at + sounding.length) play(sounding, kept);
    }
    return;
  }
  for (const sounding of soundings) {
    if (lastKept < sounding.at && kept >= sounding.at) play(sounding, kept);
  }
  lastKept = kept;
}

/** Start one sound, late by however long the frame took, and stop it at the end of its part. */
function play(sounding: Sounding, kept: number): void {
  const buffer = stockSounds.get(sounding.sound);
  if (!buffer) return;
  const late = Math.max(0, kept - sounding.at);
  startOnce(sounding.sound, sounding.from + late, sounding.length - late, false);
}

/**
 * Play a stock sound once, from the start — what the preferences' own **play** button does, so
 * a person hears a sound before choosing it. It is the app's own file, at the same level the
 * review and the file mix it at, and it is decoded on first use if it has not been already.
 */
export function previewStockSound(name: string): void {
  const buffer = stockSounds.get(name);
  if (buffer) { startOnce(name, 0, buffer.duration, true); return; }
  void stockSounds.buffer(name).then(ready => {
    if (!ready) { toast('That sound could not be read'); return; }
    startOnce(name, 0, ready.duration, true);
  });
}

/**
 * Start one sound of the app's own, once, over the given stretch of it. The context is resumed on
 * the press that asks for it — a preview is a person's click, and a browser starts a context
 * suspended — and the sound is started only once the context is really running, so it is not
 * scheduled onto a context that is still waking up. `speakUp` is for a **preview**, which should
 * say so when the browser will not give audio at all; a sound in the playing review stays silent.
 */
function startOnce(name: string, offset: number, length: number, speakUp: boolean): void {
  if (!(length > 0) || !(SOUND_LEVEL > 0)) return;
  const context = soundsContext();
  if (!context) {
    if (speakUp) toast('Sound needs audio, which this browser did not give');
    return;
  }
  const begin = (): void => {
    const buffer = stockSounds.get(name);
    if (!buffer) return;
    const from = Math.max(0, offset);
    if (from >= buffer.duration) return;             // already past the end of the sound
    const forHow = Math.min(length, buffer.duration - from);
    if (!(forHow > 0)) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = SOUND_LEVEL;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => { playing = playing.filter(s => s !== source); };
    playing.push(source);
    try {
      source.start(context.currentTime, from, forHow);
    } catch {
      playing = playing.filter(s => s !== source);
      if (speakUp) toast('That sound would not play');
    }
  };
  if (context.state === 'running') { begin(); return; }
  // Suspended until a gesture: this press is the gesture, so resume and then play.
  void context.resume().then(begin).catch(begin);
}
