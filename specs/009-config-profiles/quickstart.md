# Quickstart: Configuration Profiles

How to see the feature work, once it is built. The rules are unit-tested in node; what is
drawn — the toolbar icon, the menu, the seeding, the refusal — is driven in a real browser
by the end-to-end suite.

## Prerequisites

```bash
npm install
```

## The rules, in node

```bash
npx vitest run src/domain/profile/Profile.test.ts src/domain/profile/Profiles.test.ts
npx vitest run src/domain/session/Session.test.ts
npx vitest run src/application/profiles.test.ts src/infra/profile-store.test.ts
npx vitest run src/ui/profile/seed.test.ts src/ui/profile/profile-menu.test.ts
```

Expected:

- `Profile.create('id', '   ')` is `null`; `create('id', 'DemoClipTV', { addToExport: 'true' })`
  has `valueFor('addToExport') === 'true'` and `valueFor('title') === null`.
- `Profile.restore({ id, name, values: { addToExport: '' } })` reads `valueFor('addToExport')`
  as `null` — **unset**, not empty.
- `Profiles.starting().all` holds the built-in default alone and it is active; `remove(default)`
  and `rename(default, …)` are `null`.
- `Profiles.of` on a record whose `activeId` names no profile moves the active to the default;
  on a record with an entry that has an empty name, drops it; on garbage, gives `starting()`.
- Removing the active profile leaves the built-in default active — never an empty book.
- `Session`'s `hasCaptured` is false at start, true after `beginCapture()`, and false again
  after `end()`.
- `ManageProfiles.choose`/`rename`/`remove` with `capturing: () => true` answer `ok: false`
  and the book is unchanged; `create` while capturing adds the profile but does not move the
  active one; with `capturing: () => false` all four work.
- `seedActiveProfile` on an empty clip sets `addToExport` from the active profile; on a clip
  with a take it changes nothing; for a profile carrying nothing it leaves the clip's value.
- The localStorage adapter writes and reads the stored shape unchanged, and answers `null`
  for an empty or unusable record.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/profiles.spec.ts
```

The check boots the app and drives the toolbar:

1. **The icon is right-most** — `#profile-btn` is visible, and it is the last control in
   `.hdr-actions`.
2. **The list** — press it; `#profile-menu` opens and shows the built-in **Default**, marked
   active.
3. **Create and choose** — create **DemoClipTV**, turn its **Add to export** on, choose it;
   the row becomes the marked one.
4. **A clip is seeded** — seed a take (the fixture's path) and open the clip's settings; the
   **Add to export** row is on without the person touching it, and an export writes the
   title card.
5. **The clip owns its value** — turn **Add to export** off on the clip; the profile still has
   it on, and a fresh session under DemoClipTV comes back on.
6. **Refused once capture has begun** — with a take in the session, open the menu and try the
   Default row; the choice is refused, the reason is shown, and the active profile is
   unchanged.
7. **It comes back** — reload; DemoClipTV is still there, with its setting, and still active.
8. **The default cannot go** — the Default row offers no remove, and removing it is refused.

## What no check can do

The recorder's own flow — a real screen share begun with a press, which is what sets the
capture latch in a person's hands — is the user's to run: `getDisplayMedia` needs a gesture
and a picker no check can open. The end-to-end check reaches "has begun to capture" through
the suite's own take fixture, and starts a real take's phase through the app's module hooks.

Run a session by hand and confirm the menu's rows go disabled the moment a take starts
recording.

## In the app, by hand

```bash
npm run dev
```

1. Press the profile icon at the right-hand end of the header; the menu shows **Default**,
   active.
2. Create **DemoClipTV**, open it, and switch **Add to export** on; choose it.
3. Share a screen and record a take. Open the settings control in the corner of the preview:
   **Add to export** is already on, before you touch it.
4. Open the profile menu again: the other rows are out, with the reason that a profile is
   fixed once recording has started; **DemoClipTV** stays active.
5. Export: the file opens with the title card. Press **New**; the menu is usable again, and a
   new clip still starts with **Add to export** on under DemoClipTV.
6. Reload the page: the profile is still there, with its setting, and still the active one.
