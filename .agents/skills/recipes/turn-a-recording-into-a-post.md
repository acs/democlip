---
name: turn-a-recording-into-a-post
description: Cut a recording down to what earns its place and publish it to Bluesky from the account signed in in that window.
tools: [describe_clip, cut, seek, publish_clip]
outside: none
proved: reasoned
---

# Turn a recording into a post

**Goal.** A short clip, published.

**Steps.** `describe_clip`, `cut` the stretches that do not earn their place, `seek`
to a moment to check it, then `publish_clip` with `text` and `alt` — from the account
signed in in that window. A `publish_clip` with nobody signed in is refused, and
nothing leaves the machine.

**Caveats.** Not run yet. `publish_clip` posts from the person's own Bluesky account,
so ask before it runs. Everything before it is undoable; the post is not.
