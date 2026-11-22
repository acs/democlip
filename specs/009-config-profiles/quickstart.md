# Quickstart: Configuration Profiles

How to see the feature work, once it is built. The rules are unit-tested in node; what is drawn
— the pill, the selector, a profile's config sheet, and an item being fixed rather than offered —
is driven in a real browser by the end-to-end suite.

## Prerequisites

```bash
npm install
```

## The rules, in node

```bash
npx vitest run src/domain/profile/Profile.test.ts src/domain/profile/Profiles.test.ts
npx vitest run src/application/profiles.test.ts src/infra/profile-store.test.ts
npx vitest run src/ui/profile/apply.test.ts src/ui/profile/profile-menu.test.ts
npx vitest run src/domain/clip/Clip.test.ts src/domain/session/Session.test.ts
npx vitest run src/ui/logos.test.ts src/ui/exporting/intro.test.ts src/domain/clip/IntroCard.test.ts
```

Expected:

- `Profile.create('p1', 'DemoClipTV', { addToExport: 'true' }).valueFor('addToExport')` is `'true'`;
  `valueFor('title')` is `null`, and `declares('title')` is `false`.
- A profile declaring `{ addToExport: '' }` **does** declare it and answers `''` — a switch fixed
  **off**, which is a different state from letting it go; `free('addToExport')` is what lets it go.
- `Profiles.starting().controlling('addToExport')` is `null`: the built-in **Default** controls
  nothing. With a profile that declares it chosen, `controlling('addToExport')?.name` is
  `'DemoClipTV'` — and only while that profile is active.
- `Profiles.of` repairs a dangling `activeId`, drops an entry that cannot be named, replaces an
  entry claiming the default's id, and answers `starting()` for garbage.
- `ManageProfiles.declare` on the **active** profile while `capturing()` is true answers
  `ok: false`; on another profile it succeeds; `choose` is refused; `create` does not switch.
- `applyActiveProfile` fixes a declared item onto an empty clip **over** what it held, leaves an
  item the profile does not declare alone, ignores a declaration for an item this build does not
  know, and changes nothing for the built-in default.
- `Clip.applyProperty` announces the change, is no change at all when the value is already held,
  and is **not** what the one undo takes back — the person's own last change still is.
- `seedableClipProperties()` is exactly `['addToExport', 'logo']`.
- The `logo` clip property is a **list**: `control` is `'choice'` and its `choices` are `None`
  first and then every mark the app serves, so the panel and a profile's sheet draw the same list
  without naming the property. `with` still refuses a name the app does not serve — a value can
  also arrive from a written profile or an agent — and `''` is no logo, the ordinary case.
- A profile's sheet offers **Not fixed** above those choices: that is `declare(item, null)` — the
  item is the person's — and it is not the same as fixing it at **None**.
- `introFor` is a card for **add to export** *or* a logo, carries the logo's name, and is `null`
  for a clip with neither.
- The localStorage adapter writes and reads the shape unchanged, and answers `null` for an empty,
  unusable or other-version record.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/profiles.spec.ts
```

The check boots the app and drives the toolbar:

1. **Applied, and shown as fixed** — with a profile that controls **Add to export** on, the clip's
   settings show the value and `set by DemoClipTV`, and there is **no** switch for it.
2. **And the file proves it** — the export writes the title card: 1 s of clip reads back at more
   than 2.5 s.
3. **An agent is refused** — the surface reports the item read-only, and `setClipProperty` answers
   `ok: false` naming the profile.
4. **A free item is the person's** — under the built-in **Default** the switch is there, and moving
   it works.
5. **The selector shows no config** — `#profile-menu` holds no config rows at all; a profile's row
   carries the sliders mark, the pencil and the bin, and the sliders mark opens `#profile-def-bd`.
   There, **Logo** is a list of the marks the app serves — **Not fixed**, **None**, **DemoClip**,
   **Graditone** — rather than a field to type a name into.
6. **Fixed off is not free** — a profile fixing the switch **off** still locks it.
7. **Refused once capturing** — with a take in the session the other rows are disabled, the reason
   is shown, and the active profile is unchanged.
8. **It comes back** — after a reload the profile, what it controls and the active choice are all
   there; letting it go falls back to **Default** and the item is the person's again.

And the use case the feature is for, in `e2e/checks/profile-logo.spec.ts`:

```bash
npm run test:e2e -- e2e/checks/profile-logo.spec.ts
```

9. **The mark is in the file** — a profile fixing **Logo** makes the export open with a card
   carrying it: the file's first frame is decoded in the page and the pixels where the logo goes
   are counted (thousands with it, none without, and the picture is there in both, so a blank
   frame cannot pass for a card without a logo).
10. **It is not the person's** — the clip's settings show the logo as a value naming the profile,
    with no field to change it.
11. **It is defined in the profile's own sheet** — typed into the profile's **Logo** row, and it
    reaches the export from there.
12. **A name the app does not serve is refused** — the clip carries no logo and the export opens
    with a card without one.

## What no check can do

The recorder's own flow — a real screen share begun with a press, which is what sets the capture
latch in a person's hands — is the user's to run: `getDisplayMedia` needs a gesture and a picker no
check can open. The end-to-end check reaches "has begun to capture" through the suite's own take
fixture. Run a session by hand and confirm the selector's rows go disabled the moment a take starts
recording.

## In the app, by hand

```bash
npm run dev
```

1. Press the pill at the right-hand end of the header (it wears the active profile's first letters,
   `Def` for **Default**); the selector shows **Default**, active, offering no config.
2. Press **+ New Profile**, name it **DemoClipTV**, then press the **sliders** mark on its row. Fix
   **Add to export** to **On** and press Done.
3. Press its row to choose it. The pill now reads `Dem`.
4. Share a screen and record a take. Open the **settings** control in the corner of the preview:
   **Add to export** reads as a value with `set by DemoClipTV` and nothing to press.
5. Export: the file opens with the title card.
6. Open the selector again: the other rows are out (the reason says a profile is fixed once
   recording has started), and **DemoClipTV** stays active.
7. Press **New**; the selector is usable again. Rename the profile with the pencil, or remove it
   with the bin — the app falls back to **Default**, and the item is yours again.
8. Pick **Graditone** from the **Logo** list in the same sheet, and export: the file opens with the
   clef on the card, above the clip's words.
9. Reload the page: the profile is still there, with what it controls, and still the active one.
