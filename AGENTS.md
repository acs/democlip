# DemoClip — start here

Before exploring the code, load the **Project overview** skill: what the app is,
the flow it is built around, the runtime objects and their lifetimes, where each
kind of code lives, and which document owns which fact. Then **docs/GLOSSARY.md** — the
words, and the words we do not use.

- **Finding code:** prefer the **codebase-memory MCP** (`search_graph`,
  `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`) over grep
  for anything structural. The project is not indexed by default — run
  `index_repository` once (mode `fast` browses fine) if you want it.
- **Making a change:** the **Project workflow** skill — a branch starts from the
  remote `main` (`origin/main`), one change per pull request, and CI owns the
  version, so never bump `package.json` by hand — and the
  **Verification** skill: a rule in `src/domain/` is proved by a unit test, and
  anything drawn, played or encoded needs a browser harness.
- **The logo and the name:** the **Branding** skill — the mark is an image and the
  name is live text, so the app sets its font; the colours come from `logo.svg`,
  and the files that carry the text banner are only for places with no CSS.
- **Understanding the domain:** the **Domain ontology** skill — the problem domain
  (the reality: actors, goals, processes, channels, constraints) and the solution
  domain (how the app models it), the rules that hold, and the traceability to the
  code — in `docs/ontology/`, kept in step by `npm run ontology:check`.
