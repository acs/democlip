// The sound: the fourth kind, and the first with nothing to draw.
//
// The section arms this kind and it is placed at once, over the selected stretch, in the app's
// default **stock sound** — so it plays immediately — and its **preferences** open, where the
// person chooses which of the app's sounds it is. The sound and how long it plays are the
// kind's **properties**, edited in the one shared inspector every kind's properties are edited
// in; there is no file dialog, because the sounds are the app's own.
//
// Everything else — picking it on the lane, copying it, deleting it, undoing, saving, exporting
// — is the shared canvas's and the clip's, and this file writes none of it. It draws nothing:
// its renderer is deliberately empty, and the layer would skip a kind with no renderer anyway.
//
// It is its own renderer as well as its plugin: one object, one id, like the arrow, the image
// and the text.

import { SoundAnnotation } from '../../domain/annotation/SoundAnnotation.js';
import { DEFAULT_STOCK_SOUND } from '../../domain/sound/StockSounds.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type AnnotationProperty, type CreationContext,
} from './annotation-plugin.js';

const NO_SOUND = 'SOUND — that sound could not be added';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

/** The sound kind in the view: its action, its property, and how a new one is made. */
export class SoundPlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = SoundAnnotation.id;

  readonly action: AnnotationAction = {
    label: 'Sound',
    title: 'Add a sound over this section',
    icon: ACTION_ICON,
  };

  /** A sound is heard, not drawn: it needs no picture to be offered on. */
  readonly needsPicture = false;

  /** What can be changed after it is placed: which stock sound it plays. */
  readonly properties: readonly AnnotationProperty[] = [
    {
      id: 'sound',
      label: 'Sound',
      control: 'sound',
      value: annotation => (annotation instanceof SoundAnnotation ? annotation.geometry.sound : DEFAULT_STOCK_SOUND),
      with: (annotation, value) =>
        annotation instanceof SoundAnnotation ? annotation.withSound(value) : null,
    },
  ];

  /** The kind is its own renderer; it paints nothing. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  draw(): void {
    /* A sound is heard, not drawn: nothing appears over the picture, ever. */
  }

  begin(ctx: CreationContext): void {
    const annotation = SoundAnnotation.create(ctx.span, DEFAULT_STOCK_SOUND);
    if (!annotation) { ctx.cancel(NO_SOUND); return; }
    // It plays at once; the choice of which sound is one press away. The canvas opens a kind
    // with no box on the picture its preferences on commit, so this kind needs no knowledge of
    // the inspector — and stays free of the DOM.
    ctx.commit(annotation);
  }
}

// One sound kind: the section offers its action, and the lane marks it.
export const soundPlugin = new SoundPlugin();
registerRenderer(soundPlugin);
registerPlugin(soundPlugin);
