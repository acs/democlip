# Feature Specification: Configuration Profiles

**Feature Branch**: `feat/config-profiles`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Our goal is to implement profiles in DemoClip. The goal is that you can have for example DemoClipTV or GraditoneTV profiles which includes all DemoClip configuration in them (and it must be persisted). So for example, you can preload the colors to be used in the arrows by default, if title and description must be added when exporting or that a logo must be always present when exporting. In a first iteration let include in the profile the Clip property 'Add to export'. We will extend it later with other properties. To change between profiles an icon must be shown in the toolbar on the rightest position. When you press in the profile button, you can change between profiles or create a new one."

## Clarifications

### Session 2026-11-22

- Q: Does a profile **preload** the value of a clip property, or **fix** it while that profile is active? → A: **Fix it.** A profile is not a set of defaults; it is the app's configuration, and what it fixes is **not the person's to change** while it is active.
- Q: When may the profile be changed, and what happens to a session already underway? → A: **The profile is fixed once the session has begun to capture.** Before that, the person may switch freely, and the chosen one is applied. From the moment capture begins, another cannot be chosen, plainly said, until the session ends — at **New**, when the clip is exported, or when the share ends. A session restored after a reload comes back fixed to the same profile.
- Q: Is there always at least one profile, and does this iteration include renaming and removing the profiles the person made? → A: **A built-in default that always exists, and yes to renaming and removing.** It falls back to the default when the active profile is removed; the person's own profiles can be renamed and removed.
- Q: Is a profile a set of *defaults* the person can then override, and is that how a profile is defined? → A: **Neither.** The user's own words: "In a Profile … it is defined the config that is defined at Profile level, and that will be applied to DemoClip. And this config can not be changed by the user. So if `add_to_export` is under profile control, the user can not change it. If you want a free profile in which you can change anything, you don't define in the profile any config. If you define a config (a property for example) in the profile, it can not be changed!" A profile **declares which items it controls** and at what; an item it declares is applied and locked, an item it does not declare is free.
- Q: Where is a profile's config defined, and how does a controlled item read? → A: **In the profile's own surface**, opened from the profile's row — never on the selector itself, which only lists, selects, creates, renames and removes. And a controlled item is **shown as a value, naming the profile** ("set by DemoClipTV"), with no control to change it.
- Q: What else does a profile control in this iteration — "a profile needs a logo"? → A: **The clip's logo.** It is a **clip property** like **Add to export**, and its value is the **name of a logo the app itself serves** from its own folder in the repository — nothing is uploaded and nothing comes from elsewhere. Its value **may be empty**, which is the ordinary case: a clip that wears no logo. A clip that wears one opens its export with a card, because the card is where a logo lives. The app knows which marks it serves, so they are **offered as a list to choose from** rather than typed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A profile fixes what it controls, and the person cannot change it (Priority: P1)

A person works under **DemoClipTV**, a profile that declares one thing: **Add to export** is
on. Every clip made under it opens its export with the title card — and the setting is not
theirs to move while that profile is active: the clip's settings show it as a value with the
profile's name beside it, and nothing to press. A profile that declares nothing is a **free**
profile: everything is the person's, exactly as it was before there were profiles at all. The
app's own **Empty** is that profile, and it is always there.

**Why this priority**: This is the whole point of a profile here — a guardrail, not a
default. A setting the person can override is a setting they must remember to set; a setting
a profile fixes is one they cannot get wrong.

**Independent Test**: Store a profile that controls **Add to export** on, load the app, and
open the clip's settings: the row shows the value and the profile's name, with no control.
Export the clip: the file opens with the title card. With the built-in **Empty** active,
the same row is an ordinary switch that the person can move.

**Acceptance Scenarios**:

1. **Given** a profile that controls **Add to export** as on, **When** a clip is made under it, **Then** the clip's settings show the row as a value naming the profile, with no control.
2. **Given** the same clip, **When** the person exports it, **Then** the file opens with the title card.
3. **Given** the built-in **Empty** active, **When** the person opens the clip's settings, **Then** **Add to export** is an ordinary switch, and moving it works exactly as it always did.
4. **Given** a profile that controls **Add to export** as **off**, **When** a clip is made under it, **Then** the row is a value naming the profile and fixed off — which is not the same as leaving it free, where the person could turn it on.
5. **Given** any clip whose setting is controlled, **When** an agent asks the app to change it, **Then** the app refuses and says which profile fixes it.

---

### User Story 2 - Choose a profile, and define what it controls (Priority: P2)

A person has more than one way of working — DemoClipTV for one channel, GraditoneTV for
another — and each carries its own configuration. A pill at the right-hand end of the
toolbar, wearing the active profile's first letters, opens the list of profiles with the
active one marked; choosing another applies it at once. Nothing about a profile is set in that
list: the person's own profiles carry a sliders mark that opens **the profile's own dialog**,
where its **name** is set and each item it may control is set to **Free**, **On** or **Off** —
or, for an item with a value, to a mark or to none. Removal stays in the list, with the bin.

**Why this priority**: Choosing profiles and saying what each fixes is how the guardrails in
the first story are set up and used.

**Independent Test**: Press the pill, create **DemoClipTV**, open its sliders mark, fix **Add
to export** to **On**, choose the profile, and make a clip — the clip shows the item as fixed
by DemoClipTV. The list itself shows no configuration at any point.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the person looks at the toolbar, **Then** a pill sits at the right-most position, wearing the active profile's first letters.
2. **Given** the pill is pressed, **When** the list opens, **Then** every profile is shown with the active one marked, and nothing about what any profile controls.
3. **Given** a profile the person made, **When** its sliders mark is pressed, **Then** its own dialog opens: its name, then one row per item a profile may control, each set Free, On or Off.
4. **Given** a profile's own dialog, **When** the person changes its **name**, **Then** the profile is renamed and the list behind it shows the new name — and the list itself offers no way to rename it.
4. **Given** the config sheet, **When** the person sets an item and closes it, **Then** the profile controls that item, and a clip made under it shows the value as fixed.
5. **Given** a session that has begun to capture, **When** the person opens the list and tries to choose another profile, **Then** the choice is refused, plainly said, and the active profile is unchanged.

---

### User Story 4 - A profile that needs a logo, and the mark reaches the file (Priority: P2)

A production environment needs its mark on what it publishes. **DemoClipTV**'s profile fixes
a **logo** — the name of one of the logos DemoClip serves itself — and every clip made under
that profile opens with a card carrying it, with nothing for the person to remember and
nothing for them to change. A clip with no logo is the ordinary case: no card is asked for by
a logo that is not there, and a name DemoClip does not ship is refused rather than kept, so an
export never waits on a file that will never draw.

**Why this priority**: it is the same guardrail as the first story, over an item that is a
**value** rather than a switch — which is what proves the machinery carries more than one kind
of configuration.

**Independent Test**: store a profile that fixes **Logo** to a name DemoClip serves, load the
app, make a clip, and export it: the first frames of the file carry the mark, and the clip's
settings show the logo as a value naming the profile. With the built-in **Empty** active,
the same row is an ordinary field.

**Acceptance Scenarios**:

1. **Given** a profile that fixes **Logo**, **When** a clip is made under it, **Then** the clip's settings show the logo as a value naming the profile, with no field to change it.
2. **Given** the same clip, **When** the person exports it, **Then** the file opens with a card carrying the mark.
3. **Given** a profile that fixes **Logo** and leaves **Add to export** free, **When** a clip is made under it, **Then** the export still opens with a card — a logo lives on the card, so a clip that wears one always opens with it.
4. **Given** the built-in **Empty** active, **When** the person opens the clip's settings, **Then** **Logo** is an ordinary list of the marks the app serves, on **None** by default.
5. **Given** a logo the app does not ship, **When** it is set — by the person or written into a profile — **Then** it is refused and the clip carries no logo, so an export never waits on a file that will never draw.
6. **Given** a profile whose sheet is open, **When** the person picks a mark from the **Logo** list, **Then** the profile fixes it — and **Not fixed** returns the item to the person, which is not the same as fixing it at **None**.

---

### User Story 3 - Profiles outlive the app and are the person's to keep (Priority: P3)

The profiles a person makes are kept: a reload, an update or reopening the app finds them
again, with what each controls whole and the active one still active. The app ships a default
that controls nothing and cannot be renamed or removed; the profiles the person made can be
renamed and removed, and removing the active one falls back to the default — where every item
is theirs again.

**Why this priority**: A profile that has to be redefined after every reload is not worth
setting up; and the app must never be left without a profile to work under.

**Independent Test**: Create a profile, fix **Add to export** on, choose it, close and reopen
the app, and confirm the profile is there, active, and still fixing the item. Rename it, then
remove it, and confirm the app falls back to **Empty** and the item is the person's again.

**Acceptance Scenarios**:

1. **Given** a profile the person made, **When** the page is reloaded, **Then** the profile, what it controls and the active choice all come back.
2. **Given** the app opened for the first time, **When** the person looks for a profile, **Then** a built-in **Empty** is active, it controls nothing, and the app behaves exactly as it does today.
3. **Given** a profile the person made, **When** they rename it, **Then** the new name is shown wherever the profile is, and what it controls is unchanged.
4. **Given** a profile the person made, **When** they remove it and it was the active one, **Then** the app falls back to **Empty** and stays usable.
5. **Given** the built-in **Empty**, **When** the person tries to rename or remove it, **Then** the app refuses, so no state is reached with no profile at all — and it offers no config sheet, because its whole point is that it controls nothing.
6. **Given** a profile whose item was applied to an empty clip, **When** the profile is removed, **Then** the value it applied stays on the clip and is the person's to change from then on.

---

### Edge Cases

- **A first run, before any profile has been made**: the built-in **Empty** is active, controls nothing, so a clip behaves exactly as it does today.
- **Creating a profile with a blank name**: refused; nothing is added.
- **Two profiles with the same name**: allowed — each is its own entry — but a name alone does not tell them apart, so each shows its own pill.
- **An item a profile controls is applied to a clip that already holds a different value**: the profile's value wins, which is what applying means.
- **A clip that already holds a take**: its items are not re-applied — it is a clip being made, and a profile may not be chosen once capture has begun anyway.
- **A declaration for an item this build does not know**: kept in the profile and never applied, so a profile written by a later version still reads.
- **Switching profile while a clip is in the middle of being edited**: cannot happen — choosing is refused once the session has begun to capture; before that the clip is empty.
- **Removing the profile that is active**: the app moves to the built-in **Empty**, and the items it had applied stay on the clip as the person's own.
- **The kept profiles cannot be read back** (storage refused, full, or a record from another version): the app still opens, under the built-in **Empty**, and says the profiles could not be kept.
- **The person never opens the profile list**: the app behaves as it always has.
- **An agent driving the app**: it is offered the same answer as the person — a controlled item is reported read-only and refused with the profile's name — and it has no way to define or choose a profile in this iteration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A **profile** MUST be a named set of the app's configuration — which items it controls, and the value each is fixed at — persisted so that it outlives a page reload and the closing and reopening of the app.
- **FR-002**: The app MUST have exactly one **active profile** at any time, and MUST work under it.
- **FR-003**: An item the active profile **declares** MUST be applied to the clip and MUST **not be the person's to change** while that profile is active: it is shown as a value naming the profile, with no control, and the app's other surfaces refuse to change it.
- **FR-004**: An item the active profile does **not** declare MUST be left entirely to the person: nothing about its behaviour changes from an app with no profiles.
- **FR-005**: A profile control MUST be shown in the toolbar, at its right-most position, wearing the active profile's first letters (Dem for DemoClipTV), so what a clip is about to be made under is readable without opening anything.
- **FR-006**: Pressing the profile control MUST open the list of profiles, showing every profile and marking the active one, and showing **nothing** about what any profile controls.
- **FR-007**: While the session has not begun to capture, choosing a profile from the list MUST make it the active profile at once, and MUST apply what it declares.
- **FR-008**: The person MUST be able to create a new profile by giving it a name; the new profile MUST join the list, MUST control nothing at first, and MUST be selectable as the active profile.
- **FR-009**: A profile MUST have a non-empty name; creating one with a blank name MUST be refused and said plainly.
- **FR-010**: At least one profile MUST always exist: the app MUST ship a built-in **Empty** that controls nothing and cannot be renamed or removed, so no state is reached in which the app has no profile, or in which an item is controlled that the person cannot undo by letting the profile go.
- **FR-011**: The active profile, every profile's declarations and the active choice MUST survive a reload and reopening the app.
- **FR-012**: A profile's configuration, and **its name**, MUST be set in the **profile's own surface**, opened from that profile's row, and MUST NOT be set or shown in the list of profiles. The list selects a profile, creates one, and lets one go; nothing else about a profile is done there.
- **FR-013**: From the moment a session begins to capture, its active profile MUST be fixed: choosing another MUST be refused, plainly said, until the session ends. The session ends at **New**, when the clip is exported, or when the share ends. The active profile's own declarations MUST also be frozen then, so nothing moves under a clip already being made; another profile's MAY still be defined, renamed and removed.
- **FR-014**: Applying a profile's item to a clip MUST NOT be what the app's one undo takes back: the undo takes back the person's own last change, and never puts back a value a profile is holding.
- **FR-015**: The items a profile may control in this iteration are the clip property **Add to export** and the clip property **Logo**; the app MUST be able to offer further items in a later iteration without a person's existing profiles being lost.
- **FR-016**: The profiles the person made MUST be renameable — in the profile's own surface, with its configuration — and removable from the list. The built-in **Empty** MUST NOT be renamed, removed or given a surface of its own.
- **FR-017**: Removing the active profile MUST leave the app under another profile that exists, never under none.
- **FR-018**: When the profiles cannot be read back, the app MUST still open, work under the built-in **Empty**, and say that the profiles could not be kept.
- **FR-019**: Working under a profile MUST leave every other part of the app — recording, cutting, annotating, exporting, publishing — exactly as it is today.
- **FR-020**: Profiles MUST be the app's own configuration, kept outside the clip: they MUST NOT be written into an exported file, a sidecar or a publish, and the built-in **Empty** MUST NOT be definable. Whether an agent may choose or define profiles is out of scope for this iteration.
- **FR-021**: A session MUST remember the profile it is under, so a session restored after a reload comes back fixed to the same profile and the control shows it active.
- **FR-022**: Creating a profile while a session has begun to capture MUST NOT change that session's active profile; the new profile joins the list and may be chosen once the session ends.
- **FR-023**: A profile's declaration for an item this build does not know MUST be kept and MUST NOT be applied, so a profile written by a later version reads and one written earlier still opens.
- **FR-024**: A clip MUST be able to carry a **logo** — one of the logos the app serves from its own folder in the repository — as a clip property the person sets and a profile may fix. Because the app is the one that knows which marks it serves, they MUST be offered as a **list to choose from** rather than typed, on both surfaces that set the item. Its value MAY be empty, and empty is the ordinary case: the clip wears no logo.
- **FR-025**: A logo whose name the app does not serve MUST be refused rather than kept, by the person's own control and by a written profile alike, so no export waits on a file that will never draw.
- **FR-026**: Every export of a clip that wears a logo MUST open with a card carrying it — **webm, mp4, the file for editing and a publish alike** — because the card is where a logo lives. A clip that wears one therefore asks for a card even when **Add to export** is off, and its words are whatever the clip has, the day line always among them.
- **FR-027**: The logo MUST be decoded before the file's first frame is written, so the card's very first frame wears it — a card is read the moment it appears — and a logo that will not load MUST NOT stop the export: the card is written without it.
- **FR-028**: A logo MUST be drawn at **its own proportions** — scaled, never stretched, whatever the shape of the clip's picture — and as tall as the card's logo row, so marks of any shape are read at the same size. A mark that is wider than the row allows MUST be bounded by the picture's width instead, still at its own proportions.

### Key Entities

- **Profile**: a named set of the app's configuration a person works under — for example **DemoClipTV** or **GraditoneTV** — and a **consistent production environment** for that way of working: the configuration it needs, applied every time a clip is made under it. It holds **declarations**: which items it controls, and the value each is fixed at. It is kept outside any clip, so it outlives the clip, the page and the session. A profile that declares nothing is a **free** profile.
- **Active profile**: the one profile the app is working under. There is exactly one at any time, and what it declares is in force while it is active.
- **A profile's own surface**: the dialog its sliders mark opens — where the profile is **named** and where what it controls is decided. The list of profiles only chooses, creates and lets go; the name and the configuration both live here.
- **Controlled item**: an item the active profile declares. It is applied to the clip and is not the person's to change: the clip's settings show its value and name the profile, and the app's other surfaces refuse it. An item no profile declares is the person's, exactly as before profiles existed. The items a profile may control in this iteration are **Add to export** and the **Logo**.
- **Logo**: a clip property: one of the marks the app serves from its own folder — **chosen from the list the app declares**, not typed — or nothing. A clip that wears one opens every export with a card carrying it. It is a **value** rather than a switch, which is why it can be empty, and why **None** (no logo) and **Not fixed** (the person's) are told apart where a profile is defined.
- **Declaration**: what a profile says about one item — that it controls it, and the value it is fixed at. An item may legitimately be fixed at an empty value (a switch fixed **off**), which is why "declared" and "empty" are told apart here and not in the clip's own properties.
- **Built-in default profile**: the profile the app always has and falls back to, so an app with nothing set up behaves as it always did. It declares nothing, is never renamed or removed, and has no config surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can make **Add to export** impossible to get wrong for a way of working by fixing it once in a profile — the setting is applied to every clip made under that profile, with nothing to press.
- **SC-002**: Choosing a profile takes at most one press of the pill and one press of the profile — two presses from anywhere in the app.
- **SC-003**: 100% of the profiles a person created, and what each controls, are still present after a reload and after closing and reopening the app.
- **SC-004**: 100% of clips made under a profile that controls **Add to export** either take the title card or do not, exactly as the profile fixes it, with no input from the person.
- **SC-005**: An item a profile controls cannot be changed by the person or by an agent, in 100% of cases, and the refusal names the profile.
- **SC-006**: The app is usable in 100% of cases with no profile set up — the built-in **Empty** stands.
- **SC-007**: No sequence of removing profiles leaves the app without a profile to work under.
- **SC-008**: A person who never opens the profile list sees the app behave exactly as it does today.
- **SC-009**: The profile control is at the right-most position of the toolbar, wearing the active profile's first letters, and the list is opened in one press from anywhere in the app.
- **SC-010**: Once a session has begun to capture, no attempt to change its profile succeeds, in 100% of cases, and the person is told why.
- **SC-011**: A session restored after a reload comes back under the same profile, in 100% of cases.
- **SC-012**: The list of profiles never shows or sets what a profile controls, in 100% of cases; a profile's configuration is reachable only from that profile's own sheet.
- **SC-013**: Letting a profile go leaves the app usable and the item the person's again, in 100% of cases, with whatever value it last applied still on the clip.
- **SC-014**: A clip made under a profile that fixes a logo opens its export with that mark on the card, in 100% of cases, with nothing for the person to do — and a clip with no logo opens with no card from the logo, in 100% of cases.

## Assumptions

- Answered in clarification (2026-11-22): a profile **fixes** what it declares and the person cannot change it; the profile is **fixed for a session from the moment it begins to capture**; the app ships a **built-in default** that declares nothing and cannot be removed; a profile is **defined in its own surface**, never on the selector; and a controlled item reads as a **value naming the profile**.
- A session "begins to capture" when it starts recording a take or brings a take in by **import** — the moment the session stops being empty. Before that a profile may be chosen freely; after that it is fixed.
- The session already outlives a reload in the app; the profile it is under is part of what comes back.
- Profiles are the person's own settings for the app on this machine, not a part of a clip: they survive the end of a session and a new clip, and they are not saved into an exported file, a sidecar or a publish. Syncing a profile between devices or people is out of scope.
- A profile controls two items in this iteration — the clip property **Add to export** and the clip property **Logo** — and is built so later items (default arrow colours, whether a title and description are required to export) can be added without losing what exists. Those later items are explicitly out of scope now.
- The logos the app can wear are **files in the repository**, served beside the app from its own folder, and a clip's value is the **name** of one of them: nothing is uploaded by the person and nothing is fetched from anywhere else. Adding a mark is adding a file and a line to the app's own list.
- A **logo asks for a card**: the card is where a clip's mark is drawn, so a clip that wears one opens with it whether or not **Add to export** is on. The card's words are then whatever the clip has, with the day line always among them.
- A logo the app does not serve is refused by the clip property itself, so neither a person nor a written profile can leave a clip waiting on a file that will not draw.
- A mark is drawn by **its height**, not into a box whose edges are fractions of two different lengths: the picture's width and its height are different lengths, and fitting a mark to both would deform it. It is scaled to the card's logo row, bounded by the width only when it is very wide, and every mark comes out the same height so a row of them reads evenly.
- Applying a profile's item is a **load**, not the person's edit: it is announced so every view follows it, and it is not what the one **undo** takes back.
- A clip that came back after a reload keeps the values it holds. Because a profile may not be chosen once capture has begun, and its own declarations are frozen then, a controlled item cannot fall out of step with the clip in any ordinary path.
- The built-in **Empty** is the app's free profile, so it has no config surface: a person who wants a freer profile makes a new one and leaves it controlling nothing.
- The app already has clip properties with one shared control and one shared panel; a controlled item reuses the **read-only** shape the clip's own size already uses, so the panel needs no new kind of row.
- The word **profile** is written into `GLOSSARY.md` before it appears in code, as the project's rule requires.
- The profile control is a toolbar pill in the header's icon-button family, and its sheet is a modal in the family of the app's text-entry dialog.
- An agent is not offered the profiles in this iteration; if they are offered later, they go through the app's own operations like everything else.
