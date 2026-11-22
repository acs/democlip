# Feature Specification: Configuration Profiles

**Feature Branch**: `feat/config-profiles`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Our goal is to implement profiles in DemoClip. The goal is that you can have for example DemoClipTV or GraditoneTV profiles which includes all DemoClip configuration in them (and it must be persisted). So for example, you can preload the colors to be used in the arrows by default, if title and description must be added when exporting or that a logo must be always present when exporting. In a first iteration let include in the profile the Clip property 'Add to export'. We will extend it later with other properties. To change between profiles an icon must be shown in the toolbar on the rightest position. When you press in the profile button, you can change between profiles or create a new one."

## Clarifications

### Session 2026-11-22

- Q: Does a profile **preload** the value of a clip property, or **fix** it while that profile is active? → A: **Preload.** The profile supplies the value a new clip starts with, and the person may still change it on the clip; changing the clip does not change the profile.
- Q: When may the profile be changed, and what happens to a session already underway? → A: **The profile is fixed once the session has begun to capture.** Before a session has taken or begun to take a recording, the person may switch profiles freely, and the chosen one governs the clip about to be made. From the moment capture begins in the session, the active profile is fixed: choosing another is refused, plainly said, until the session ends — at **New**, when the clip is exported, or when the share ends. A session restored after a reload comes back fixed to the same profile.
- Q: Is there always at least one profile, and does this iteration include renaming and deleting the profiles the person made? → A: **A built-in default that always exists, and yes to renaming and removing.** The app ships a default profile that cannot be removed and falls back to it when the active profile is removed; the person's own profiles can be renamed and removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A new clip already carries the profile's settings (Priority: P1)

A person works under a named profile — say **DemoClipTV** — that carries a preset
for a clip property: **Add to export** is on. When they start a new clip, that
property is already on, so a clip made under DemoClipTV opens every export with its
title card without anyone remembering to switch it on. They can still change the
property on the clip itself, and doing so does not change the profile.

**Why this priority**: This is the whole point of a profile — the settings a person
always wants, applied without being set every time. Without it, a profile is only a
name in a list.

**Independent Test**: Create a profile that turns **Add to export** on, make it the
active profile, and start a new clip. The clip's **Add to export** is already on, and
exporting the clip writes the title card without the person touching the setting.

**Acceptance Scenarios**:

1. **Given** a profile whose **Add to export** is on, **When** the person starts a new clip while that profile is active, **Then** the new clip's **Add to export** is on.
2. **Given** a clip started under that profile, **When** the person exports it, **Then** the export opens with the title card without the setting being switched on by hand.
3. **Given** a clip started under that profile, **When** the person turns **Add to export** off on the clip, **Then** the clip exports without the card and the profile is unchanged.
4. **Given** a profile whose **Add to export** is off (or a clip started with no profile), **When** the person starts a new clip, **Then** **Add to export** is off, as the app behaves today.

---

### User Story 2 - Choose a profile, or make a new one, from the toolbar (Priority: P2)

A person has more than one way of working — DemoClipTV for one channel, GraditoneTV
for another — and each carries its own settings. An icon sits at the right-hand end
of the toolbar. Pressing it opens the list of profiles, with the active one marked;
while the session has yet to take a recording, choosing another makes it the active
profile at once. From the same place the person creates a new profile by giving it a
name, which is then theirs to set up and use. Once capture has begun in that session
the profile is fixed, and another cannot be chosen until the session ends.

**Why this priority**: Choosing and creating profiles is how a person moves between
the ways of working. It is what makes the profiles in the first story reachable.

**Independent Test**: Press the profile icon in the toolbar, choose a different
profile, and start a clip — the clip carries the newly chosen profile's settings.
Then create a new profile and confirm it appears in the list and can be made active.
Begin recording and confirm the profile can no longer be changed until the session
ends.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the person looks at the toolbar, **Then** a profile icon sits at the right-most position of the toolbar.
2. **Given** the profile icon is pressed, **When** the list opens, **Then** every profile is shown, and the active one is marked.
3. **Given** a session that has not yet begun to capture, **When** the person chooses another profile, **Then** it becomes the active profile and the list shows it marked.
4. **Given** the list is open, **When** the person creates a profile with a name, **Then** the new profile joins the list and can be made active.
5. **Given** a session that has begun to capture, **When** the person opens the list and tries to choose another profile, **Then** the choice is refused, plainly said, and the active profile is unchanged.
6. **Given** a profile is created, **When** the person presses elsewhere or chooses Done, **Then** the list closes and the app is usable as before.

---

### User Story 3 - Profiles outlive the app and are the person's to keep (Priority: P3)

The profiles a person makes are kept: a reload, an update or reopening the app finds
them again, with the active one still active and its settings whole. The app ships
with a default profile so there is always one to work under; the profiles the person
made can be renamed and removed, and the built-in default cannot.

**Why this priority**: A profile a person has to recreate after every reload is not
worth setting up. Keeping them, and being able to tidy them up, is what makes them
usable over time — but it comes after the profiles are reachable at all.

**Independent Test**: Create a profile, set its **Add to export**, close and reopen
the app, and confirm the profile is there, is active, and its setting is whole.
Rename it, then remove it, and confirm the app still has a profile to fall back on.

**Acceptance Scenarios**:

1. **Given** a profile the person made, **When** the page is reloaded or the app is reopened, **Then** the profile is there with the same name and settings, and the active profile is the same one.
2. **Given** the app is opened for the first time, **When** the person looks for a profile, **Then** a built-in default profile is active, so the app works as it does today with no profile set up.
3. **Given** a profile the person made, **When** they rename it, **Then** the new name is shown wherever the profile is and the settings are unchanged.
4. **Given** a profile the person made, **When** they remove it and it was the active one, **Then** the app falls back to a profile that still exists, and the app is usable as before.
5. **Given** the built-in default profile, **When** the person tries to remove it, **Then** the app refuses, so no state is reached with no profile at all.

---

### Edge Cases

- **A first run, before any profile has been made**: the built-in default profile is active, so a clip behaves exactly as it does today.
- **Creating a profile with a blank name**: refused; a profile must have a name, said plainly, and nothing is added.
- **Two profiles with the same name**: allowed — each profile is its own entry, and the active one is marked — but the name alone does not tell them apart, so each entry shows its own settings.
- **A profile whose setting is not set at all**: the app's own default for that property stands; a profile only ever says what it means to say.
- **Switching profile before a session has captured**: allowed; the chosen profile governs the clip about to be made.
- **Choosing another profile once capture has begun in the session**: refused, plainly said; the active profile is unchanged and stays fixed for the rest of the session.
- **A recording begun and then stopped with nothing kept**: the session has begun to capture, so the profile stays fixed until the session ends.
- **The session ends (New, an export, or the share ending)**: the head is lifted — a profile may be chosen again for the next session.
- **A session restored after a reload**: it comes back fixed to the profile it was under, and the list shows it active.
- **Switching profile while an export is running**: an export only happens after capture, so the profile is already fixed; the export uses the values it started with.
- **Removing the profile that is active**: the app moves to another profile that exists (the built-in default), rather than being left with none.
- **The kept profiles cannot be read back** (storage refused or full): the app still opens, using the built-in default, and says the profiles could not be kept rather than losing the clip in front of the person.
- **The person never opens the profile list**: the app behaves as it always has, under the built-in default.
- **A profile made in a newer version, read by an older one**: a setting the older version does not know is ignored, and the rest of the profile still applies.
- **An agent driving the app**: profiles are not offered to an agent in this iteration, so an agent's clip is made under whatever profile is active, exactly as a person's would be.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A **profile** MUST be a named set of DemoClip configuration values that the person can work under; it MUST be persisted so that it outlives a page reload and the closing and reopening of the app.
- **FR-002**: The app MUST have exactly one **active profile** at any time, and MUST work under it.
- **FR-003**: The active profile MUST **preload** the value of the clip property **Add to export** for a clip started while it is active: the clip starts with that value and the person may still change it on the clip.
- **FR-004**: Changing a clip property on a clip MUST NOT change any profile.
- **FR-005**: A profile icon MUST be shown in the toolbar, at its right-most position.
- **FR-006**: Pressing the profile icon MUST open the list of profiles, showing every profile and marking the active one.
- **FR-007**: While the session has not begun to capture, choosing a profile from the list MUST make it the active profile at once.
- **FR-008**: The person MUST be able to create a new profile by giving it a name; the new profile MUST join the list and be selectable as the active profile.
- **FR-009**: A profile MUST have a non-empty name; creating one with a blank name MUST be refused and said plainly.
- **FR-010**: At least one profile MUST always exist: the app MUST ship a built-in default profile that cannot be removed, so no state is reached in which the app has no profile to work under.
- **FR-011**: The active profile and every profile's settings MUST survive a reload and reopening the app.
- **FR-012**: Switching profile MUST NOT change the profile's settings, and MUST NOT change any profile but the active one.
- **FR-013**: From the moment a session begins to capture, its active profile MUST be fixed: choosing another profile MUST be refused, plainly said, until the session ends. The session ends at **New**, when the clip is exported, or when the share ends.
- **FR-014**: A profile that does not set a value for a clip property MUST leave the app's own default for it standing.
- **FR-015**: The settings a profile carries in this iteration are limited to the clip property **Add to export**; the app MUST be able to carry further settings in a later iteration without a person's existing profiles being lost.
- **FR-016**: The profiles the person made MUST be renameable and removable; the built-in default profile MUST NOT be removable.
- **FR-017**: Removing the active profile MUST leave the app under another profile that exists, never under none.
- **FR-018**: When the profiles cannot be read back, the app MUST still open, work under the built-in default, and say that the profiles could not be kept.
- **FR-019**: Working under a profile MUST leave every other part of the app — recording, cutting, annotating, exporting, publishing — exactly as it is today.
- **FR-020**: Profiles MUST be the app's own configuration, kept outside the clip: the clip's one undo MUST NOT reach a profile change, and a profile MUST NOT be written into an exported file, a sidecar or a publish. Whether an agent may choose and create profiles is out of scope for this iteration.
- **FR-021**: A session MUST remember the profile it is under, so a session restored after a reload comes back fixed to the same profile and the list shows it active.
- **FR-022**: Creating a profile while a session has begun to capture MUST NOT change that session's active profile; the new profile joins the list and may be chosen once the session ends.

### Key Entities

- **Profile**: a named set of DemoClip configuration values the person works under — for example **DemoClipTV** or **GraditoneTV**. Its name is what the person calls it; its settings are what it applies. It is kept outside any clip, so it outlives the clip, the page and the app session.
- **Active profile**: the one profile the app is working under. There is exactly one at any time; what a new clip is given comes from it.
- **Clip property "Add to export"**: the clip property, already in the app, that asks the export for a title card. In this iteration it is the one setting a profile carries. It lives with the clip; the profile only says what a new clip should start with.
- **Session**: one sitting of the app — the clip and the sources. It is bound to the profile it began under, and that binding is fixed from the moment it begins to capture; it is over at **New**, when the clip is exported, or when the share ends, and a profile may then be chosen again.
- **Built-in default profile**: the profile the app always has, so a person who has set up nothing still works as today. It is the profile the app falls back to when the active one is removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can go from a clip's title card being off to it being on for every new clip by setting it once in a profile — zero times per clip thereafter.
- **SC-002**: Choosing a profile takes at most one press of the toolbar icon and one press of the profile — two presses from anywhere in the app.
- **SC-003**: 100% of the profiles a person created are still present, with their settings whole, after a reload and after closing and reopening the app.
- **SC-004**: 100% of new clips started under a profile carry that profile's **Add to export** value.
- **SC-005**: Changing a clip's own settings never changes a profile, in 100% of cases.
- **SC-006**: The app is usable in 100% of cases with no profile set up by the person — the built-in default stands.
- **SC-007**: No sequence of removing profiles leaves the app without a profile to work under.
- **SC-008**: A person who never opens the profile list sees the app behave exactly as it does today.
- **SC-009**: The profile icon is at the right-most position of the toolbar, and the list is opened in one press from anywhere in the app.
- **SC-010**: Once a session has begun to capture, no attempt to change its profile succeeds, in 100% of cases, and the person is told why.
- **SC-011**: A session restored after a reload comes back under the same profile, in 100% of cases.

## Assumptions

- Answered in clarification (2026-11-22): a profile **preloads** a clip property's value for a new clip and the person may still change it on the clip; the profile is **fixed for a session from the moment it begins to capture**, and choosing another is refused until the session ends; the app ships a **built-in default profile** that cannot be removed, and the profiles the person made can be renamed and removed.
- A session "begins to capture" when it starts recording a take or brings a take in by **import** — the moment the session stops being empty. Before that it may be switched freely; after that it is fixed.
- The session already outlives a reload in the app; the profile it is under is part of what comes back, so a restored session is still fixed to the same profile.
- Profiles are the person's own machine-wide settings for the app, not a part of a clip: they survive the end of a session and a new clip, and they are not saved into an exported file, a sidecar or a publish.
- Profiles are local to this browser/app on this machine; syncing a profile between devices or people is out of scope for this iteration.
- The profile carries exactly one setting in this iteration — the clip property **Add to export** — and is built so later settings (default arrow colours, whether a title and description are required to export, whether a logo must be present) can be added without losing what exists. Those later settings are explicitly out of scope now.
- The profile applies to what a clip **starts** with; it does not police an export. Whether a profile may one day **require** something (for example, refuse an export with no title) is left to a later iteration.
- The app already has clip properties with one shared control and one shared panel; the profile reuses those, and the **Add to export** setting needs no new kind of value.
- The word **profile** is written into `GLOSSARY.md` before it appears in code, as the project's rule requires, since it is a new concept.
- The profile icon is a toolbar affordance like the theme and help buttons already there, and follows the app's existing toolbar and menu behaviour; it needs no new pattern.
- An agent is not offered the profiles in this iteration; if they are offered later, they go through the app's own operations like everything else, and no separate automation path is assumed.
