// The colour a toolbar pill wears: the one of the entry it opens.
//
// A pill is a button, so it follows the app's palette: the opaque `--control` surface,
// the `--control-line` border and the `--control-text` label. The entry's colour is
// carried as **ink and border**, never as a fill — the row's avatar keeps the filled
// badge. A profile that fixes an annotation colour wears that colour; one that fixes
// none wears the tone its id gives it, and a project wears its own salt tone.
//
// A fixed annotation colour is arbitrary — white and black are both in the palette — so
// it is moved toward the surface's opposite until it reads there. The calculation runs
// against the live control surface, so the same colour yields ink that works in either
// theme when it is painted.

import type { AnnotationColour } from '../../domain/annotation/AnnotationColour.js';

const TONES = ['av-0', 'av-1', 'av-2', 'av-3', 'av-4'] as const;

export interface PillColour {
  /** The colour a profile fixes, when it fixes one; null for a tone. */
  readonly colour: AnnotationColour | null;
  /** The entry's own tone, 0..4 — the same number its row avatar uses. */
  readonly tone: number;
}

/** Paint a pill: a fixed colour made readable, or the entry's own tone. */
export function paintPill(button: HTMLElement, options: PillColour): void {
  button.classList.remove(...TONES, 'wears-colour');
  button.style.removeProperty('--pill-tone');

  if (options.colour) {
    button.style.setProperty('--pill-tone', readableInk(options.colour, controlSurface(button)));
    button.classList.add('wears-colour');
    return;
  }

  const tone = ((Math.trunc(options.tone) % TONES.length) + TONES.length) % TONES.length;
  button.classList.add(TONES[tone]!, 'wears-colour');
}

/**
 * The surface a control sits on. Read from the theme's `--bg` rather than from the
 * button's computed background: a theme switch transitions that background, and the
 * answer is needed for the surface the theme has already chosen.
 */
function controlSurface(button: HTMLElement): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    || getComputedStyle(button).backgroundColor;
}

/** The ink a colour needs to read as a label on the given surface, at 4.5:1. */
function readableInk(colour: string, surface: string): string {
  const ink = channels(colour);
  const ground = channels(surface);
  // A light surface needs a darker ink, a dark one a lighter ink.
  const target: Channel = luminance(ground) > 0.4 ? [8, 9, 26] : [255, 255, 255];

  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = blend(ink, target, amount);
    if (contrast(candidate, ground) >= 4.5) return hex(candidate);
  }
  return hex(target);
}

type Channel = readonly [number, number, number];

/** Read `#rrggbb` or the `rgb(r, g, b)` the browser gives for a computed colour. */
function channels(value: string): Channel {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex?.[1]) {
    return [0, 2, 4].map(at => parseInt(hex[1]!.slice(at, at + 2), 16)) as unknown as Channel;
  }
  const numbers = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return [Number(numbers[0] ?? 0), Number(numbers[1] ?? 0), Number(numbers[2] ?? 0)];
}

/** A colour moved `amount` of the way toward another, channel by channel. */
function blend(from: Channel, to: Channel, amount: number): Channel {
  return from.map((value, at) => value + (to[at]! - value) * amount) as unknown as Channel;
}

/** How bright a colour is, linearised as WCAG measures it. */
function luminance(colour: Channel): number {
  const [r, g, b] = colour.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio between two colours, which the WCAG asks to be at least 4.5:1. */
function contrast(a: Channel, b: Channel): number {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (bright + 0.05) / (dark + 0.05);
}

function hex(colour: Channel): string {
  return `#${colour.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}
