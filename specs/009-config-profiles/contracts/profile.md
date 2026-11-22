# Contract — profiles

The seam this feature defines: what a **profile** is, how one is chosen and kept, how the
active one reaches a clip, and the one control the person uses. The rules are the
domain's and the use case's; this names the shapes so the four layers can be written
against them without meeting in the middle.

## 1. `Profile` — the domain value (pure)

`src/domain/profile/Profile.ts`

```ts
export interface StoredProfile { id: string; name: string; values: Record<string, string>; }

export class Profile {
  static create(id: string, name: string, values?: Readonly<Record<string, string>>): Profile | null;
  static restore(stored: StoredProfile): Profile | null;

  readonly id: string;
  readonly name: string;
  readonly values: Readonly<Record<string, string>>;

  /** The setting this profile gives a clip property, or null when it says nothing. */
  valueFor(id: string): string | null;
  /** The same profile with one setting; '' clears it. */
  with(id: string, value: string): Profile;
  /** The same profile under another name, or null for an empty one. */
  renamed(name: string): Profile | null;
  /** The profile as it is written down. */
  stored(): StoredProfile;
}
```

**Guarantees**

- no DOM, no storage, no random source: `src/domain/` may not have one, and the id and the
  name arrive from the caller;
- **unset is not empty**: `valueFor` answers `null` for a property the profile says nothing
  about, and `restore` folds `''` to unset, so one state has one representation (the rule
  `ClipProperties.of` follows);
- the shape is plain (id, name, `Record<string, string>`), so a profile is written down as
  JSON with no adapter knowledge of the domain.

## 2. `Profiles` — the domain book (pure)

`src/domain/profile/Profiles.ts`

```ts
export interface StoredProfiles { version: number; activeId: string; profiles: StoredProfile[]; }

export class Profiles {
  static readonly DEFAULT_ID = 'default';      // the built-in default
  static starting(): Profiles;                 // the default alone, active
  static of(stored: StoredProfiles | null): Profiles;

  readonly all: readonly Profile[];            // the default first
  readonly activeId: string;
  active(): Profile;
  has(id: string): boolean;
  get(id: string): Profile | null;

  choose(id: string): Profiles | null;         // null: no such profile
  add(profile: Profile): Profiles | null;      // null: the id is taken
  rename(id: string, name: string): Profiles | null;   // null: no such profile, empty name, or the default
  remove(id: string): Profiles | null;         // null: no such profile, or the default
  stored(): StoredProfiles;
}
```

**Guarantees**

- the built-in default is **always** in `all`, never renamed and never removed;
- `activeId` always names a profile in `all`, and removing the active one moves the active
  to the built-in default;
- `of` repairs untrusted state (drop invalid entries, ensure the default, move a dangling
  `activeId`) and answers `starting()` for a record it cannot use — it never throws and
  never returns an empty book;
- every mutation answers a **new** `Profiles`; the receiver is unchanged.

## 3. The store port and its adapter

`src/application/ports/ProfileStorePort.ts` (the port) · `src/infra/profile-store.ts` (the adapter)

```ts
export interface ProfileStorePort {
  load(): Promise<StoredProfiles | null>;   // null: nothing kept, or nothing usable
  save(state: StoredProfiles): Promise<void>; // may reject; the caller reports it
}
```

- the port names no storage; the adapter holds one `localStorage` key (`democlip_profiles`),
  JSON-encoded, and contains **no rules** (it neither validates nor repairs — that is
  `Profiles.of`);
- a storage that is unavailable, empty or holds unusable JSON makes `load` answer `null`,
  and the app starts on `Profiles.starting()`;
- `version` is `1` in this build; another version reads as unusable rather than guessed.

## 4. `ManageProfiles` — the use case

`src/application/profiles.ts`

```ts
export type ProfileResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export interface ProfileDeps {
  readonly store: ProfileStorePort;
  readonly capturing: () => boolean;
  readonly newId: () => string;
  readonly warn?: (error: unknown) => void;
}

export class ManageProfiles {
  load(): Promise<Profiles>;
  readonly current: Profiles;
  choose(id: string): ProfileResult<{ active: string }>;
  create(name: string): ProfileResult<{ id: string }>;
  setSetting(id: string, propertyId: string, value: string): ProfileResult<{ value: string }>;
  rename(id: string, name: string): ProfileResult<{ id: string; name: string }>;
  remove(id: string): ProfileResult<{ activeId: string }>;
}
```

**Guarantees**

- **the capture lock**: while `capturing()` is true, `choose` is refused, `create` does not
  move the active profile, and `setSetting`/`rename`/`remove` of the **active** profile are
  refused; every refusal is `{ ok: false, reason }` with a plain sentence;
- the domain holds the rules (`Profiles`), so the use case adds only the session's answer
  and persistence — it imports no view, DOM or `session`;
- a successful change is saved through the port; a failed save is reported through `warn`
  and leaves the in-memory change in place.

## 5. The seeding seam (the view, DOM-free)

`src/ui/profile/seed.ts` · `src/ui/clip/clip-properties.ts` (one flag)

```ts
// clip-properties.ts
export interface ClipProperty { /* … */ readonly seedable?: boolean; }
export function seedableClipProperties(): readonly ClipProperty[];

// seed.ts
export function seedActiveProfile(clip: Clip, profiles: Profiles): void;
```

**Guarantees**

- seeding runs only onto an **empty** clip (`clip.takes.isEmpty()`), so a restored or
  in-progress clip is never rewritten;
- only `seedableClipProperties()` are walked, so a stored setting for a property this build
  does not preload is **ignored**, never applied;
- a setting is applied through the property's own `with` and the clip's own `setProperty`,
  so a seeded value is an ordinary clip change — announced once, and exactly the value the
  panel and the export see for `Add to export`;
- a profile that does not carry the setting leaves the clip's value alone (the app's own
  default stands).

## 6. The toolbar control and the menu (the person's side)

`web/index.html` · `src/ui/dom.ts` · `src/ui/profile/profile-menu.ts` · `web/styles.css`

| Piece | Id / selector | Contract |
|---|---|---|
| the pill | `#profile-btn` · `#profile-initials` | the header's `class="icon-btn profile-pill"`, holding a span with the active profile's first letters; `aria-haspopup="true"`, `aria-expanded`, and an `aria-label` naming the active profile. It is the **last** child of `.hdr-actions`, so it is the right-most control in the header |
| the panel | `#profile-menu` | a body-level popover, `role="menu"`, built on each open; a `.profile-title` heading, then a row per profile, then the foot; placed under the pill and flipped above near the viewport's foot; closes on an outside click (read from `event.composedPath()`, since a setting re-renders the row the press began on), Escape or resize |
| a profile | `.profile-row[data-id]` · `.profile-pick` | `role="menuitemradio"`, `aria-checked` for the active one; a `.profile-avatar` pill in one of the tones with the profile's first letters, the `.profile-name`, a `.profile-check` when active; disabled (with `.profile-lock` shown once) while the session is locked and it is not the active one |
| what it carries | `.profile-settings` · `.profile-setting` | one control per seedable clip property, from the clip property's own declared `control`; not editable for the built-in default or for the active profile while locked |
| rename / remove | `.profile-ico[data-act="rename"|"remove"]` | a pencil and a bin on the person's own rows only; the built-in default has neither |
| a new profile | `.profile-new-btn` → `.profile-new-input` + `.profile-new-add` | the foot's **+ New Profile** button turns into a name field; creating is allowed while locked, and never moves the active profile while locked |

**Guarantees**

- the pill is in the header's icon-button family, wears the active profile's first letters,
  and opens the panel in **one press from anywhere in the app** (SC-002, SC-009);
- the active profile is always visible in the panel, locked or not (whether it is
  switchable is what the lock changes);
- the panel names no rule of its own: it asks `ManageProfiles` and shows what it is told,
  the way `camera-menu.ts` shows the camera list.

## Out of scope this iteration

- no operation on `window.democlip` (the automation surface) and no new MCP tool;
- no profile in an exported file, a sidecar or a publish;
- no profile change taken back by the clip's one undo (a profile is app configuration, not
  clip state);
- the profile carries only **Add to export**; `title`, `description` and later settings
  (default arrow colour, a required title, a required logo) are carried by flagging them
  `seedable` later, with no change to the classes above.
