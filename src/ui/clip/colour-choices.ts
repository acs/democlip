// The control a **colour** clip property is edited with, shared by the clip's own panel and a
// profile's sheet.
//
// One button per colour the property offers, each showing the colour itself beside its name — so
// a list of words is never the only thing a person has to tell red from orange by. The chosen one
// is pressed, and the palette is the property's own (`ClipProperty.choices`), so neither surface
// knows which property it is drawing.
//
// The **free** state is a profile's alone: a clip always holds a colour (unset reads as the app's
// red), where a profile may fix nothing and leave the item the person's. There it leads, as
// **Not fixed**, and answers `null` so the caller hands the item back rather than setting it.

import type { PropertyChoice } from './clip-properties.js';

export interface ColourChoiceOptions {
  /** What the group is called for a screen reader: the property's label. */
  readonly label: string;
  readonly choices: readonly PropertyChoice[];
  /** The colour the property holds now, or '' when it holds none. */
  readonly value: string;
  /** Is the item free — a profile that fixes nothing? Undefined when there is no free state. */
  readonly free?: boolean;
  readonly disabled?: boolean;
  /** A colour was picked, or `null` for free. */
  pick(value: string | null): void;
}

/** The group of colour buttons a colour property is edited with. */
export function colourChoices(options: ColourChoiceOptions): HTMLElement {
  const group = document.createElement('div');
  group.className = 'colour-choices';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', options.label);

  if (options.free !== undefined) {
    group.append(choiceButton({
      label: 'Not fixed',
      value: null,
      pressed: options.free,
      disabled: options.disabled === true,
      free: true,
      pick: options.pick,
    }));
  }

  for (const choice of options.choices) {
    group.append(choiceButton({
      label: choice.label,
      value: choice.value,
      colour: choice.value,
      pressed: !options.free && choice.value === options.value,
      disabled: options.disabled === true,
      free: false,
      pick: options.pick,
    }));
  }

  return group;
}

interface ButtonOptions {
  readonly label: string;
  readonly value: string | null;
  /** The colour to show beside the name; none for the free state. */
  readonly colour?: string;
  readonly pressed: boolean;
  readonly disabled: boolean;
  readonly free: boolean;
  pick(value: string | null): void;
}

function choiceButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = options.free ? 'colour-choice colour-choice-free' : 'colour-choice';
  button.dataset.value = options.value ?? 'free';
  button.setAttribute('aria-pressed', String(options.pressed));
  button.disabled = options.disabled;

  if (options.colour) {
    const dot = document.createElement('span');
    dot.className = 'colour-choice-dot';
    dot.style.background = options.colour;
    button.append(dot);
  }

  const label = document.createElement('span');
  label.className = 'colour-choice-label';
  label.textContent = options.label;
  button.append(label);

  button.addEventListener('click', () => options.pick(options.value));
  return button;
}