---
name: point-at-what-matters
description: Place a tutorial's arrows and labels by time, using the app's own annotations so they play back, export and undo like any other.
tools: [describe_clip, annotate, set_property, remove_annotation]
outside: none
proved: reasoned
---

# Point at what matters

**Goal.** A tutorial's arrows and labels, placed by time.

**Steps.** `describe_clip` for the takes and the length, then `annotate` once per
mark — `arrow` with `from` and `to` fractions, or `text` with `x`, `y` and `height` —
each over its own `span`. `set_property` colours one, `remove_annotation` takes it
back. The marks are the app's, so they play back, export and undo like any other.

**Caveats.** Not run yet. The geometry is fractions of the picture, so a mark placed
against one crop can miss after a re-record — place marks once the takes are final.
