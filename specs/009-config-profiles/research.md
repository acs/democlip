# Phase 0 — Research: Configuration Profiles

Every decision below is settled; there are no open `NEEDS CLARIFICATION` items. Each one
names what was chosen, why, and what else was considered.

## R1 — What a profile carries, and the seam for more later

**Decision**: a profile is a map of named string settings keyed by **clip property id**
(`addToExport` today). Only the clip properties the app marks as **seedable** are ever
applied; `src/ui/clip/clip-properties.ts` gains one optional flag (`seedable: true`) on
`addToExport`, and the other properties (`title`, `description`, the read-only `size`) do
not carry it. A stored setting for a property this build does not know is **kept but never
applied**.

**Rationale**: the clip properties are already the one register that says what can be
changed about a clip and how to read and write each value (`value`/`with`). Reusing it
means a later iteration adds `title`/`description` defaults by flagging them, with no new
register and no change to `Profile` or `Profiles`. FR-015 asks for exactly this: one
setting now, more later, existing profiles unharmed.

**Alternatives considered**:
- *A separate profile-settings register.* Rejected: a second list of the same properties
  could drift from the first, which is the failure the clip-property register exists to
  prevent.
- *Carry every clip property, including `size`.* Rejected: the size is derived and not the
  person's to set (`ClipProperty.readOnly`), and the spec limits this iteration to
  **Add to export**.
- *Drop an unknown setting on load.* Rejected: a profile written by a newer version, read
  by an older one, would silently lose settings; keeping them and ignoring them is the
  `AnnotationSet`/`annotationFrom` habit already in the codebase.

## R2 — Where a profile lives, and its identity

**Decision**: two classes in `src/domain/profile/`:
`Profile` (an id, a name, a map of settings — the name rule, `valueFor`, `with`,
`renamed`, `stored`/`restore`) and `Profiles` (the book: the list, the active id, and the
rules `choose`, `add`, `rename`, `remove`, `of`, `stored`). An id is handed in by the
caller — the use case makes it — so the domain uses no random source and stays pure.

**Rationale**: a profile has rules, not only data (a name that cannot be empty, a setting
that may be **unset** as distinct from empty, a built-in default that cannot go), so by
`.agents/skills/domain-model` it is a class; `Profiles` is where the rules that relate
several profiles live. `ClipProperties` and `AnnotationSet` are the same shape.

**Alternatives considered**:
- *A plain interface plus a module of functions.* Rejected: the rules would have nowhere
  to live and would leak into the use case and the menu.
- *Identity by name.* Rejected: the spec allows two profiles to share a name (an edge
  case), so a name cannot be the identity.
- *`crypto.randomUUID()` in the domain.* Rejected: a browser global in `src/domain/`; the
  id is a collaborator's business, so it is passed in (as an annotation's id is).

## R3 — The built-in default

**Decision**: one profile with a fixed id (`default`) and a fixed name (**Default**) and
**no settings** is always present. It cannot be renamed, removed or edited. A new person
therefore works exactly as today (`Add to export` unset ⇒ the app's own default, off).

**Rationale**: FR-010, FR-014 and SC-008 ask for a guaranteed, "as today" state; a person
who never opens the menu must see no difference. Keeping the default free of settings
means the fallback can never itself be the reason an export changed — the person's own
profiles are where settings live.

**Alternatives considered**:
- *Let the default carry settings / be renamed.* Rejected for now: it makes "the built-in
  default" an ordinary profile with a special rule (undeletable), which is harder to
  state; creating a profile costs one press.
- *No built-in default; zero profiles until one is made.* Rejected: FR-002/FR-010 require
  one active profile at all times, and a menu with nothing in it is a worse first run.

## R4 — The capture lock, and when the session ends

**Decision**: `Session` gains a `captured` latch, set by `beginCapture()` the moment a
take actually starts recording (`record-flow.startRecording`, on an outcome that is not
`refused`), and cleared by `end()`. The lock is `session.hasCaptured || !clip.takes.isEmpty()`
(the second term covers **import**, which adds a take, and a **restored** session, whose
takes survive the reload even though the latch does not). Choosing a profile is refused
while locked; the refusal is a `Result` reason the menu shows.

**Rationale**: the user's rule is "a profile cannot be changed once you have started to
capture in a Session", and the code's `Session` is the one object with a lifetime that
matches a session. A latch is needed because a take begun and then discarded leaves no
take behind to remember it. Reading the clip's takes as well covers import and restore
without a second latch.

**Alternatives considered**:
- *Derive the lock from the takes alone.* Rejected: a recording started and stopped with
  nothing kept would unlock, contradicting the spec's edge case.
- *Derive it from the phase (`recording`).* Rejected: `review` after a take is still
  "has captured", and a reload has no phase yet.
- *Store the session's profile id on the kept clip.* Rejected as unnecessary: exactly one
  profile is active and the active choice is itself persisted, so a restored session is
  already under the same profile; the lock keeps it from being switched.

**One reading to make explicit**: in the app a `Session` object ends at **New** (and at a
fresh load). An **export** lets the *kept copy* go rather than ending the in-memory
session — the clip stays on screen and can still grow — so the lock is held until New.
The spec's phrase "the session ends … when the clip is exported" is read as the kept copy
going, not the session object ending; the lock is released at `Session.end()`. If a person
should be able to switch a profile right after an export, that is a one-line change here
and a spec amendment, and is called out rather than assumed.

## R5 — Preloading: when the profile touches the clip

**Decision**: seeding runs in exactly three places, and only onto an **empty** clip —
(1) at startup after the profiles are loaded, (2) after `session.end()` in `startNewSession`
(the New button), and (3) when a profile is chosen while the session is unlocked. It
applies each **seedable** setting the active profile carries through the clip property's
own `with`, then `clip.setProperty`; a profile that does not carry a setting leaves the
clip's value alone.

**Rationale**: FR-003/FR-013/FR-014 — a profile supplies a clip's starting value and
nothing else. Seeding only an empty clip is what makes "the clip keeps its own value" and
"a restored clip is not rewritten" true without a flag to tell them apart. Going through
`with`/`setProperty` means a seeded value is an ordinary clip change — announced once, in
the same shape as any other — so no view needs a special case.

**Alternatives considered**:
- *Seed on every profile change, overwriting the clip.* Rejected: FR-004/FR-013 — the clip
  owns its value, and this would rewrite an in-progress clip.
- *Build the clip's properties directly (`Clip.restore`-style, unannounced).* Rejected: a
  second way to set a property; the panel and the undo would not see it.
- *Seed at the first capture rather than at session start.* Rejected: the person should see
  the clip's settings for the profile they chose before recording, and the lock would make
  the seeding moment and the freezing moment collide.

## R6 — Where the profiles are kept

**Decision**: a `ProfileStorePort` (`load`/`save` of a `StoredProfiles` record) with a
`localStorage` adapter in `src/infra/profile-store.ts` under one key
(`democlip_profiles`), JSON, `try`/`catch` on both sides. A missing, unreadable or invalid
record yields `null`, and the app starts on `Profiles.starting()` (the built-in default);
a failed write is reported through the same `warn` seam `KeepClip` uses.

**Rationale**: the profiles are a few hundred bytes of configuration and must be readable
before the first take exists, which `localStorage` gives synchronously and cheaply; the
clip store is IndexedDB because it takes Blobs, which a profile is not. The port keeps the
`localStorage` name out of the use case, exactly as `KeptClipPort` does for IndexedDB, and
lets the rules be tested with a fake.

**Alternatives considered**:
- *A `prefs.ts` key beside the theme.* Rejected: `prefs.ts` is a bare key/value for the
  theme; profiles have their own shape and rules, which a port carries.
- *IndexedDB.* Rejected: no Blobs, and an async read where a synchronous one is enough —
  it would put the profiles behind the clip store's queue for no benefit.
- *A server or a file.* Rejected: the app is offline-first and stores nothing on a server
  (`FEATURES.md`).

## R7 — The toolbar icon and the menu

**Decision**: a new `#profile-btn` (`class="icon-btn"`, an inline SVG, `aria-haspopup`,
`aria-expanded`) is appended **last** to `.hdr-actions` in `web/index.html`, so it is the
right-most control in the header. `#profile-menu` is a body-level popover built by
`src/ui/profile/profile-menu.ts`, modelled on `camera-menu.ts`/`export-menu.ts`: it places
itself under the button (flipping above near the viewport's foot), closes on an outside
click, Escape or resize, and rebuilds its rows from the book on each open. Each profile is
a `role="menuitemradio"` row with `aria-checked` for the active one; a **New profile…**
row takes a name; the person's own rows offer rename and remove.

**Rationale**: the header's icon buttons and the two existing popovers are the app's own
pattern for exactly this — a toolbar control that opens a list — so the feature adds no
new interaction shape (spec SC-002, SC-009). The right-most position is the user's own
requirement.

**Alternatives considered**:
- *A modal dialog.* Rejected: heavier than a list of a few names, and unlike anything else
  in the header.
- *A `<select>`.* Rejected: it cannot carry create/rename/remove, nor show why a choice is
  refused while capturing.

## R8 — Locked state in the menu

**Decision**: while the session is locked, the menu still opens and still shows every
profile with the active one marked, but the rows of the **other** profiles are disabled and
a single line says why ("A profile is fixed once recording has started"). While locked, a
new profile may still be **created**, and a non-active profile may be **renamed or
removed**; the **active** profile is frozen — it cannot be switched, renamed or removed —
and removing it is refused. Unlocked, everything is available.

**Rationale**: FR-013 (switching refused, plainly said), FR-022 (creating does not switch),
FR-016/FR-017 (the person's profiles are theirs to manage; the active one cannot be
removed here, and removing any active one falls back). Disabling rather than hiding keeps
the reason visible, and keeps the list stable.

**Alternatives considered**:
- *Hide the menu while capturing.* Rejected: the person would lose the only way to see
  which profile they are working under.
- *Allow switching and apply it at the next session.* Rejected: the user chose a hard
  refusal for the session, not a deferred choice.
- *Refuse all management while capturing.* Rejected: creating and tidying other profiles
  changes nothing about the clip in front of the person.

## R9 — Scope left out, deliberately

**Decision**: **the automation surface and the MCP server are not extended** in this
iteration — no `window.democlip.profiles`, no new MCP tool. Profiles are also **not
covered by the clip's one undo** (they are app configuration, not clip state), and are
**not written into** an exported file, a sidecar or a publish.

**Rationale**: FR-020 was corrected during this planning to say exactly this; the user's
first iteration is about the person's toolbar, and profiles are configuration the clip
does not own. Keeping the surface out means there is nothing new for the MCP server's
release check to guard, and no way for an agent to reach a rule the person cannot.

**Alternatives considered**:
- *Mirror the operations on the surface now.* Deferred: it adds a contract and an MCP tool
  for a feature whose rules are still settling (the session-end reading in R4, in
  particular). It is a small, separate follow-up.
- *Make a profile change undoable by the clip's undo.* Rejected: the undo is the clip's and
  takes back the clip's own changes; a profile outlives the clip, so it has nothing to
  return to.

## R10 — Making the closed set of a build's profiles safe to read back

**Decision**: `Profiles.of(stored)` treats the stored record as untrusted: it drops an
entry that has no id or an empty name, ensures the built-in default exists, and moves the
active id to a profile that exists (the default when none does). `Profile.restore` drops a
setting whose value is not a string and keeps an empty value as **unset** (one
representation), the same rule `ClipProperties.of` uses.

**Rationale**: the state comes from a person's browser and may be old, hand-edited, or
written by another version; the app must open regardless (FR-018, and the "read by an
older version" edge case) and must never end up with no profile or no active one.

**Alternatives considered**: *throw and reset everything* — rejected, it would discard a
person's profiles for one bad entry; the app repairs what it can instead.
