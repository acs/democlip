# Phase 1 — Data Model: Configuration Profiles

Two new domain types, one new application use case, one port and its adapter, one field
added to `Session`, and one flag added to the clip-property descriptor. Nothing about the
clip's own data changes.

## 1. `Profile` — a named set of settings

`src/domain/profile/Profile.ts`

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | stable identity, handed in by the caller; what a choice and the store key on |
| `name` | `string` | what the person calls it; **non-empty**, trimmed |
| `values` | `Readonly<Record<string, string>>` | the settings, keyed by clip-property id; an absent key means **unset** |

**Rules**

- `Profile.create(id, name, values?)` returns `null` for an id that is not a non-empty
  string or a name that is empty after trimming; otherwise it returns the profile.
- `valueFor(id)` answers the setting or `null` (**unset**), which is distinct from `''`.
- `with(id, value)` sets one setting; `''` clears it. It does not validate the id — the
  application decides which ids are applied (R1).
- `renamed(name)` answers a profile with the new name, or `null` for an empty name.
- `stored()` / `Profile.restore(stored)` write and read the plain shape; `restore` keeps
  only named string values and drops an empty value, so **`''` and "absent" are one state**
  (the rule `ClipProperties.of` follows), and answers `null` when the id and name are not
  valid.

**Invariants**: `name.trim() !== ''`; `id !== ''`; `values` holds only `string → string`.

## 2. `Profiles` — the book: the list and the one active

`src/domain/profile/Profiles.ts`

| Field | Type | Meaning |
|---|---|---|
| `all` | `readonly Profile[]` | every profile, in a stable order (the built-in default first) |
| `activeId` | `string` | the id of the one active profile; always names a profile in `all` |

**Rules (each a method returning a new `Profiles` or `null`)**

| Method | Rule | On refusal |
|---|---|---|
| `starting()` | the built-in default alone, active | — |
| `of(stored)` | read back untrusted state: drop invalid entries, ensure the built-in default, move `activeId` to a profile that exists (the default when none does) | returns `starting()` for a record it cannot use |
| `get(id)` / `has(id)` | look one up | `null` / `false` |
| `choose(id)` | the active profile becomes `id` | `null` when no such profile |
| `add(profile)` | append a profile (id unique) | `null` when the id is already present |
| `rename(id, name)` | the profile's name changes | `null` when no such profile, an empty name, or the id is the built-in default |
| `remove(id)` | the profile goes; if it was active, the active moves to **the built-in default** | `null` when no such profile or the id is the built-in default |
| `stored()` | the plain shape for the store | — |

**Invariants**

- the built-in default profile (`id = 'default'`, name `Default`, no settings) is always in
  `all`, and is never renamed or removed;
- `all` is never empty, and `activeId` always names one of `all` (FR-002, FR-010, FR-017);
- `add`, `choose`, `rename`, `remove` never mutate the receiver — they answer a new book.

## 3. The stored shape (the port's data)

`src/domain/profile/Profiles.ts` (the types), `src/application/ports/ProfileStorePort.ts` (the port)

```ts
export interface StoredProfile { id: string; name: string; values: Record<string, string>; }
export interface StoredProfiles { version: number; activeId: string; profiles: StoredProfile[]; }

export interface ProfileStorePort {
  load(): Promise<StoredProfiles | null>;
  save(state: StoredProfiles): Promise<void>;
}
```

- `version` lets a later shape be told apart; this build writes `1` and reads `1`, and any
  other version reads as unusable state (`null`) rather than a guess.
- The port names no storage; `src/infra/profile-store.ts` implements it on `localStorage`.

## 4. `ManageProfiles` — the use case

`src/application/profiles.ts`

```ts
export interface ProfileDeps {
  readonly store: ProfileStorePort;
  /** Has the session begun to capture? The app hands in the session's own answer. */
  readonly capturing: () => boolean;
  /** A fresh id for a new profile: the caller's random source, not the domain's. */
  readonly newId: () => string;
  readonly warn?: (error: unknown) => void;
}
```

| Operation | Rule | Outcome |
|---|---|---|
| `load()` | read the store, `Profiles.of` it (or `starting()`); keep it as the current book | the current `Profiles` |
| `choose(id)` | refused while `capturing()`; otherwise `Profiles.choose` | `Result` — `{ ok: true, active }` or `{ ok: false, reason }` |
| `create(name)` | allowed while capturing, but the active profile does **not** move | `Result<{ id }>` |
| `rename(id, name)` | refused while capturing **and** `id` is the active profile; otherwise delegated | `Result` |
| `remove(id)` | refused while capturing **and** `id` is the active profile; otherwise delegated | `Result<{ activeId }>` |

**Rules**

- every successful change is written through the port (`save`); a failed write is reported
  through `warn` and does not undo the in-memory change (the person sees their change, as
  they do for a clip that failed to keep);
- the reasons are plain sentences in the app's words, e.g. `A profile is fixed once
  recording has started.` and `The default profile cannot be removed.`;
- the use case never imports the view, the DOM or `session` — `capturing` and `newId` are
  handed in (the composition root passes `() => session.hasCaptured || !session.clip.takes.isEmpty()`
  and `() => crypto.randomUUID()`).

## 5. `Session` — the capture latch

`src/domain/session/Session.ts` (one field and three members added)

| Member | Meaning |
|---|---|
| `hasCaptured` | `true` once a take has actually begun in this session, and false again after `end()` |
| `beginCapture()` | marks the session as having begun to capture; idempotent |
| `end()` | clears the clip **and** clears `hasCaptured` (the existing end-of-session event) |

**Invariant**: `hasCaptured` is set by a *started* take, so a recording begun and then
discarded still counts (spec edge case); it is never set by a restored clip, which the
lock's second term (`!clip.takes.isEmpty()`) covers instead.

## 6. `ClipProperty` — the one flag

`src/ui/clip/clip-properties.ts`

- `ClipProperty` gains `readonly seedable?: boolean` — *this clip property is one a profile
  may preload*.
- `addToExport` sets `seedable: true`; `title`, `description` and the read-only `size` do
  not.
- A helper `seedableClipProperties(): readonly ClipProperty[]` returns the flagged ones,
  which is the whole of what seeding walks. A later iteration flags `title`/`description`
  to carry them with no change to `Profile`, `Profiles` or the use case.

## 7. How the pieces relate

```text
localStorage ──(ProfileStorePort)──> ManageProfiles ──owns──> Profiles ──has──> Profile*  (one active)
                                          │
                     capturing() ─────────┤  (the session's latch + the clip's takes)
                                          │
      active().valueFor(id) ──(seedableClipProperties)──> Clip.setProperty ──> clip.properties
                                                                                    │
                                          the panel, the timeline and the export read it, as today
```

- **A profile never reads or writes a `Clip`.** The use case holds `Profiles`; the view's
  `seed.ts` reads the active profile and writes the clip through the clip's own
  `setProperty` (R5).
- **A clip never names a profile.** Once seeded, the value lives with the clip; the profile
  is not stored in the clip, the snapshot or an export.

## State transitions

**The active profile** (`Profiles.choose`, when the session is unlocked)

```text
DemoClipTV (active) ──choose(GraditoneTV)──> GraditoneTV (active)     allowed: not capturing
DemoClipTV (active) ──choose(GraditoneTV)──> refused (unchanged)       capturing: hasCaptured or the clip holds a take
```

**A session's lock** (`Session`)

```text
new session          locked = false            choose/create-as-active allowed; seed runs
beginCapture()       locked = true             choose refused; create does not switch; active rename/remove refused
end() (New)          locked = false            seed runs again for the fresh clip
restored at load     locked = true             the clip's takes are there; active is the same profile
```

**Removing the active profile** (`Profiles.remove`, unlocked)

```text
remove(activeId) ──> the built-in default becomes active     the app is never left with none
remove(default)  ──> refused
```
