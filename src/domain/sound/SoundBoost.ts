// The sound boost: the clip property that turns it on, the app's one target, and the gain.
//
// It is one rule in two halves. The first is the switch — a clip property like **Add to
// export**, on unless the clip says otherwise, which a **profile** may fix. The second is
// what a measured sound is brought to: one **−16 LUFS** target for speech, held below a
// **−1.5 dBFS** ceiling, as a single gain applied to every sample alike.
//
// It is **one gain for the whole clip**, never a curve over time: a correction that moved
// moment to moment would be compression, which the feature deliberately does not do. That
// is also what makes the boost reversible — the recorded sound is never changed, only scaled
// as it is heard and written — and instant once the measurement is known.
//
// Nothing here touches a browser: the measurement is arithmetic (`Loudness`) and the gain is
// arithmetic over its two numbers. The id lives here so the descriptor the panel draws, the
// export plan and the review all read the one string.

import type { ClipProperties } from '../clip/ClipProperties.js';

/** The clip property's id, in one place: the descriptor, the plan and the review share it. */
export const BOOST_ID = 'soundBoost';

/** The stored value that means the switch is **off**. Unset means on, the property's default. */
export const OFF = 'false';

/** The one target, a speech target: where a player expects a voice to sit. */
export const TARGET_LUFS = -16;

/** The ceiling no boosted sample passes, which leaves a true peak a little room above it. */
export const PEAK_CEILING_DBFS = -1.5;

/**
 * Is this clip's sound boosted? True unless the clip holds {@link OFF}, so a clip that never
 * set the switch — the ordinary case — is boosted.
 */
export function boostsSound(properties: ClipProperties): boolean {
  return properties.get(BOOST_ID) !== OFF;
}

/**
 * The gain that brings a measured sound to the target, one number for the whole clip.
 *
 * It is the lift the target asks for, capped so the peak lands on the ceiling rather than
 * past it: a recording with a normal peak is lifted all the way, and one already near the
 * top is lifted only as far as the ceiling allows. A sound louder than the target comes
 * **down**, because a set of clips at one loudness is the point. Silence — nothing above the
 * gate, so no loudness to speak of — answers `1`: there is nothing to bring up.
 */
export function gainFor(lufs: number, peakDb: number): number {
  if (!Number.isFinite(lufs)) return 1;
  const toTarget = TARGET_LUFS - lufs;
  const toCeiling = Number.isFinite(peakDb) ? PEAK_CEILING_DBFS - peakDb : Infinity;
  return 10 ** (Math.min(toTarget, toCeiling) / 20);
}
