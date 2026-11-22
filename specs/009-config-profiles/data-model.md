# Phase 1 — Data Model: Configuration Profiles

Two domain types, one use case, one port and its adapter, one field added to `Session`, and
one method added to `Clip`. Nothing about the clip's own data changes — but the *direction* of
the feature does: a profile is not a set of defaults, it is the app's configuration, and what
it declares is locked.

## 1. `Profile` — a named set of declarations

`src/domain/profile/Profile.ts`

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | stable identity, handed in by the caller; what a choice and the store key on |
| `name` | `string` | what the person calls it; **non-empty**, trimmed |
| `controls` | `Readonly<Record<string, string>>` | the declaration: **a key present means the profile controls that item**, and the value is what it is fixed at. A value may be `''` — a switch fixed **off** |

**Rules**

- `Profile.create(id, name, controls?)` returns `null` for an id that is not a non-empty string
  or a name that is empty after trimming.
- `declares(id)` — does the profile control it? `valueFor(id)` — the value, or `null` when it
  does **not** control it. **`''` and `null` are different states**, which is the one place this
  type differs from `ClipProperties`: a switch fixed off is declared, and empty is what it is
  fixed at.
- `declare(id, value)` puts an item under the profile's control (value may be `''`);
  `free(id)` lets it go, so it is the person's again. Two methods, not one, because
  `declare(id, '')` and `free(id)` must not be confusable.
- `renamed(name)` answers a profile with the new name, or `null` for an empty one.
- `stored()` / `Profile.restore(stored)` write and read the plain shape; `restore` keeps only
  named string values — **keeping a declared empty value** — and answers `null` when the id and
  name are not valid.

**Invariants**: `name.trim() !== ''`; `id !== ''`; a value is a string, possibly empty.

## 2. `Profiles` — the book: the list, the one active, and what is controlled

`src/domain/profile/Profiles.ts`

| Field | Type | Meaning |
|---|---|---|
| `all` | `readonly Profile[]` | every profile, the built-in default first |
| `activeId` | `string` | the one active profile; always names a profile in `all` |

**Rules (each a method answering a new `Profiles`, or `null`)**

| Method | Rule |
|---|---|
| `starting()` | the built-in default alone, active, controlling nothing |
| `of(stored)` | read untrusted state: drop invalid entries, replace any entry claiming the default's id with the app's own default, move a dangling `activeId` to the default; `starting()` for a record it cannot use |
| `active()` | the profile in force |
| `controlling(id)` | **the rule the whole feature turns on**: the active profile when it declares `id`, else `null` — the single answer the properties panel and the automation surface both read |
| `choose(id)` | the active profile becomes `id`; `null` when no such profile |
| `add(profile)` | append; `null` when the id is taken |
| `declare(id, property, value \| null)` | put an item under a profile's control at `value`, or hand it back with `null`; `null` for an unknown profile |
| `rename(id, name)` | `null` for no such profile, an empty name, or the built-in default |
| `remove(id)` | drops it; the active moves to the built-in default; `null` for no such profile or the default |
| `stored()` | the plain shape |

**Invariants**

- the built-in default (`id = 'default'`, name `Default`, **controls nothing**) is always in
  `all`, and is never renamed or removed;
- `all` is never empty and `activeId` always names one of `all`;
- every transition answers a **new** book and leaves the receiver unchanged.

## 2b. The logo — a value item, and the card that carries it

| Piece | Where | Contract |
|---|---|---|
| the app's logos | `src/ui/logos.ts` | `LOGOS` (name → file) and `logoFile(name)`; the files are the app's own, in `web/public/logos/`. DOM-free, so a clip property can refuse an unknown name and a node test can read the list |
| the clip property | `src/ui/clip/clip-properties.ts` | `id: 'logo'`, `control: 'choice'`, `seedable: true`, with its `choices` — so the two surfaces that set it draw the same list. Its value is a **name**, and `''` means none |
| the list, drawn | `src/ui/clip/properties-panel.ts`, `src/ui/profile/profile-def.ts`, `src/ui/agent/describe.ts` | the panel offers the choices; a profile's sheet offers **Not fixed** above them (which is `declare(item, null)`, and not the same as fixing it at `None`); the automation surface is told the choices as well as the value |
| the card's value | `src/domain/clip/IntroCard.ts` | `logo: string` — the name, not a picture: the plan carries *which* mark, and the view turns it into an image |
| what asks for a card | `src/ui/exporting/intro.ts` | **add to export** *or* a logo: a logo lives on the card, so a clip that wears one always opens with it |
| the file the encoder gets | `src/application/ports/EncoderPort.ts` | `IntroFrame.logo`, built by `src/infra/offline-encoder.ts` from the plan |
| the picture | `src/ui/exporting/logo-image.ts` | `loadLogo(name)` / `logoImage(name)`: decoded **once**, before the first frame (`FrameRenderer.prepare`); a logo that will not load draws nothing and the export goes on |
| where it is drawn | `src/ui/exporting/frame-renderer.ts` + `intro-text.ts` | `LOGO_BOX` (above the words, centred) and `LOGO_SPACE`; the mark is fitted inside the box keeping its proportions, with a dark shadow so a pale mark reads over a pale picture. The words are stacked in what the box leaves |

## 3. The stored shape (the port's data)

`src/domain/profile/Profiles.ts` (the types) · `src/application/ports/ProfileStorePort.ts` (the port)

```ts
export interface StoredProfile { id: string; name: string; controls: Record<string, string>; }
export interface StoredProfiles { version: number; activeId: string; profiles: StoredProfile[]; }

export interface ProfileStorePort {
  load(): Promise<StoredProfiles | null>;
  save(state: StoredProfiles): Promise<void>;
}
```

- `version` is **2** in this build (`controls` replaced an earlier `values`, whose shape meant
  defaults rather than declarations); any other version reads as unusable state, so a record
  from the earlier shape cannot be taken for this one.
- The port names no storage; `src/infra/profile-store.ts` implements it on `localStorage`.

## 4. `ManageProfiles` — the use case

`src/application/profiles.ts`

| Operation | Rule | Outcome |
|---|---|---|
| `load()` | read the store, `Profiles.of` it (or `starting()`) | the current `Profiles` |
| `choose(id)` | refused while `capturing()`; otherwise `Profiles.choose` | `Result` |
| `create(name)` | allowed while capturing, but the active profile does **not** move | `Result<{ id }>` |
| `declare(id, property, value \| null)` | refused while capturing **and** `id` is the active profile — a profile must not move under a clip being made; otherwise delegated | `Result<{ property, value }>` |
| `rename(id, name)` | refused while capturing **and** `id` is the active profile | `Result` |
| `remove(id)` | refused while capturing **and** `id` is the active profile | `Result<{ activeId }>` |

- every successful change is written through the port; a failed write is reported through
  `warn` and does not undo the in-memory change;
- the reasons are plain sentences, e.g. `A profile is fixed once recording has started — press
  New to start another session.`;
- the use case imports no view, DOM or `session`: `capturing`, `newId` and the store are handed
  in by the composition root.

## 5. `Session` — the capture latch (unchanged)

`hasCaptured` / `beginCapture()` / `end()` clears it. The lock the use case reads is
`session.hasCaptured || !session.clip.takes.isEmpty()`, handed in as `capturing`.

## 6. `Clip` — one method, for applying what a profile fixes

`src/domain/clip/Clip.ts`

```ts
/** Fix a property to a value a profile controls: announced, and not what the one undo takes back. */
applyProperty(id: string, value: string): boolean;
```

- **announced**, so every view follows it — the pattern the clip already uses for a load
  (`addTake` and `carry` announce and are not undoable);
- **not recorded as the last change**, so the one undo still takes back the person's own last
  change and can never put back a value the profile is holding;
- answers `false` when the clip already holds the value.

## 7. `ClipProperty` — the item seam

`src/ui/clip/clip-properties.ts`

- `seedable?: boolean` marks an item a profile **may control**. `addToExport` and `logo` carry
  it; `title`, `description` and the read-only `size` do not.
- `logo` is the **list** item: `control: 'choice'`, with `choices` — `None` first, then every
  mark the app serves (`ui/logos.ts`) — so the panel and a profile's sheet draw the list without
  naming the property, and a person chooses rather than types. `with` still refuses a name the
  app does not serve, because a value also arrives from a written profile or an agent.
- `seedableClipProperties()` is the whole of what a config sheet offers and what applying
  walks, so a declaration for an item this build does not know is ignored.

## 8. The `Controlling` seam — the one rule, asked once

`src/ui/profile/control.ts` (DOM-free, proved in node)

```ts
export type Controlling = (propertyId: string) => string | null;   // the profile's name, or null
export function controllingIn(book: () => Profiles): Controlling;
```

Handed to `clipPropertiesPanel.init(controlling)` and `createEditor(clip, make, controlling)`.
`describeClip(clip, controlling)` uses it too, so an agent is told the same thing the person
sees: a controlled item is **read-only**.

## 9. The two surfaces (the view)

| Surface | Where | What it does |
|---|---|---|
| the selector | `src/ui/profile/profile-menu.ts` · `#profile-menu` | rows of avatar/name/tick, and — on the person's own profiles — the sliders mark, the pencil and the bin. **Never** shows or sets configuration |
| the config sheet | `src/ui/profile/profile-def.ts` · `#profile-def-bd` | one row per item a profile may control: a segmented **Free / On / Off** for a switch, or a **Free** switch and a field for anything else. A modal, in the family of the text-entry dialog |

`profileRows(book, locked)` and `defineRows(profile, { active, locked })` in
`src/ui/profile/profile-rows.ts` are the DOM-free row models both draw from, so what a check
reads is what the app draws.

## 10. How the pieces relate

```text
localStorage ─(ProfileStorePort)─> ManageProfiles ─owns─> Profiles ─has─> Profile*  (one active)
                                        │                                └─ controls: { item → value }
                    capturing() ────────┤
                                        │
   active().valueFor(item) ──(seedableClipProperties)──> Clip.applyProperty ──> clip.properties
                                                                                   │
                          Profiles.controlling(item) ──(Controlling)──> the panel shows it as a value
                                                                      the surface refuses it, naming the profile
```

- **A profile never reads a `Clip`**; the view's `applyActiveProfile` reads the active profile and
  writes the clip. **A clip never names a profile**: once applied, the value lives with the clip
  and the panel's *reason* comes from the `Controlling` seam.
- A declaration for an item this build does not know lives in the profile, is never applied, and
  is never offered in a sheet.

## State transitions

**What a profile controls** (`ManageProfiles.declare`)

```text
Free ──declare(item, 'true')──> controlled: on ──declare(item, '')──> controlled: off ──declare(item, null)──> Free
```

**A session's lock** (`Session` + the clip)

```text
new session        locked = false   choose/create allowed; the active profile's sheet is editable
beginCapture()     locked = true    choose refused; create does not switch; the *active* profile is frozen
                                    (another profile may still be defined, renamed, removed)
end() (New)        locked = false   what the active profile declares is applied to the fresh clip
restored at load   locked = true    the clip's takes are there; the same profile is still active
```

**Applying what a profile declares** (`applyActiveProfile`, on an empty clip)

```text
choose / New / define-while-unlocked
        └─> for each item the active profile declares and this build knows:
                 clip.applyProperty(item, value)      announced, not undoable
            an item it does not declare: left exactly as it is — the person's
```
