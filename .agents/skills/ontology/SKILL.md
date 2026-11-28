---
name: Domain ontology
description: The model of the audiovisual-production domain DemoClip works in — the problem domain (the reality: actors, goals, processes, channels, constraints) and the solution domain (how the app models it, concept by concept), with the rules that hold and the traceability between them. Use before starting a development, when planning a change, when a requirement's place in the domain is unclear, or when you need to know what a change touches.
---

# Domain ontology

`docs/ontology/` holds one model of the domain, made so a person or an agent can find
what matters **before** changing anything. It is not a glossary: definitions live in
`docs/GLOSSARY.md`; the ontology holds the **structure** — which concepts exist, how they
relate, which layer of reality each belongs to, what rules hold them, and where each one
lives in the code.

## When to use it

- **Before a development.** Find the concepts the change touches, the rules it must keep,
  and the problem concern it serves — before reading the code.
- **When a requirement's place is unclear.** Decide whether it belongs to the *problem*
  (a reality the app does not yet model) or the *solution* (how the app models one).
- **When planning impact.** Follow a concept's relations and its traceability to the code
  and the specs, to see everything a change reaches.
- **When naming something new.** A new concept gets an id here, and a new *word* goes into
  `docs/GLOSSARY.md` first — that rule is `.agents/skills/domain-model`.

## The two layers

- the **problem domain** — the reality: *why the product exists*. Actors, goals, the
  production lifecycle, channels, constraints, and the gaps the app does not model yet.
  `docs/ontology/problem-domain.md`.
- the **solution domain** — how DemoClip materialises it: *how the product works*.
  Concepts, their home in the four layers, the concept map, and the two lifecycles.
  `docs/ontology/solution-domain.md`.

A solution concept **realises** a problem concept. A problem concept nothing realises is a
**gap**, and it is written down as one — that is how the model tells you where the product
could grow.

## How to navigate

| you want to know | read |
|---|---|
| why the app exists, who it is for, what it must do | `docs/ontology/problem-domain.md` |
| how the app models that, concept by concept, and where in the code | `docs/ontology/solution-domain.md` |
| what must stay true, who owns it, where it is proved | `docs/ontology/rules.md` |
| the graph as data, to read or query | `docs/ontology/ontology.jsonld` |
| what a word means | `docs/GLOSSARY.md` |
| what the app is, in one sitting | the **Project overview** skill |

A concept has an **id** (kebab-case, unique across both layers): `clip`, `production`,
`sound-boost`. The Markdown refers to a concept as **`[[id]]`**; the graph uses the same
id as the node's `@id`. So the graph and the pages are one model seen two ways.

## The graph

`docs/ontology/ontology.jsonld` is JSON-LD: a node per concept (`Actor`, `Goal`,
`Process`, `Concept`, `Constraint`, `SolutionConcept`, `Rule`), the relations between
them, and each rule's `owner` and `proof`. Read the whole file — it is not large enough to
need a query tool, and every node carries a one-line `summary`. Use it when you want to
list everything of a kind, follow relations mechanically, or check a change against the
rules.

## Keeping it in step

The graph is the machine source and the Markdown is the human view; a change to the
concepts, their relations, their traceability or the rules updates **both, in the same
pull request**. Run the check before committing:

```bash
npm run ontology:check
```

It fails on a malformed graph, a relation or owner pointing at a concept that does not
exist, or a `[[id]]` in a page that resolves to nothing — and it warns about a node no
page refers to. That is the whole of what keeps the two from drifting.

## Adding a concept

1. Add the **word** to `docs/GLOSSARY.md` first, if it is a new word.
2. Add a node to `ontology.jsonld`: `@id`, `@type`, `label`, `layer`, `area`, a one-line
   `summary`, and — for a solution concept — `definedIn` and `implementedBy`; for a
   problem concept, what realises it, if anything.
3. Add it to the page it belongs on, referring to it as `[[id]]`, and to the diagram if
   the relation is worth seeing.
4. Run `npm run ontology:check`.
