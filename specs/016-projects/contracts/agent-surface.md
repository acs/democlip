# Contract — the page's automation surface, extended with projects

The app publishes `window.democlip` only when the page is opened with `?agent=1`. The
surface is the whole of what an agent can do. This document is the shape the MCP server
and the page agree on; the server calls it by dotted path (`projects.list`), as it calls
`edit.cut` today.

Every operation answers a **result**, never throws for an app-level refusal:

```ts
type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string }
```

## The new group

```ts
interface ProjectsSurface {
  /** Every project, the current one marked. Read-only. */
  list(): Result<{ projects: ProjectSummary[]; currentId: string }>;

  /** One project's description, recordings and progress. Read-only. */
  read(id: string): Result<{ project: ProjectSummary; recordings: RecordingSummary[]; progress: Progress }>;

  /** A new project. It becomes current when the session has not begun to capture. */
  create(input: { name: string; motivation?: string; objectives?: string }): Result<{ id: string; current: boolean }>;

  /** Make a project current. Refused once the session has begun to capture. */
  select(id: string): Result<{ currentId: string }>;

  /** Change a project's description or default profile. */
  edit(id: string, input: { name?: string; motivation?: string; objectives?: string; defaultProfile?: string }): Result<{ project: ProjectSummary }>;

  /** Move a recording to a project — the Default project is how a recording is "removed". */
  move(recordingId: string, projectId: string): Result<{ recordingId: string; projectId: string }>;
}
```

There is deliberately **no** `delete` and **no** `removeProject`. Deletion needs the
person's confirmation and is not on the surface; the spec fixes this boundary.

## Shapes

```ts
interface ProjectSummary {
  readonly id: string;
  /** The display name; "Default" for the built-in project. */
  readonly name: string;
  readonly motivation: string;
  readonly objectives: string;
  readonly defaultProfile: { readonly id: string; readonly name: string };
  readonly recordingCount: number;
  readonly current: boolean;
}

interface RecordingSummary {
  readonly id: string;
  /** The clip's title, or the fallback label the list shows. */
  readonly title: string;
  /** Seconds; the sum of the recording's takes. */
  readonly length: number;
  /** "in-progress" for the open recording with a take, otherwise "finished". */
  readonly state: 'in-progress' | 'finished';
  readonly projectId: string;
  /** The profile the recording was made under, from its snapshot. */
  readonly profileName: string;
  readonly createdAt: number;
}

interface Progress {
  readonly total: number;
  readonly finished: number;
  readonly inProgress: number;
}
```

## Refusals the agent must expect

| Operation | Refused when | `reason` says |
|---|---|---|
| `create` | the name is empty or already used | which rule the name broke |
| `create` | the session has begun to capture | the project joins the list but does not become current |
| `select` | the id names no project | the projects that exist |
| `select` | the session has begun to capture | the project is fixed until the session ends |
| `edit` | the project is Default and `name` is given | the Default project cannot be renamed |
| `edit` | the default profile names no profile | the profiles that exist |
| `move` | the recording or the project is missing | what exists |
| `move` | the recording is the open one and the session has begun to capture | it may be moved when the session ends |
| any | the page was opened without `?agent=1` | there is no surface at all |

A successful change is visible in the person's window without a reload: `create`,
`select`, `edit` and `move` redraw the pill, the menu and the overview through the same
change events the person's own actions use.

## Version gate

The surface's `version` is the app's own. The server refuses a page whose version differs
from its own, as it does today, so a new server never calls `projects.*` on an old page.