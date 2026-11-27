# Phase 1 — Data model

**Feature**: Projects · **Date**: 2026-11-27

Words are those of `docs/GLOSSARY.md` once this feature's section is added. Nothing here
stores a fact that can be derived, and every invariant names the class that enforces it.

## Entities

### Project

One body of work and its reason. A value object with identity, held by `Projects`.

| Field | Type | Rule |
|---|---|---|
| `id` | `string` | Generated at creation; never empty; never reused. The Default project's id is the constant `default`. |
| `name` | `string` | Trimmed, required. Unique among the person's projects, ignoring case and surrounding spaces. The Default project's name is `Default` and cannot change. |
| `motivation` | `string` | Free text; may be empty; preserved exactly as written. |
| `objectives` | `string` | Free text; may be empty; preserved exactly as written. |
| `defaultProfileId` | `string` | Not empty. Must name a profile in the book when set; resolved to the built-in Default on read when it does not. |

**Derived**: `description` is the pair (motivation, objectives) shown together; it is not a
stored field. `Project.description()` returns both for the overview and the agent.

**Rules owned by `Project`**: a usable id and a non-empty name (`create`, `restore`);
`renamed(name)` refuses an empty name; `describing(motivation, objectives)` keeps the
text verbatim; `withDefaultProfile(id)` refuses an empty id. Nothing here knows about
recordings, profiles as a book, or storage.

### Projects (the book)

The set, the current one, and the Default one. Holds:

| Field | Type | Rule |
|---|---|---|
| `projects` | `Project[]` | Always at least one: the built-in Default, first. Order is the person's. |
| `currentId` | `string` | Always names a project in the book; repaired to Default when it does not. |

**Rules owned by `Projects`**:

- `starting()` is the app with nothing set up: the Default project alone, current.
- `of(stored)` treats the stored book as untrusted: entries that cannot be restored are
  dropped; a stored entry claiming the Default id is replaced by the app's own Default;
  a duplicate id is dropped; a `currentId` naming nothing lands on Default.
- `create(project)` refuses an id already present and a name already used (case- and
  space-insensitive), including the Default's name.
- `rename(id, name)` refuses the Default project, a missing project and an empty name.
- `remove(id)` refuses the Default project and a missing one; when the removed project was
  current, the current one becomes Default.
- `select(id)` refuses a missing project.
- `setDefaultProfile(id, profileId)` refuses a missing project and an empty profile id.
  The **use case** additionally checks that the profile exists in the profile book.

### ClipProfile

The snapshotted production configuration a recording is made under. A value object in
`src/domain/clip/ClipProfile.ts`.

| Field | Type | Rule |
|---|---|---|
| `id` | `string` | The profile's id at snapshot time. Never empty. |
| `name` | `string` | The profile's name at snapshot time; what the lock's tooltip says. Never empty. |
| `controls` | `Readonly<Record<string, string>>` | The declarations, copied. A key present is a declaration; the value may be empty (a switch fixed off). |

**Derived**: `declares(propertyId)`, `valueFor(propertyId)` — the same questions `Profile`
answers, so the panel and the surface ask one shape.

**Built-in**: `ClipProfile.DEFAULT` is `{ id: 'default', name: 'Default', controls: {} }`
— the free profile an old recording reads as.

### Clip (extended)

The existing aggregate; two additions.

| Field | Type | Rule |
|---|---|---|
| `profile` | `ClipProfile` | Starts as `ClipProfile.DEFAULT`; set from the draft's project default. `chooseProfile(profile)` succeeds only while `takes.isEmpty()`; with a take it refuses, and the profile is fixed for the life of the recording. |
| `snapshot()` / `restore()` | `ClipSnapshot` | `profile` is written and read. A snapshot without it restores as `ClipProfile.DEFAULT`. |

`clear()` returns the clip to `ClipProfile.DEFAULT`; the new-draft flow then snapshots the
current project's default onto it.

**Applying a profile.** Whenever a draft is made or its profile changes, the **seedable**
clip properties the snapshot declares are applied through `Clip.applyProperty` — a load,
not the person's edit, and never something the one undo takes back. An item the old
profile declared and the new one does not keeps the value it holds and becomes the
person's, exactly as changing profiles does today; an item neither declares is already
the person's.

### Session (extended)

The sitting: the clip, the capture latch, and the open recording's identity.

| Field | Type | Rule |
|---|---|---|
| `clip` | `Clip` | As today. |
| `hasCaptured` | `boolean` | As today: the latch a profile/project choice is fixed by. |
| `recordingId` | `string` | The open recording's id — a draft id before the first take. Set when a recording is opened or a draft started. |
| `projectId` | `string` | The project the open recording belongs to. |

`Session.end()` still clears the clip and lowers the latch; `Session.close()` lowers them
without clearing the clip, which is what an export leaves behind. The **flow** finishes the
recording and starts the next draft around that event, because the store is the browser's.

### Recording (stored)

A clip written down with the facts that place it. The record is data, not a second
aggregate: the clip owns every rule about its content.

| Field | Type | Rule |
|---|---|---|
| `id` | `string` | The open recording's id; the `adopted` id for the migration. |
| `projectId` | `string` | Exactly one project. A value naming no project reads as Default. |
| `profile` | `ClipProfile` | The snapshot; see above. |
| `createdAt` | `number` | Epoch milliseconds of the first take. Used for the fallback label and ordering. |
| `duration` | `number` | `Clip.total()` cached for the list; refreshed on every meta write. |
| `count` | `number` | Number of takes; the list does not read take bytes. |
| `cuts` | `{ s, e }[]` | Fractions of the recording, as today. |
| `annotations` | `StoredAnnotation[]` | As today. |
| `properties` | `Record<string, string>` | What the clip says about itself, as today. |
| `watermark` | `string[]` | As today. |
| `audio` | `boolean` | As today, the fallback for a take whose blob will not say. |

**Derived**: `state` is `in-progress` when the recording is the open one and has a take,
otherwise `finished`. `title` is `properties.title`, or the fallback label from the
project's name and `createdAt`. `progress` is `finished / total` for a project.

### The open pointer

`app.current = { recordingId, projectId, profile, createdAt }` in IndexedDB. It names the clip
the session holds, whether that is a draft with no takes or a recording being made, and it
keeps the profile chosen for a draft before its first take. It is written in
the same transaction as the recording's first meta, so a recorded take can never exist
without the pointer that reveals it.

## Storage

### IndexedDB `democlip`, version 4

| Store | Key | Value | Written when |
|---|---|---|---|
| `recordingMeta` | recording id | the meta above | a take arrives; a cut, annotation or property changes (debounced) |
| `recordingTakes` | `[recordingId, index]` | `{ blob, duration, picture, hasAudio }` | a take arrives |
| `recordingImages` | `[recordingId, imageId]` | `Blob` | a picture is placed |
| `app` | `'current'` | `{ recordingId, projectId }` | a draft starts, a recording opens, a session ends |
| `meta`, `takes`, `images` | old keys | the previous version's one clip | read once by the migration, then cleared |

The old `clip` store (pre-version 3) stays deleted on upgrade, as today.

### localStorage

| Key | Value |
|---|---|
| `democlip_projects` | `{ version, currentId, projects: [...] }` |
| `democlip_profiles` | unchanged |
| `democlip_theme` | unchanged |

A read of the project book repairs whatever it cannot use and never throws, exactly as
`Profiles.of` does.

## State transitions

```
        (new draft)                first take                 session ends
none ───────────────▶ draft ──────────────────▶ in progress ──────────────▶ finished
                        │                          ▲   │                        │
                        │ session ends             │   │ open it again          │
                        └──────────────▶ none ◀────┘   └────────────────────────┘
                                    (draft with no take just ends)
```

- **draft → in progress**: the first take (recorded or imported) writes the meta and the
  recording joins its project.
- **in progress → finished**: **New**, an export or a publish. The meta is flushed and the
  pointer is dropped. On New the clip is cleared and a fresh draft begins; an export or a
  publish leaves its clip on screen, finished and no longer kept, so another file may be
  written from it.
- **finished → in progress**: opening the recording restores it into the clip and points
  the pointer at it; takes may be added.
- **finished → none**: a draft with no take has nothing to finish; the pointer simply moves
  on.
- **removed**: a recording's `projectId` becomes Default. Its state and bytes do not change.
- **deleted**: only from Default, only by the person, after a confirmation; takes, meta
  and images go in one transaction.
- **project removed**: each of its recordings' `projectId` becomes Default, then the
  project leaves the book. An interruption leaves recordings pointing at a missing
  project, which reads as Default.

## Invariants

1. At least one project exists; exactly one is current; the Default project is always
   present and can be neither renamed nor removed. (`Projects`)
2. A project's name is required and unique among the person's projects. (`Projects`)
3. A recording belongs to exactly one project at all times. (the stored record's shape)
4. At most one recording is open; every other recording is finished. (the open pointer)
5. A recording's profile is fixed once it has a take; the configuration in force is the
   snapshot, not the live profile. (`Clip`)
6. A recording is in exactly one of two states, derived from the session and never stored.
7. Deleting a recording is the only operation that destroys recorded bytes; a removal
   moves it to Default. (`Recordings`, `RecordingStorePort`)
8. The agent's tool list contains no deletion and no project removal. (`mcp/src/tools.ts`)

## Validation owned by the layers

| Concern | Owner |
|---|---|
| Name required, trimmed, unique; Default immunity; current fallback | `Project`, `Projects` |
| Default profile id non-empty; profile exists when set | `Project`; `ManageProjects` with the profile book |
| Profile may change only before capture; snapshot round trip | `Clip` |
| Finished/in-progress derivation; which recording is open | `Session` + `Recordings` |
| One transaction for meta + pointer; migration idempotence | `recording-store.ts`, `adopt-recording.ts` |
| Confirmation before delete; Default-only deletion; no agent deletion | `ui/project/delete-recording.ts`; `mcp/src/tools.ts` |
| Repair of untrusted stored data | `Projects.of`, `recording-store` read path |