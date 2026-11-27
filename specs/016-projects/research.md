# Phase 0 — Research

**Feature**: Projects · **Date**: 2026-11-27

The spec left no `NEEDS CLARIFICATION`; the five questions were answered in
`spec.md`. What follows are the design decisions that turn those answers into code,
with the alternatives that were rejected. Each is a decision the plan depends on.

## R1 — A recording is the clip plus a small record, stored under its own id

**Decision.** A **recording** is identified by a generated id. Its bytes and its facts
are kept in IndexedDB under that id:

- `recordingMeta`, keyed by recording id: `{ version, projectId, profile, createdAt,
  duration, count, cuts, annotations, properties, watermark, audio }` — small, rewritten
  on every change, exactly as today's `meta` record is.
- `recordingTakes`, keyed by `[recordingId, index]`: `{ blob, duration, picture, hasAudio }`
  — written once as a take arrives, never rewritten.
- `recordingImages`, keyed by `[recordingId, imageId]`: the pictures an image annotation
  draws, written once.

`duration` is written into the meta on a take, so listing a project reads small records
only and never opens take bytes. It is a cache of `Clip.total()`, never a second source
of truth; the clip derives its length from the takes.

**Rationale.** The existing store already splits the blobs from the small half for the
same reason — a cut must not rewrite 24 MB of recording. Generalising the key to a
recording is the smallest change that holds many recordings.

**Alternatives considered.**
- *One IndexedDB store holding the whole `ClipSnapshot` per recording.* Rejected: every
  cut would rewrite the take blobs.
- *A store per recording (a database each).* Rejected: IndexedDB databases are heavy and
  the migration across many would be harder to make atomic.
- *Keeping project membership in the project book instead of the recording.* Rejected:
  every take save would also have to save the book; a failed book write would strand a
  recording. Membership on the recording makes "a recording belongs to one project" the
  shape of the record.

## R2 — The open recording is the in-progress one; a session ending finishes it

**Decision.** At most one recording is open at a time. The app keeps an **open pointer**
in IndexedDB — `app.current = { recordingId, projectId }` — for the clip the session
holds, whether or not it has a take yet.

- A take (or an import) first ensures the recording's meta exists under the open id; the
  recording then joins its project's list.
- A recording counts as **in progress** when it is the open one and has at least one
  take; every other recording is **finished**. `finished` is therefore derived, never
  stored.
- Ending a session — **New**, an export or a publish — writes any pending meta and drops
  the open pointer. New clears the clip and starts a fresh draft; an export or publish
  leaves its clip on screen, finished and no longer kept, so a second file may be written.
- Opening a recording loads its snapshot into the clip and points the open pointer at it;
  it is in progress until that session ends, takes included.

The `Session` keeps its two facts (the clip and the capture latch) and gains the open
recording's identity, so the "finished" answer and the project switching refusal have one
owner. Ending stays one event, as today.

**Rationale.** The person's rule — "finished when the related Clip Session is finished" —
becomes a derivation instead of a flag that can drift. A crash or a reload mid-session
restores exactly the open recording, which is what the existing resume already does for
one clip.

**Alternatives considered.**
- *A stored `finished` boolean.* Rejected: it must be maintained on every end, export and
  reopen; a missed update makes the overview lie. The open pointer cannot disagree with
  the session.
- *Every recording with takes is finished immediately.* Rejected: the open one would count
  as finished while it is still being made, and progress would start at 100%.
- *A session per project.* Rejected: the app has one clip open; projects do not multiply
  editors.

## R3 — The clip carries a profile snapshot; the lock reads the snapshot

**Decision.** `Clip` gains a `profile: ClipProfile`, where `ClipProfile` is `{ id, name,
controls }` — the profile's declarations copied when the recording starts under it. The
clip's profile may be changed (`Clip.chooseProfile`) only while the clip has no takes;
from the first take it is fixed for the life of the recording.

- `Clip.snapshot()` writes the profile; `Clip.restore()` reads it. A clip written before
  projects reads as the built-in **Empty** profile with no declarations, so an old
  recording gains no new lock over values it already holds.
- The one `Controlling` seam — asked by the properties panel and the agent description —
  reads `clip.profile.controls` instead of the book's active profile.
- A project's default profile is snapshotted onto a fresh draft when the draft is made,
  and again when the person changes the draft's profile.
- Changing the project's default affects drafts made afterwards; a recording already made
  keeps its snapshot. A profile edited, renamed or removed later never reaches a recording
  already made, which is the clarification's answer.

The profile book is unchanged in what it stores. `Profiles.activeId` remains the book's
"last chosen" value for compatibility, but the app's source of truth for what is in force
is the clip's snapshot; the toolbar pill shows the clip's profile. `ManageProfiles` keeps
its rules; the choice for a clip goes through the clip's own rule.

**Rationale.** The spec's clarification says the recording keeps the configuration it was
made with. A snapshot is the only way to keep the lock honest after the profile is edited
or deleted; an id alone would either follow the live profile (wrong) or lose the lock when
the profile disappears (also wrong).

**Alternatives considered.**
- *Store only the profile id and read the live declarations.* Rejected: editing a profile
  would retroactively change finished recordings, which the clarification forbids.
- *Snapshot the values into clip properties only (today's seeding).* Rejected: the seeded
  properties survive, but the lock and the profile's name would be lost after a reload;
  the properties panel could not say who fixes the item.
- *Add a second kind of configuration for projects.* Rejected: the spec reuses the
  existing profile, and spec 009 stays in force.

## R4 — Project membership lives on the recording; the book holds the projects

**Decision.** The **project book** (`democlip_projects`, localStorage) holds
`{ version, currentId, projects: [{ id, name, motivation, objectives, defaultProfileId }] }`.
Membership is `recordingMeta.projectId`, not a list in the book.

- The book is small and read before any recording, like the profile book.
- Listing a project's recordings reads every recording's meta (small) and filters by
  `projectId`; no index is needed at this scale.
- Removing a project rewrites its recordings' `projectId` to Default, then removes it from
  the book. A recording whose `projectId` names no project reads as Default, so an
  interrupted removal heals on the next read instead of hiding recordings.
- The Default project is created by `Projects.starting()` and repaired by `Projects.of`; it
  cannot be removed or renamed, and its `defaultProfileId` falls back to the built-in
  Default when the named profile is gone.

**Rationale.** The profile book is the precedent: a small JSON book in localStorage, with
the domain repairing untrusted input. Keeping membership on the recording makes the
recording's own record self-contained, which matters when it is moved or deleted.

**Alternatives considered.**
- *The book holds `recordingIds` per project.* Rejected: two writes for every take, and a
  failed book write hides a recording that exists.
- *An IndexedDB index on `projectId`.* Deferred: at tens of recordings, reading the metas
  is simpler; an index can be added later without changing the port.

## R5 — The previous version's clip is adopted atomically, once

**Decision.** The database moves to version 4, adding the recording stores and the `app`
store while leaving the old `takes`, `meta` and `images` stores in place for one start.
An `adopt-recording` step runs before the first read of the open pointer:

1. If `app.current` already exists, there is nothing to adopt.
2. Otherwise, if the old `meta/current` record is usable, write — **in one transaction** —
   a recording under a fixed migration id (`adopted`), its takes, its images, and
   `app.current` pointing at it, with `projectId = 'default'` and the built-in Empty profile
   profile.
3. After the transaction commits, clear the old stores.

A failure before the commit leaves the old stores untouched; a retry writes the same fixed
id, so nothing is duplicated. A failure after the commit leaves harmless old keys that the
next start ignores. The e2e check starts from a version-3 store and asserts the recording
appears in Default with its length, cut and annotation.

**Rationale.** The spec makes data loss the one unacceptable outcome. One transaction for
"the recording and the pointer that reveals it" is what makes a half-run migration
invisible rather than a duplicate or a ghost.

**Alternatives considered.**
- *Migrate inside `onupgradeneeded`.* Rejected: the upgrade transaction's lifetime is
  awkward to keep across blob reads, and a failure aborts the version change, leaving the
  new build unable to open the database at all.
- *Keep reading the old record forever.* Rejected: two code paths, and the old store cannot
  hold a second recording; the first new recording would overwrite it.

## R6 — The app is always in a project, and the open pointer remembers it

**Decision.** `Projects.currentId` is the book's current project. A fresh draft copies it
into `app.current`; selecting a project updates both while the session has not begun to
capture, and is refused afterwards. A reload comes back to the project and recording the
open pointer names. With nothing open, the app starts a draft in the current project and
snapshots that project's default profile onto it.

**Rationale.** The spec's rule is "the app is always in a project"; storing the pointer
with the draft is what makes the statement true across a reload, and it also persists the
profile chosen for an empty draft.

**Alternatives considered.**
- *The current project only in memory until the first take.* Rejected: a reload would
  silently move the person to Default.
- *Ask on every session start.* Rejected by the clarification: the app is always in one.

## R7 — The projects surface is a toolbar pill, a menu and one overview

**Decision.** A project pill sits beside the profile pill in the toolbar, wearing the
current project's initials and naming it in its tooltip. It opens:

- the **project list**: the projects, the current one marked, a way to create one, and the
  pencil that opens a project's dialog;
- the **project dialog**: name, motivation, objectives and default profile; the Default
  project's name is fixed;
- the **overview**: the description, the recordings with title, length and state, the
  count finished against the total, and the actions on a recording (Open, Move to…,
  Remove to Default, and Delete for the Default project).

The overview is a dialog on the app's existing overlay pattern, reachable in two actions
from the main screen: the pill, then the project (or its overview action). Creating a
project is the same flow with an empty form.

**Rationale.** The profile pill is the closest precedent, and reusing the overlay pattern
avoids a second navigation model in a single-page app. The overview is where the spec's
"description, progress and finished recordings" live together.

**Alternatives considered.**
- *A separate projects page.* Rejected: the app is one page; a route would carry the
  review state and break the "nothing leaves the session" shape.
- *A sidebar of projects in the review.* Rejected: it competes with the timeline and the
  picture for room and makes the ordinary flow heavier.

## R8 — The agent organises; it never deletes

**Decision.** The automation surface gains a `projects` group and the MCP server six
tools:

| Tool | Does |
|---|---|
| `list_projects` | the projects, the current one, each with its recording count |
| `read_project` | one project's description, default profile, recordings with title, length and state, and the progress |
| `create_project` | a new project with a name, motivation and objectives |
| `select_project` | make a project current, with the same capture refusal as the person |
| `edit_project` | change a project's description or default profile |
| `move_recording` | move a recording to a project — including the Default project, which is the person's "Remove" |

There is no tool for deleting a recording or removing a project, and no tool that changes
the clip's profile after capture. The surface answers `{ ok: false, reason }` for every
refusal, as it does today.

**Rationale.** The user chose "organise, never destroy"; the tool list is the only bound on
a protocol that cannot be bounded otherwise (the overview skill). Removing a recording is a
move to Default, so it needs no separate destructive tool.

**Alternatives considered.**
- *Full parity including delete.* Rejected by the clarification.
- *A read-only surface.* Rejected: the agent must be able to create, select and move, or it
  cannot work with projects at all.

## R9 — A recording's title is the clip's, with a generated label as the fallback

**Decision.** The list shows the clip's own `title` property when it has one; otherwise a
label built from the project's name and the recording's creation time (for example
"Onboarding videos · 27 Nov, 14:32"). The title is edited as the clip property it already
is. `createdAt` is written into the meta when the recording's first take lands.

**Rationale.** The clip already has a title (it brands its export), so a second naming
field would drift. The fallback keeps a list readable before anyone names a recording.

**Alternatives considered.**
- *A separate recording name property.* Rejected: two names for one thing is what the
  glossary exists to prevent.
- *Always generated.* Rejected: the clip's title is meaningful and already part of the
  export.

## R10 — Images belong to their recording

**Decision.** The image store is scoped by recording: `images.setRecording(id)` when the
open recording changes; writes go under `[recordingId, imageId]`, reads load the open
recording's pictures only, and deleting a recording deletes its pictures with its takes.
The migration copies the old global pictures into the adopted recording's scope.

**Rationale.** A deleted recording must not leave megabytes of pasted pictures behind, and
a picture id is only meaningful inside the annotation that references it.

**Alternatives considered.**
- *Keep one global image store.* Rejected: orphaned pictures on every delete, and no safe
  way to tell a shared picture from an orphan without reference counting.

## R11 — Verification

**Decision.**

- **Node (Vitest)**: `Project`/`Projects` naming, uniqueness and Default immunity; the
  current-project rules; `ClipProfile` and `Clip.chooseProfile` before/after a take; the
  snapshot round trip; finished/in-progress derivation; project removal moving recordings;
  profile fallback; the adoption use case over a fake store; the recording list and its
  titles; the MCP tool list and each tool's schema.
- **Browser (Playwright, `e2e/checks/projects.spec.ts`)**: one check for the person's path —
  create and select a project, make a recording from fixture takes, end its session, reload,
  see it listed as finished, remove it to Default; and one for the agent's path — list,
  create, select and move a recording. The migration is folded into the person's check by
  seeding a legacy store first.
- **Not verified by a check**: the screen-share picker (no check can open it), a real
  multi-minute recording's quota behaviour, and the exact wall-clock of saving a large
  recording. These are stated as gaps in the pull request, per the verification skill.

## No open questions

The Technical Context has no unknowns. The spec's clarifications cover the decisions that
could have changed the architecture: profile snapshot, finished-by-session, the current
project, reopening as resume, and the agent's boundary.