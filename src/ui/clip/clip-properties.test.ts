import { describe, expect, it } from 'vitest';

import { clipProperties, clipProperty, registerClipProperty, seedableClipProperties, annotationColour, type ClipProperty } from './clip-properties.js';
import { ClipProperties } from '../../domain/clip/ClipProperties.js';
import type { Clip } from '../../domain/clip/Clip.js';

// The register, proved in node: the properties the app offers, and that a new property needs
// no change to the panel or anywhere else — which is what the seam exists for.

describe('the clip property register', () => {
  it('offers the title, the description, the logo, the switches, the annotation colour, the size and the export resolution, in order', () => {
    // The switch sits below the three things the card draws, because it is their switch.
    expect(clipProperties().map(property => property.id)).toEqual([
      'title', 'description', 'logo', 'addToExport', 'annotationColour', 'soundBoost', 'size', 'exportResolution',
    ]);
    expect(clipProperty('title')?.label).toBe('Title');
    expect(clipProperty('description')?.control).toBe('long-text');
    expect(clipProperty('addToExport')?.control).toBe('toggle');
    expect(clipProperty('annotationColour')?.control).toBe('colour');
    expect(clipProperty('size')?.readOnly).toBe(true);
    expect(clipProperty('exportResolution')?.control).toBe('choice');
  });

  it('answers null for a property this build does not offer', () => {
    expect(clipProperty('subtitle')).toBeNull();
  });

  it('reads and writes the value on the clip\'s own properties', () => {
    const title = clipProperty('title')!;
    const properties = ClipProperties.EMPTY;
    expect(title.value(properties)).toBe('');
    const next = title.with(properties, 'A demo')!;
    expect(title.value(next)).toBe('A demo');
  });

  it('takes a new property, and it is listed beside the two without either changing', () => {
    const before = clipProperty('title')?.label;
    const subtitle: ClipProperty = {
      id: 'subtitle',
      label: 'Subtitle',
      control: 'text',
      value: properties => properties.get('subtitle'),
      with: (properties, value) => properties.with('subtitle', value),
    };
    registerClipProperty(subtitle);
    expect(clipProperty('subtitle')?.id).toBe('subtitle');
    expect(clipProperties().map(property => property.id)).toContain('subtitle');
    expect(clipProperty('title')?.label).toBe(before);
  });

  it('keeps the switch as "true" or nothing, whatever it is handed', () => {
    const addToExport = clipProperty('addToExport')!;
    expect(addToExport.value(ClipProperties.EMPTY)).toBe('');
    const on = addToExport.with(ClipProperties.EMPTY, 'true')!;
    expect(addToExport.value(on)).toBe('true');
    expect(addToExport.value(addToExport.with(on, 'false')!)).toBe('');
    expect(addToExport.value(addToExport.with(on, 'no')!)).toBe('');
  });

  it('offers the boost as a switch that is on until the clip says otherwise', () => {
    const boost = clipProperty('soundBoost')!;
    expect(boost.control).toBe('toggle');
    expect(boost.seedable).toBe(true);
    // The first property whose default is on: a clip that never set it reads as on.
    expect(boost.value(ClipProperties.EMPTY)).toBe('true');
    // Its off is a stored 'false', not an empty value — an empty one would be deleted, and
    // "fixed off" would be lost.
    const off = boost.with(ClipProperties.EMPTY, '')!;
    expect(off.get('soundBoost')).toBe('false');
    expect(boost.value(off)).toBe('');
    // Anything that is not 'true' is off, as for the card's switch, and on clears it back.
    expect(boost.value(boost.with(off, 'true')!)).toBe('true');
    expect(boost.with(off, 'true')!.get('soundBoost')).toBe('');
    expect(boost.value(boost.with(ClipProperties.EMPTY, 'nonsense')!)).toBe('');
    // It is always the person's to move: no reason blocks it.
    expect(boost.blocked).toBeUndefined();
  });

  it('blocks the switch until the clip has something to put on the card', () => {
    const addToExport = clipProperty('addToExport')!;
    // Nothing to draw: the switch is not the person's to move.
    expect(addToExport.blocked?.(ClipProperties.EMPTY)).not.toBeNull();
    // Any one of the three the card draws is enough — a title, a description or a logo.
    expect(addToExport.blocked?.(ClipProperties.EMPTY.with('title', 'A demo'))).toBeNull();
    expect(addToExport.blocked?.(ClipProperties.EMPTY.with('description', 'What it shows'))).toBeNull();
    expect(addToExport.blocked?.(ClipProperties.EMPTY.with('logo', 'democlip'))).toBeNull();
    // A switch already on stays movable, so the card can always be taken back off — even
    // after the last word has been cleared from it.
    expect(addToExport.blocked?.(ClipProperties.EMPTY.with('addToExport', 'true'))).toBeNull();
    // It is the switch's own rule: every other property is always the person's to move.
    expect(clipProperty('title')?.blocked).toBeUndefined();
    expect(clipProperty('description')?.blocked).toBeUndefined();
    expect(clipProperty('logo')?.blocked).toBeUndefined();
  });

  it('does not offer the card to a clip with no picture for it to be drawn on', () => {
    const addToExport = clipProperty('addToExport')!;
    const soundOnly = { takes: { count: () => 1 }, hasPicture: () => false } as unknown as Clip;
    expect(addToExport.blocked?.(ClipProperties.EMPTY.with('title', 'A demo'), soundOnly))
      .toBe('clip.addToExport.blockedSoundOnly');
  });

  it('offers the clip size as a value the person does not set', () => {
    const size = clipProperty('size')!;
    expect(size.readOnly).toBe(true);
    // Nothing to write: the size follows the takes, so the property refuses any value.
    expect(size.with(ClipProperties.EMPTY, '1920x1080')).toBeNull();
    // And with no clip handed in there is no derived size to show.
    expect(size.value(ClipProperties.EMPTY)).toBe('');
  });

  it('offers the export resolution as a list of the app\'s levels, with the clip size above them', () => {
    const resolution = clipProperty('exportResolution')!;
    expect(resolution.control).toBe('choice');
    expect(resolution.seedable).toBe(true);
    // The list is the property's own, so neither the panel nor a profile's sheet names it: **Clip
    // size** (the default) first, then every level the app offers, high to low.
    expect(resolution.choices).toEqual([
      { value: '', label: 'Clip size' },
      { value: '2160', label: '2160p' },
      { value: '1440', label: '1440p' },
      { value: '1080', label: '1080p' },
      { value: '720', label: '720p' },
      { value: '480', label: '480p' },
    ]);
  });

  it('takes one of the app\'s levels, and nothing else, or the clip size', () => {
    const resolution = clipProperty('exportResolution')!;
    expect(resolution.value(ClipProperties.EMPTY)).toBe('');
    const chosen = resolution.with(ClipProperties.EMPTY, '1080')!;
    expect(resolution.value(chosen)).toBe('1080');
    // An empty value is the clip size — the one representation of "unset", so the default holds.
    expect(resolution.value(resolution.with(chosen, '')!)).toBe('');
    // A value the app does not offer is refused rather than kept: a profile written elsewhere or
    // an agent is the other way a value arrives.
    expect(resolution.with(ClipProperties.EMPTY, '999')).toBeNull();
    expect(resolution.with(ClipProperties.EMPTY, '1080p')).toBeNull();
  });

  it('does not offer the export resolution to a clip with no picture to write', () => {
    const resolution = clipProperty('exportResolution')!;
    // An empty clip is not blocked: a person or a profile may set it before the first take.
    expect(resolution.blocked?.(ClipProperties.EMPTY)).toBeNull();
    const soundOnly = { takes: { count: () => 1 }, hasPicture: () => false } as unknown as Clip;
    expect(resolution.blocked?.(ClipProperties.EMPTY, soundOnly)).toBe('clip.exportResolution.blockedSoundOnly');
  });

  it('marks the logo, the switch, the annotation colour, the boost and the export resolution as what a profile may control', () => {
    // What a profile may declare; the title, the description and the read-only size are never a
    // profile's.
    expect(seedableClipProperties().map(property => property.id)).toEqual(['logo', 'addToExport', 'annotationColour', 'soundBoost', 'exportResolution']);
  });

  it('makes a new annotation red until the clip is told another colour', () => {
    // The clip's own answer, which the creation canvas and the agent's maker both ask: unset is
    // the app's red, not empty and not a kind's fallback.
    expect(annotationColour(ClipProperties.EMPTY)).toBe('#e53e3e');
    const blue = clipProperty('annotationColour')!.with(ClipProperties.EMPTY, '#3182ce')!;
    expect(annotationColour(blue)).toBe('#3182ce');
    // A value that is not one of the palette's is answered with the red rather than a broken
    // colour, even though the property would not have written it.
    expect(annotationColour(ClipProperties.EMPTY.with('annotationColour', '#123456'))).toBe('#e53e3e');
  });

  it('offers the palette as a list, by its values, and refuses a colour it does not hold', () => {
    const colour = clipProperty('annotationColour')!;
    expect(colour.control).toBe('colour');
    // The label a choice carries is its value; the person reads the colour's own name from the
    // catalogue where it is drawn (`ui/i18n/labels.ts`), so the domain holds no words.
    expect(colour.choices).toEqual([
      { value: '#e53e3e', label: '#e53e3e' },
      { value: '#ff6c23', label: '#ff6c23' },
      { value: '#ffffff', label: '#ffffff' },
      { value: '#f6e05e', label: '#f6e05e' },
      { value: '#38a169', label: '#38a169' },
      { value: '#3182ce', label: '#3182ce' },
      { value: '#111827', label: '#111827' },
    ]);
    // The list is not the only way a value arrives — a profile written elsewhere, an agent — so
    // a colour outside the palette is refused rather than kept.
    expect(colour.with(ClipProperties.EMPTY, '#123456')).toBeNull();
    expect(colour.with(ClipProperties.EMPTY, 'red')).toBeNull();
    expect(colour.value(colour.with(ClipProperties.EMPTY, '#111827')!)).toBe('#111827');
  });

  it('offers the marks the app ships as a list, with None above them', () => {
    const logo = clipProperty('logo')!;
    expect(logo.control).toBe('choice');
    // The list is the property's own, so neither surface has to name it: **None** first, then
    // every mark the app serves, in the order it serves them.
    expect(logo.choices).toEqual([
      { value: '', label: 'None' },
      { value: 'democlip', label: 'DemoClip' },
      { value: 'graditone', label: 'Graditone' },
    ]);
    // A property that is not a list offers none.
    expect(clipProperty('title')?.choices).toBeUndefined();
  });

  it('takes the name of a logo the app ships, and nothing else, or nothing at all', () => {
    const logo = clipProperty('logo')!;
    expect(logo.value(ClipProperties.EMPTY)).toBe('');

    const worn = logo.with(ClipProperties.EMPTY, 'democlip')!;
    expect(logo.value(worn)).toBe('democlip');
    // A clip with no logo is the ordinary case, and an empty value clears it.
    expect(logo.value(logo.with(worn, '')!)).toBe('');
    // A name the app does not ship is refused rather than kept — the list is not the only way a
    // value arrives (a profile written elsewhere, an agent), and none of them may leave an export
    // waiting for a file that will never draw.
    expect(logo.with(ClipProperties.EMPTY, 'nope')).toBeNull();
    // Surrounding space is the person's typing, not part of the name.
    expect(logo.value(logo.with(ClipProperties.EMPTY, '  democlip  ')!)).toBe('democlip');
  });
});
