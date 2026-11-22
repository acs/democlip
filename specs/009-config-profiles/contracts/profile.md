# Contract — profiles

The seam this feature defines: what a **profile** is, how what it controls is defined, chosen
and kept, how it reaches a clip, and the one control the person uses. The rules are the
domain's and the use case's; this names the shapes so the four layers can be written against
them without meeting in the middle.

> **Amended after the first cut.** The first design had a profile as a set of *defaults* it
> preloaded onto a new clip, edited through a switch inside the selector, with the clip's own
> value able to override it. The user's correction: a DemoClip profile is not a user profile —
> it **fixes** the configuration it declares, the person **cannot** change what it fixes, a
> profile that declares nothing is a free profile, and its definition is its **own surface**,
> not the selector. Everything below is the corrected design.

## 1. `Profile` — the domain value (pure)

`src/domain/profile/Profile.ts`

```ts
export interface StoredProfile { id: string; name: string; controls: Record<string, string>; }

export class Profile {
  static create(id: string, name: string, controls?: Readonly<Record<string, string>> | null): Profile | null;
  static restore(stored: StoredProfile): Profile | null;

  readonly id: string;
  readonly name: string;
  /** A key present is a declaration. The value may be '' — a switch fixed off. */
  readonly controls: Readonly<Record<string, string>>;

  /** Does this profile control this item? */
  declares(id: string): boolean;
  /** What it fixes the item at, or null when it does not control it. May be ''. */
  valueFor(id: string): string | null;
  /** Put an item under this profile's control, at `value` (which may be ''). */
  declare(id: string, value: string): Profile;
  /** Let an item go, so it is the person's again. */
  free(id: string): Profile;
  renamed(name: string): Profile | null;
  stored(): StoredProfile;
}
```

**Guarantees**

- no DOM, no storage, no random source: `src/domain/` may not have one, and the id and the name
  arrive from the caller;
- **declared is not empty**: `valueFor` answers `null` for an item the profile does not control,
  and `''` for one it fixes off. This is the one type in the app where those two states differ —
  `ClipProperties` folds `''` to unset, and must;
- `declare` and `free` are two methods, not one, so `declare(id, '')` cannot be mistaken for
  letting go;
- the shape is plain JSON, so a profile is written down with no adapter knowledge of the domain.

## 2. `Profiles` — the domain book (pure)

`src/domain/profile/Profiles.ts`

```ts
export interface StoredProfiles { version: number; activeId: string; profiles: StoredProfile[]; }

export class Profiles {
  static readonly DEFAULT_ID = 'default';
  static starting(): Profiles;                 // the default alone, active, controlling nothing
  static of(stored: StoredProfiles | null): Profiles;

  readonly all: readonly Profile[];
  readonly activeId: string;
  active(): Profile;
  /** The active profile when it controls this item, else null. The rule the feature turns on. */
  controlling(id: string): Profile | null;
  has(id: string): boolean;
  get(id: string): Profile | null;

  choose(id: string): Profiles | null;
  add(profile: Profile): Profiles | null;
  declare(id: string, property: string, value: string | null): Profiles | null;   // null: free it
  rename(id: string, name: string): Profiles | null;
  remove(id: string): Profiles | null;
  stored(): StoredProfiles;
}
```

**Guarantees**

- the built-in default is always in `all`, **controls nothing**, and is never renamed or removed;
- `activeId` always names a profile in `all`, and removing the active one moves the active to the
  default;
- `controlling` reads only the **active** profile: a declaration in a profile that is not in use
  is not in force;
- `of` repairs untrusted state and never throws, never returns an empty book, and replaces any
  entry claiming the default's id with the app's own default;
- every mutation answers a **new** `Profiles`; the receiver is unchanged.

## 3. The store port and its adapter

`src/application/ports/ProfileStorePort.ts` (the port) · `src/infra/profile-store.ts` (the adapter)

```ts
export interface ProfileStorePort {
  load(): Promise<StoredProfiles | null>;
  save(state: StoredProfiles): Promise<void>;
}
```

- one `localStorage` key (`democlip_profiles`), JSON-encoded, and **no rules** in the adapter;
- `version` is **2**; any other version reads as unusable rather than guessed, so the earlier
  `values` shape cannot be taken for this `controls` one;
- a storage that is unavailable, empty or holds unusable JSON makes `load` answer `null`, and the
  app starts on `Profiles.starting()`.

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
  declare(id: string, property: string, value: string | null): ProfileResult<{ property: string; value: string | null }>;
  rename(id: string, name: string): ProfileResult<{ id: string; name: string }>;
  remove(id: string): ProfileResult<{ activeId: string }>;
}
```

- **the capture lock**: while `capturing()` is true, `choose` is refused, `create` does not move
  the active profile, and the **active** profile's `declare`/`rename`/`remove` are refused;
  another profile's may still be changed;
- every refusal is `{ ok: false, reason }` with a plain sentence;
- the domain holds the rules, so the use case adds only the session's answer and persistence.

## 5. Applying what a profile declares (the view, DOM-free)

`src/ui/profile/apply.ts` · `src/ui/clip/clip-properties.ts` · `src/domain/clip/Clip.ts`

```ts
// clip-properties.ts
export interface ClipProperty { /* … */ readonly seedable?: boolean; }
export function seedableClipProperties(): readonly ClipProperty[];

// Clip.ts
applyProperty(id: string, value: string): boolean;

// apply.ts
export function applyActiveProfile(clip: Clip, profiles: Profiles): void;
```

**Guarantees**

- it walks `seedableClipProperties()` — **Add to export** and **Logo** — and nothing else, so a
  declaration for an item this build does not know is **ignored** rather than applied;
- a declaration whose value the clip property refuses (a logo the app does not serve) changes
  nothing at all, because applying goes through the property's own `with`;
- it applies to an **empty** clip only, and a controlled value **wins** over what the clip held —
  that is what *fixing* means;
- an item the active profile does not declare is left exactly as it is: the person's;
- the value goes on through `Clip.applyProperty`, so it is **announced** (every view follows) and
  is **not** what the one undo takes back — the undo would otherwise put back a value the profile
  is holding.

## 6. The `Controlling` seam — the one rule, asked once

`src/ui/profile/control.ts`

```ts
export type Controlling = (propertyId: string) => string | null;   // the profile's name, or null
export function controllingIn(book: () => Profiles): Controlling;
```

**Guarantees**

- the properties panel draws a controlled row as **a value plus the profile's name** — the same
  shape the read-only clip size already uses — and offers **no control** for it;
- `createEditor(clip, make, controlling)` refuses `setClipProperty` with the profile named, so an
  agent gets the same answer as the person;
- `describeClip(clip, controlling)` reports the item `readOnly`;
- both surfaces read the same function, so they cannot disagree about what is the person's.

## 7. The toolbar pill and the two surfaces (the person's side)

`web/index.html` · `src/ui/dom.ts` · `src/ui/profile/{profile-menu,profile-def}.ts` · `web/styles.css`

| Piece | Id / selector | Contract |
|---|---|---|
| the pill | `#profile-btn` · `#profile-initials` | `class="icon-btn profile-pill"`, holding the active profile's first letters; `aria-haspopup`, `aria-expanded`, an `aria-label` naming the active profile. **Last** child of `.hdr-actions`, so the right-most control in the header |
| the selector | `#profile-menu` | a body-level popover built on each open: a `.profile-title`, a row per profile, the lock line, and the foot. Closes on an outside click (read from `event.composedPath()`, since a handler re-renders the panel), Escape or resize |
| a row | `.profile-row[data-id]` · `.profile-pick` · `.profile-avatar` · `.profile-check` | `role="menuitemradio"`, `aria-checked` for the active one; a pill of the profile's first letters in one of the tones, the name, a tick when active; disabled while the session is locked and it is not the active one |
| the person's own row | `.profile-ico[data-act="define"|"rename"|"remove"]` | the sliders mark (the config sheet), the pencil and the bin. The built-in default has none: it controls nothing and cannot be renamed or removed |
| a new profile | `.profile-new-btn` → `.profile-new-input` + `.profile-new-add` | the foot's **+ New Profile** turns into a name field; allowed while locked, and never moves the active profile then |
| the config sheet | `#profile-def-bd` · `.pdef-row[data-id]` · `.pdef-opt[data-value]` | a modal titled with the profile's name, one row per item it may control; a **toggle** is a segmented **Free / On / Off** (`data-value` `free` / `true` / ``), a **choice** is a list of the property's own `choices` with **Not fixed** above them, and any other value is a field whose empty state fixes nothing. `data-value` is what a check presses |
| the logo's mark | `web/public/logos/*.png` · `src/ui/logos.ts` | the marks the app serves itself, with the label a person chooses by; a clip's value is a **name** from the list, and a name it does not hold is refused by the clip property |
| the list control | `ClipProperty.choices` · `select.prop-input` / `select.pdef-select` | a property whose values the app knows declares them, and both surfaces draw them — so neither names the property, and a person choosing a mark cannot pick one that is not there |

**Guarantees**

- the pill is in the header's icon-button family, wears the active profile's first letters, and
  opens the selector in **one press from anywhere in the app** (SC-002, SC-009);
- **the selector never shows or sets configuration** (SC-012): the only place a profile's
  declarations are read or written is its own sheet;
- the config sheet is opened *from* the selector but is not part of it: a press inside it leaves
  the selector where it was;
- neither surface names a rule of its own: both ask `ManageProfiles` and draw what they are told.

## Out of scope this iteration

- no operation on `window.democlip` (the automation surface) and no new MCP tool — profiles are
  the person's toolbar. The surface *is* told about a controlled item: read-only, and refused
  with the profile named;
- no profile in an exported file, a sidecar or a publish;
- no profile change taken back by the clip's one undo (a profile is app configuration, not clip
  state; applying one is deliberately not undoable);
- the profile controls **Add to export** and **Logo**; later items are carried by flagging them
  `seedable`, with no change to the classes above;
- the logo is drawn **on the card**, not over every frame: a clip that wears one asks for a card,
  and the mark is not a watermark.
