// The clip, described as data.
//
// The read side of the automation surface: what an agent can see before it decides
// what to do. It reads the clip and the kinds' own property descriptors — and the
// clip's own, from the same register the properties panel reads — so the agent is
// offered exactly what a person would be offered, the same list from the same place,
// so the two cannot disagree.
//
// It takes the clip as an argument rather than reaching for the session, so it is
// free of the DOM and can be proved in node. It changes nothing.

import type { Clip } from '../../domain/clip/Clip.js';
import { propertiesOf } from '../annotating/annotation-plugin.js';
import { clipProperties } from '../clip/clip-properties.js';
import type { Controlling } from '../profile/control.js';
import type { AnnotationSummary, ClipDescription, TakeSummary } from './surface.js';

export function describeClip(clip: Clip, controlling: Controlling = () => null): ClipDescription {
  const takes: TakeSummary[] = [];
  for (let index = 0; index < clip.takes.count(); index++) {
    const take = clip.takes.at(index);
    if (take) takes.push({ index, seconds: take.duration });
  }

  const annotations: AnnotationSummary[] = clip.annotations.all.map(annotation => ({
    id: annotation.id,
    kind: annotation.kind,
    span: { s: annotation.span.s, e: annotation.span.e },
    properties: propertiesOf(annotation).map(property => ({
      id: property.id,
      label: property.label,
      control: property.control,
      value: property.value(annotation),
    })),
  }));

  return {
    length: clip.total(),
    keptLength: clip.keptLength(),
    takes,
    cuts: clip.cuts.spans.map(span => ({ s: span.s, e: span.e })),
    annotations,
    properties: clipProperties().map(property => ({
      id: property.id,
      label: property.label,
      control: property.control,
      value: property.value(clip.properties, clip),
      // Read-only for a derived property, and for one a profile fixes: either way it is not
      // the person's to set, which is what an agent is told here.
      readOnly: !!property.readOnly || controlling(property.id) !== null,
    })),
  };
}
