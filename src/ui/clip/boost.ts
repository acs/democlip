// The sound boost in the review: the gain the clip's sound sits at while it is heard.
//
// It is the same number the export applies — both ask `boostGain` over the same kept sound —
// so what the person hears is what the file will carry. Here it only sets a gain node, made
// when the review opens and again when the clip's own sound or switch moves; a play and a
// toggle cost nothing, because the measurement behind it is cached against the sound.
//
// The measurement decodes the clip's sound once, which is the one cost the feature adds to a
// review: it is taken in the background when the review opens, so the first press of play is
// almost always after it. Where it is not, the first moments are heard at the recorded level
// and step to the boosted one when the number lands.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { planExport } from '../../application/export-clip.js';
import { boostGain } from '../../infra/sound-boost.js';
import { boostsSound } from '../../domain/sound/SoundBoost.js';
import { FADE_S, setBoostGain } from './fade.js';
import { waveform } from './waveform.js';

/** The gain the review's sound sits at now: 1 until a measurement says otherwise. */
let gain = 1;
/** Which measurement the review is waiting on, so a stale one does not land on a moved clip. */
let revision = 0;

/** The gain the review is playing at, which the transport asks before it starts. */
export function boostNow(): number {
  return gain;
}

/**
 * Take the gain again: the recorded level when the switch is off or there is no sound, and
 * otherwise the one the measurement asks for. A measurement already taken for this sound is
 * reused, so only a clip whose sound has moved pays for a new one.
 */
export function refreshBoost(): void {
  const clip = session.clip;
  if (currentPhase() !== 'review' || !boostsSound(clip.properties) || !clip.keepsSound()) {
    set(1);
    return;
  }
  // The same plan the export builds, so the review and the file measure the same stretches.
  const plan = planExport(clip, { fadeSeconds: FADE_S, annotations: 'drawn', intro: null });
  if (!plan) { set(1); return; }
  const mine = ++revision;
  void boostGain(plan, true)
    .then(value => { if (mine === revision) set(value); })
    .catch(() => { if (mine === revision) set(1); });
}

/** The clip is gone: the sound is the recorded one again. */
export function clearBoost(): void {
  revision++;
  set(1);
}

function set(value: number): void {
  gain = value;
  setBoostGain(value);
  // The bars are the sound at the level it is heard: the review plays the boosted sound, so
  // the waveform under it shows the same level rather than a level nobody will hear.
  waveform.setGain(value);
}

/**
 * The clip's own changes that can move the gain: its switch, and its sound — a take arriving
 * or a cut changing which stretches the file holds. An annotation or a word moves neither.
 */
export function initBoost(): void {
  session.clip.onChange(event => {
    if (event.type === 'cleared') { clearBoost(); return; }
    if (event.type === 'take-added' || event.type === 'cut-approved'
      || event.type === 'cut-undone' || event.type === 'property-changed') {
      refreshBoost();
    }
  });
}
