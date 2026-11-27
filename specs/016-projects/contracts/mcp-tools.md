# Contract — the MCP tools for projects

The server offers one tool per operation the app publishes, named in the app's vocabulary.
These six are added to the existing list. Every tool ends in a `projects.*` call on the
page's automation surface; the tool list **is** the agent's boundary.

| Tool | Arguments | Answers |
|---|---|---|
| `list_projects` | none | every project with its description, default profile, recording count and whether it is current |
| `read_project` | `project` (id or name) | the project's description, its recordings with title, length and state, and the progress |
| `create_project` | `name`, `motivation`?, `objectives`? | the new project's id, and whether it became current |
| `select_project` | `project` (id or name) | the current project's id |
| `edit_project` | `project`, `name`?, `motivation`?, `objectives`?, `defaultProfile`? | the changed project |
| `move_recording` | `recording` (id), `project` (id or name) | the recording and its new project |

`move_recording` is also how a recording is **removed** from a project: it moves it to the
Default project, whose id is `default`. There is no `delete_recording` and no
`remove_project`; requesting one is answered as an unknown tool, not as a refusal, because
the list is the boundary.

## Input schemas

The server validates arguments the way it validates the existing tools: a JSON Schema per
tool, an unknown name refused with the available projects named.

```jsonc
// list_projects
{ "type": "object", "properties": {}, "additionalProperties": false }

// read_project
{
  "type": "object",
  "properties": { "project": { "type": "string", "description": "The project's id or its name" } },
  "required": ["project"],
  "additionalProperties": false
}

// create_project
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "The project's name; required and unique" },
    "motivation": { "type": "string", "description": "Why the project exists — may be empty" },
    "objectives": { "type": "string", "description": "What it must achieve — may be empty" }
  },
  "required": ["name"],
  "additionalProperties": false
}

// select_project
{
  "type": "object",
  "properties": { "project": { "type": "string", "description": "The project's id or its name" } },
  "required": ["project"],
  "additionalProperties": false
}

// edit_project
{
  "type": "object",
  "properties": {
    "project": { "type": "string", "description": "The project's id or its name" },
    "name": { "type": "string", "description": "A new name; the Default project cannot be renamed" },
    "motivation": { "type": "string", "description": "The project's motivation" },
    "objectives": { "type": "string", "description": "The project's objectives" },
    "defaultProfile": { "type": "string", "description": "The id or name of a profile in the book" }
  },
  "required": ["project"],
  "additionalProperties": false
}

// move_recording
{
  "type": "object",
  "properties": {
    "recording": { "type": "string", "description": "The recording's id, from read_project" },
    "project": { "type": "string", "description": "The project's id or name; \"default\" moves it to Default" }
  },
  "required": ["recording", "project"],
  "additionalProperties": false
}
```

## What an agent is told

- Every tool's description says what it does in the app's words, and where a refusal comes
  from: the capture latch, the Default project's immunity, a missing profile, a missing
  recording.
- `read_project` exposes the progress the overview shows, so "what is left?" is answered
  in one exchange (SC-008).
- No tool takes a path, reads a file, or reaches the network. Projects are local data; the
  only file tools remain `import_take` and the publishing pair, unchanged.

## Release coupling

The server is released with the app and checks the page's `version`. A server that knows
these tools refuses a page that does not publish them, and the release carries both. The
MCP test suite asserts the tool list contains exactly these six added names and no
deletion tool.