---
name: Recipes
description: Workflows worth writing down — how an agent reaches a goal DemoClip does not cover end to end, the bar a recipe must clear, and an index of the ones written down. Read this first, then only the recipe you need.
---

# Recipes

DemoClip's job is to record, cut, annotate, export and publish — and to stay small
enough to keep doing it. Everything else is a **recipe**: a workflow someone asks for,
composed from the app's own operations, driven through the MCP server, and — when the
app cannot finish it — tools outside it (ffmpeg, a shell, whatever the machine has).

A recipe is the alternative to a feature. Adding a scenario to the app would mean
another surface to build, test and carry; composing it costs a file and leaves the app
as it was. So the first question about a scenario is not "how should the app do this?"
but "which operations already compose it?".

## The bar

Write a recipe down when it is a **goal someone asks for** and the sequence is **not
obvious from the tool list**. The tools name operations, not outcomes: nothing in `cut`
and `publish_clip` says which stretches to drop before posting, or that a mark placed
before a re-record may miss. That is the knowledge a recipe carries, and the reason to
write one down.

Two things follow. A recipe that only restates a single tool earns nothing and is left
out. And `outside` is an **attribute, not a test**: it says what the recipe drags in —
ffmpeg, nothing, a shell — so a reader knows the cost before opening it. A recipe with
`outside: none` is as much a recipe as one that needs ffmpeg.

## The recipes

One file each, beside this one. Read the one you need — the index is here so you never
have to read the rest.

| recipe | does | composes | outside |
|---|---|---|---|
| [take-the-silence-out](take-the-silence-out.md) | Drops the quiet stretches, non-destructively | `export_clip`, `describe_clip`, `cut` | ffmpeg |
| [polish-the-exported-file](polish-the-exported-file.md) | Loudness, size and container, one way | `export_clip` | ffmpeg |
| [point-at-what-matters](point-at-what-matters.md) | A tutorial's arrows and labels, by time | `describe_clip`, `annotate`, `set_property`, `remove_annotation` | — |
| [turn-a-recording-into-a-post](turn-a-recording-into-a-post.md) | Cuts a recording down and publishes it | `describe_clip`, `cut`, `seek`, `publish_clip` | — |

## The seam: analyse outside, edit inside

Put **analysis** outside the app and the **edit** inside it, whenever the recipe can.
The app's edit model is what makes a result non-destructive: a cut is a `Span` in the
clip's `SpanSet`, so it is one `undo` to take back, it re-encodes nothing, and the
export lays its pieces out around it. Anything that instead re-encodes the media gives
that up, so it earns its place only when the app cannot express the edit at all.

| the recipe needs | it belongs to |
|---|---|
| to know something about the media — silence, loudness, a frame | outside: ffmpeg, or a decode in the agent |
| to change the clip | inside: `cut`, `annotate`, `set_property`, `remove_annotation` |
| a kind of change the operations cannot express | neither yet — a product decision |

## The bound

The agent reaches the app's own operations and nothing more — the tool list in
`mcp/src/tools.ts`, and `specs/006-democlip-mcp/contracts/mcp-tools.md` for the
vocabulary. So a recipe can compose only what those expose. When a scenario needs an
operation that is not there, that is a **product decision**: bring the number and the
trade, and ask (see the project-workflow skill).

## Writing a recipe down

One recipe, one file, named for what it does, with frontmatter so it can be found
without being read:

```yaml
---
name: take-the-silence-out                  # the file's name, without .md
description: Drop the quiet stretches from a clip, keeping the edit
  non-destructive — ffmpeg finds them, the app's cut takes them out.
tools: [export_clip, describe_clip, cut]    # the app's operations, as the tools name them
outside: ffmpeg                             # what it drags in; none when it is all app
proved: run                                 # run once it has been run end to end, else reasoned
---
```

Then, in the body: **Goal**, **Steps**, **Caveats**, and **Why not a feature** when the
recipe exists because the app lacks the capability. Name each operation as the tools
name it. Say the level of proof in the verification skill's terms, and record the
number that mattered — the duration, the ratio, the byte size. A recipe that was
reasoned about but never run says so.

Add the file to the index above in the same change, or it will not be found.

## Where a recipe travels

These files are already in the format MCP reads: a directory holding a `SKILL.md` whose
frontmatter carries `name` and `description`, with the rest referenced relative to it.
MCP's **Skills over MCP** extension (`io.modelcontextprotocol/skills`, SEP-2640, Beta)
serves exactly that shape over the existing `resources` primitive, discovered through
`skills/list` and `skills/get`, so a client could load these recipes from the server
itself rather than from a checkout.

Serving them is not built yet, and two things have to be settled first. The extension
requires a skill's `name` to match its directory, so a served copy would be
`name: recipes` — the repo's skills use Title Case and would each need the same
treatment. And a skill is read only by an agent that has it installed, so today these
reach agents working in the repo; reaching the agent driving the app through MCP is
the follow-up this section names.
