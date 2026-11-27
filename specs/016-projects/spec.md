# Feature Specification: Projects

**Feature Branch**: `feat/projects`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "Feature: Projects — Introduce Projects in DemoClip to organise video production around a purpose or objective. A Project captures why we are recording, including its motivation and objectives. All recordings (Clips) inside a project are persisted. You can access all the recordings for a project. You can remove a recording from a project. And you can modify it. The Project has a default Profile. But it can be changed in each Clip. A Project provides an overview of its recording plan, progress and completed recordings. Each Project has a default Profile defining the production configuration for its videos. Individual Clips inherit the Project's default Profile but can explicitly override it. A Default Project is created automatically, preserving DemoClip's existing individual-recording workflow. Existing recordings and Clips are migrated into the Default Project without data loss. Projects must be accessible through both the DemoClip UI and its agent/MCP interface."

## Clarifications

### Session 2026-11-27

- Q: Does a project's default profile **lock** the items it declares, as a profile does today, or supply values a clip may override item by item? → A: **The lock is unchanged; a clip departs from the project's default by using another profile.** A project has a **default** profile, not a fixed one. A clip made in the project starts under it, and the person may change the **clip's profile** — the profile as a whole, not an item a profile declares. Whichever profile is in force still applies and locks what it declares, exactly as today, so no item a profile declares becomes editable: the exception is a different profile for that clip, and the clip records which profile it uses.
- Q: When a profile that a recording was made under later changes, does the recording keep the configuration it was made with or follow the profile's new values? → A: **It keeps the configuration it was made with.** A recording takes a snapshot of its profile's declarations when it begins to capture; later changes to the profile reach only recordings made afterwards, and never one already made.
- Q: What is a project's **recording plan**? → A: **For now, the project's description.** The plan is the project's own words — its motivation and objectives — with nothing structured beside them; progress is derived only from the recordings themselves. A structured plan is deliberately deferred and will be evolved in a future iteration.
- Q: What does **removing a recording from a project** do? → A: **It moves to the Default project.** Removing takes the recording out of that project and puts it in Default, where it is still reachable and still counts in Default's progress. Nothing is destroyed; deleting a recording for good is a separate, explicit act.
- Q: When is a recording **finished**? → A: **When its clip session is finished** — when the session ends at New, on export or publish. While a session is open on it, the recording is in progress and is not counted as finished; reopening a finished recording starts a session on it, so it is in progress again until that session ends.
- Q: How does the app decide which project a new recording belongs to? → A: **The app is always in a project.** Exactly one project is **current**: the built-in Default until the person selects another. Every recording made while a project is current belongs to it, and creating a project makes it current when the session has not begun to capture.
- Q: What does **opening a recording** from a project do? → A: **It resumes the recording as a session**, takes included: the person can cut, annotate, change properties and record more takes. The recording is in progress while that session is open and finished again when it ends.
- Q: Which project operations may the **agent** perform? → A: **Organise, never destroy.** The agent may list and read projects, create one, select the current project, edit its description and default profile, move recordings, and remove a recording to Default. Deleting a recording for good and removing a project are the person's alone, because they are irreversible and need a confirmation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A project gathers the recordings made for one purpose (Priority: P1)

A person is producing a short tutorial series. They create a project, **Onboarding videos**, and write
down why it exists: the motivation (why these videos, for whom) and what it must achieve (its objectives).
They then work exactly as they always have — press Record, pick the source in the browser's own
picker, record takes — and each clip they make is kept as a recording **of that project**. Later they open
the project, see every recording made for it, open any one of them to change it, and take one out
that does not belong, where it moves to the **Default** project rather than being destroyed.

**Why this priority**: This is the feature's core. Today DemoClip holds one clip at a time and forgets
it at the end of the session; a project is what turns a pile of recordings into a body of work with a
reason. Without this, nothing else here has a subject.

**Independent Test**: Create a project with a name, a motivation and objectives. Record two clips in it.
Reload the app. Both are listed under the project. Open the second, cut it, and return to the list;
remove the first (it moves to the Default project); the second still opens with its cut in place.

**Acceptance Scenarios**:

1. **Given** no project with that name, **When** the person creates a project with a name, a motivation and objectives, **Then** it appears among the projects and becomes the current project, so new recordings go into it.
2. **Given** a project with two recordings, **When** the person returns to it after a reload, **Then** both recordings are listed with their title, length and state, beside the project's own purpose.
3. **Given** a listed recording, **When** the person opens it, **Then** the review shows exactly what that recording held — its takes, cuts, annotations and properties — and it can be changed as any clip can, including with further takes.
4. **Given** a listed recording that the person has changed, **When** they return to the project's list, **Then** the recording is still there with its changes kept.
5. **Given** a project, **When** the person removes one of its recordings, **Then** that recording leaves the project, appears in the **Default** project with everything it held, and the project's other recordings are untouched.
6. **Given** a recording in the **Default** project, **When** the person deletes it for good, **Then** it is destroyed only after a confirmation naming it, and its storage is freed.
7. **Given** a project, **When** the person changes its name, its motivation or its objectives, **Then** the change is kept and shown wherever the project's description is shown.

---

### User Story 2 - The Default Project keeps every existing recording (Priority: P1)

A person updates DemoClip and carries on without learning anything new. The recording they had kept is
still there, in a project named **Default**, and opens exactly as before. There is never a moment where
the app has nowhere to put a recording, and a person who never opens the projects list can still record,
cut and export in the same number of steps as before.

**Why this priority**: Projects reorganise where recordings live, and reorganising is exactly where work
gets lost. The update must be invisible to the person who does not want projects, and must not cost
anyone a recording.

**Independent Test**: Keep a recording with the previous version (takes, a cut, an annotation, a
property). Start the new version. Exactly one **Default** project exists and holds that recording,
which opens with the same length to the second, the same cut and the same annotation. Clear the app's
data and start again: exactly one Default project is created, not two.

**Acceptance Scenarios**:

1. **Given** a recording kept by the previous version, **When** the new version starts for the first time, **Then** the recording is listed in the **Default** project and opens with its takes, length, cuts, annotations and properties unchanged.
2. **Given** a person who ignores projects entirely, **When** they record, cut and export a clip, **Then** every step is where it was before, with no new step required.
3. **Given** the app has started and created the Default project, **When** it starts again, **Then** there is still exactly one Default project.
4. **Given** the Default project, **When** the person looks for a way to remove or rename it, **Then** there is none, and the app says why.
5. **Given** the Default project holding several recordings, **When** the person deletes one of them for good, **Then** the Default project remains and the others are untouched.

---

### User Story 3 - A project's default Profile is how its videos are produced (Priority: P2)

A project is produced for one channel, so it carries one of the app's **profiles** as its **default**:
the production configuration its videos start from. A new recording in the project starts under that
profile. When a particular recording is produced differently, the person changes **that clip's
profile** — the whole profile, not an item inside it — and the configuration that profile declares
applies and is locked, exactly as it is today. A profile that declares nothing leaves everything the
person's.

**Why this priority**: It is what makes a project a production commitment rather than a folder. It
depends on US1 having a project to attach a profile to, hence P2.

**Independent Test**: Give a project a profile that fixes a visible property (for example **Add to
export** on) as its default. Record a clip in the project: the clip shows the profile's value, locked,
naming the profile. Before recording, change that clip's profile to a free one: every item becomes the
person's. Record a second clip: it starts under the project's default again. Try to change a declared
item while its profile is in force: it is refused, naming the profile.

**Acceptance Scenarios**:

1. **Given** a project whose default profile declares an item, **When** a recording is made in the project, **Then** the recording starts under that profile, shows its declared value, and says which profile fixes it.
2. **Given** a recording that has not begun to capture, **When** the person changes its profile, **Then** the newly chosen profile's declarations apply and are locked, and an item no profile declares is the person's.
3. **Given** a recording under a profile that declares an item, **When** the person tries to change that item, **Then** the app refuses and names the profile — the same rule as before projects existed.
4. **Given** a clip made in the project, **When** the person opens another recording of the same project, **Then** that other recording still starts under the project's default profile.
5. **Given** a project's default profile, **When** the person changes it, **Then** recordings made afterwards start under the new default, and recordings already made keep the configuration they were made with.
6. **Given** the built-in **Default** profile as a project's default, **When** a recording is made, **Then** every item is the person's, exactly as it was before profiles or projects existed.
7. **Given** a recording that has begun to capture, **When** the person looks for a way to change its profile, **Then** it is fixed for the life of that recording, as it is today.

---

### User Story 4 - A project shows its description, its progress and its finished recordings (Priority: P2)

The person opens a project and sees, on one surface, the project's description — what it is for, in
their own words — how far along it is, and which recordings are finished. They do not have to count
the list themselves to know whether the project is done. The description is, for now, the whole of the
project's recording plan; a structured plan comes later.

**Why this priority**: The purpose of a project is to know where the work stands. It is valuable from
the first recording, but it needs recordings and states to exist first, so it follows US1 and US3.

**Independent Test**: Give a project several recordings, finish some by ending their clip sessions
(export them, or start a new session with **New**), and leave others in progress. Open the project's
overview: the description, the recordings and the count finished against the total are shown together
and agree with the list; ending another session moves the count without a reload.

**Acceptance Scenarios**:

1. **Given** a project, **When** the person opens its overview, **Then** its description (its motivation and objectives), its recordings, and how many recordings are finished out of the total are shown together.
2. **Given** a project with no recordings, **When** the overview is opened, **Then** it says the project is empty and offers to start a recording, rather than showing an error or a blank surface.
3. **Given** a recording whose clip session is open, **When** that session ends — at **New**, on export or publish — **Then** the project's overview counts the recording as finished.
4. **Given** a finished recording, **When** the person reopens it and changes it or records into it, **Then** it counts as in progress while that session is open, and finished again when the session ends.
5. **Given** a recording whose session is still open, **When** the overview is shown, **Then** the recording is listed as in progress, not finished.
6. **Given** a project whose recordings all count as finished, **When** the overview is opened, **Then** it plainly says the project is complete.
7. **Given** a project's description, **When** the person edits it, **Then** the new words are shown on the overview and the derived progress figures are unchanged by the edit.
8. **Given** a project, **When** its overview is shown, **Then** no structured plan — no checklist, schedule or set of planned recordings — is required or implied; the description stands in for it until a later iteration replaces it.

---

### User Story 5 - The agent works with projects too (Priority: P3)

The person's agent can answer "what is in the Launch project, and what is left?" and can act on the
answer: list the projects, read one project's description and recordings, create a project, choose
which project is current, edit a project's description and default profile, move a recording between
projects, or remove one to Default. It organises but never destroys: deleting a recording for good and
removing a project stay the person's. Everything the agent does is visible in the window the person is
watching, and it can reach nothing that is not on that machine.

**Why this priority**: Projects are part of how the app is driven, and an agent that cannot see them
would be blind to the work's organisation. It is last because it is an extension of an interface that
already exists and every operation here is also reachable by hand.

**Independent Test**: From the agent interface, list the projects, create one with a purpose, and read
back its recordings. The person sees the new project appear in the window without reloading. Ask the
agent to remove a recording from the project; it appears in **Default**, still whole.

**Acceptance Scenarios**:

1. **Given** projects on the machine, **When** an agent asks for them, **Then** it receives each project's name and purpose and can ask for one project's recordings.
2. **Given** the person asks for a new project, **When** the agent creates it with a name, a motivation and objectives, **Then** the project appears in the person's window with that purpose.
3. **Given** a project selected by the agent, **When** a recording is made, **Then** it belongs to that project.
4. **Given** a recording the agent moves or removes, **When** the change lands, **Then** the person sees it in the window and the project's list and overview agree.
5. **Given** any agent operation on projects, **When** it is attempted, **Then** it follows the same rules as the person's own action and stops where the person's confirmation is needed.
6. **Given** a recording or a project, **When** the agent is asked to delete the recording for good or remove the project, **Then** it refuses and says the person must do it, with a confirmation.

---

### Edge Cases

- **The last recording of a project is removed**: the project remains, empty, with its purpose intact and a way to start another recording; the recording itself is in the Default project, not lost.
- **A project is removed while it holds recordings**: its recordings move to the Default project, and the confirmation names them and says the project's own purpose will be lost; the recordings are never silently destroyed.
- **A recording is removed from the Default project**: there is no other project to move it to, so removal from Default is not offered — deleting the recording is the separate act there, and it is confirmed.
- **A recording is open in the review when its project is changed or removed elsewhere**: the open recording keeps the project it was opened from until the session ends, and the person is not left editing something that vanished.
- **The person switches project while a session has begun to capture**: the switch is refused and explained, because the clip being made belongs to the project it started in; it may be moved afterwards.
- **A project's default profile is removed or renamed**: the project points at a valid profile for new recordings — the app falls back to the built-in **Default** rather than to nothing — and a recording already made keeps what it was produced with.
- **A profile a recording was made under is edited afterwards**: the recording keeps the configuration it was made with; the edit reaches only recordings made afterwards.
- **A project's default changes after recordings exist**: recordings made afterwards start under the new default; recordings already made keep the configuration they were made with, and nothing about them moves.
- **A clip's profile is changed, then the project's default changes**: the clip keeps the profile and configuration the person chose for it; the project's default concerns recordings not yet made.
- **A recording stored by an older version carries no project**: it is adopted by the Default project on the next start, once.
- **The migration runs again after a partial failure**: no project is duplicated, no recording is duplicated, and nothing already adopted is moved again.
- **Storage is full when a recording is saved**: the recording is not silently dropped; the person is told the recording could not be kept and what to remove.
- **Two windows of the app are open**: a change made in one appears in the other the next time the project is read, and a recording is never listed in two projects at once.
- **A project's name is empty, extremely long, or already used**: the app refuses the name and says which rule it broke; the person's other projects are unaffected.
- **The agent asks for a project that no longer exists**: it is told it is gone and given the projects that exist, rather than acting on a stale reference.
- **A project has no motivation or objectives yet**: it is still a valid project, and the surface invites the person to write them rather than refusing the project.

## Requirements *(mandatory)*

### Functional Requirements

**Projects**

- **FR-001**: Users MUST be able to create a project by giving it a **name**, a **motivation** and **objectives**.
- **FR-002**: A project's name MUST be required, and MUST be refused if another project the person created already uses it, ignoring case and surrounding spaces.
- **FR-003**: A project's motivation and objectives MUST be free text, MAY be empty, and MUST be changeable at any time.
- **FR-004**: A project's name MUST be changeable at any time, subject to FR-002.
- **FR-005**: Users MUST be able to remove a project they created, after confirming, and the confirmation MUST state that its recordings move to the **Default** project and that the project's own purpose will be lost.
- **FR-006**: The project list MUST show every project with enough to tell them apart: its name, its purpose, and how many recordings it holds; it MUST let the person select one, making it the current project.
- **FR-007**: A project MUST remain a valid, empty project when its last recording is removed.

**Recordings inside a project**

- **FR-008**: Exactly one project MUST be **current** at all times — the built-in Default until the person selects another — and every clip recorded or imported while it is current MUST become a **recording** of it.
- **FR-009**: Every recording MUST be kept when the page is closed, reloaded or updated, and MUST reappear in its project without the person re-importing or re-recording it.
- **FR-010**: Users MUST be able to see every recording of a project, listed with at least its title, its length and its state.
- **FR-011**: Users MUST be able to open any listed recording and change it exactly as a clip in the current session — cut it, annotate it, change its properties, record further takes into it — and the change MUST be kept.
- **FR-012**: Users MUST be able to remove a recording from a project other than the Default project; removing it MUST move it to the Default project, preserving everything it held, and MUST NOT destroy it.
- **FR-013**: Users MUST be able to move a recording from one project to another.
- **FR-014**: A recording MUST belong to exactly one project at any time.
- **FR-015**: The app MUST refuse to change the current project, or the project of the open recording, once the session has begun to capture, explaining that the recording may be moved when the session ends.
- **FR-016**: Users MUST be able to delete a recording for good from the Default project, after a confirmation naming the recording; deletion is the only operation that destroys a recording's bytes and MUST NOT be offered as an undoable action.

**Profiles**

- **FR-017**: Each project MUST name exactly one of the app's profiles as its **default profile**.
- **FR-018**: A recording made in a project MUST start under the project's default profile.
- **FR-019**: Users MUST be able to change a recording's profile before the recording has begun to capture, including to the app's built-in **Default**.
- **FR-020**: Whichever profile is in force for a recording MUST lock every item it declares, exactly as a profile does without projects: the person MUST NOT be able to change a declared item.
- **FR-021**: An item no profile in force declares MUST remain the person's to change, exactly as it is today.
- **FR-022**: The profile a recording uses, and the configuration it declared when the recording began to capture, MUST be recorded with the recording and MUST be what is shown wherever a value it declares is displayed.
- **FR-023**: Once a recording has begun to capture, its profile MUST be fixed for the life of that recording.
- **FR-024**: Changing a project's default profile MUST affect only recordings made afterwards; a recording already made keeps the configuration it was made with.
- **FR-025**: A project whose default profile no longer exists MUST fall back to the app's built-in **Default** profile for new recordings, and MUST continue to be usable.
- **FR-026**: A project created without choosing a profile MUST use the app's built-in **Default** profile.

**Overview**

- **FR-027**: A project MUST provide one overview showing its description, its recordings, and its progress.
- **FR-028**: The overview MUST show how many of the project's recordings are finished against the total, and that figure MUST agree with the list.
- **FR-029**: A recording MUST count as **finished** when its clip session is finished — at **New**, on export or publish — and MUST count as **in progress** while a session is open on it.
- **FR-030**: The overview MUST state plainly when a project is empty and when all of its recordings are finished.
- **FR-031**: The overview MUST be reachable from the app's main screen in no more than two actions.
- **FR-032**: A project's **description** MUST be its motivation and objectives, shown in the project's own words and preserved exactly as written.
- **FR-033**: For this iteration the description MUST stand in for the project's **recording plan**: no checklist, schedule or set of planned recordings is required, and progress MUST be derived only from the recordings the project holds. A structured plan is deferred to a later iteration.
- **FR-034**: Editing the description MUST NOT change the project's recordings or their states.

**Default project and migration**

- **FR-035**: The app MUST ensure that exactly one **Default** project exists, creating it automatically when none does.
- **FR-036**: The Default project MUST NOT be removable or renameable, and the app MUST explain why.
- **FR-037**: On the first start after projects exist, every recording kept by the previous version MUST be adopted by the Default project with its takes, length, cuts, annotations, properties and profile intact.
- **FR-038**: The migration MUST be repeatable without duplication: running it again MUST NOT create a second Default project or a second copy of any recording.
- **FR-039**: A failure during the migration MUST NOT delete or corrupt an existing recording; the app MUST say that the migration did not finish and MUST leave the recordings where they were.
- **FR-040**: A person who never opens the projects list MUST be able to record, cut and export in the same number of steps as before projects existed.

**Agent interface**

- **FR-041**: The agent interface MUST expose the projects on the machine: each project's name, description, default profile and recordings.
- **FR-042**: The agent interface MUST let an agent create a project with a name, a motivation and objectives, and edit a project's description and default profile.
- **FR-043**: The agent interface MUST let an agent choose which project is current, and so which project a new recording belongs to.
- **FR-044**: The agent interface MUST let an agent move a recording between projects and remove a recording from a project, subject to the same rules that apply to the person.
- **FR-045**: The agent interface MUST NOT delete a recording for good or remove a project; those operations MUST remain the person's, behind a confirmation.
- **FR-046**: A change made through the agent interface MUST appear in the person's window without a manual reload.
- **FR-047**: The agent interface MUST reach only what is on that machine: no project, purpose or recording may be uploaded or shared as part of these operations.

**Keeping and privacy**

- **FR-048**: Projects and their recordings MUST live on the person's machine, and MUST survive a page reload, a new version of the app and a browser restart.
- **FR-049**: Deleting a recording MUST be the only operation that destroys its bytes; every other change, a removal from a project included, MUST leave the recording's own recorded bytes untouched.

### Key Entities *(include if feature involves data)*

- **Project**: the container for a body of work and its reason. Holds a name, a description (its motivation and objectives), a default profile and its recordings. Exactly one project is the **Default** project, which always exists and cannot be removed; exactly one project at a time is **current**, and the app is always in one.
- **Recording**: a clip that belongs to a project. It is the existing clip — takes, cuts, annotations and properties — plus the project it belongs to, its state (in progress while its clip session is open, finished once that session has ended), and the **profile it is produced under**, which may be the project's default or one the person chose for that clip.
- **Project default profile**: the app's existing **profile**, named by a project as the production configuration its recordings start under. Not a second kind of configuration: the same profile the app already has, and it locks what it declares exactly as it always does.
- **Clip profile**: the profile a particular recording is produced under, fixed once the recording begins to capture, together with the configuration that profile declared at that moment. It is either the project's default or one the person chose for that clip before capture, and it is what the recording reports when an item is shown with the profile that fixes it.
- **Progress**: derived, not stored beside the recordings: how many of a project's recordings are finished and how many there are.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can create a project and begin recording into it in no more than three actions and under 30 seconds, from the app's main screen.
- **SC-002**: After updating, **100%** of recordings kept by the previous version appear in the Default project, with zero lost, and each opens with the same length to the second, the same cuts and the same annotations.
- **SC-003**: After a reload, **100%** of a project's recordings are listed again within 2 seconds for a project holding up to 50 recordings.
- **SC-004**: A person can find a named recording in a project in no more than two actions from the app's main screen.
- **SC-005**: Removing a recording from a project leaves **100%** of every other recording byte-identical and the removed one intact in the Default project; deleting it for good then frees at least its own size in storage.
- **SC-006**: **100%** of recordings made in a project start under that project's default profile, and a recording whose profile the person changed applies that profile instead; in **100%** of cases an item a profile declares cannot be changed by the person and names the profile that fixes it.
- **SC-007**: A project's overview shows figures that agree with its list in **100%** of cases, and reflects a new recording or a clip session ending the next time it is shown, without a reload.
- **SC-008**: An agent can answer "what is in this project and what is left?" in one exchange, with no action by the person in the app.
- **SC-009**: Zero projects, purposes or recordings leave the person's machine as a result of this feature; every operation works with no network connection.
- **SC-010**: A person who never opens the projects list produces and exports a recording in the same number of steps, and the same time to within 10%, as before projects existed.

## Assumptions

- **Local only, no accounts.** Projects are kept in the browser on the person's own machine, exactly as recordings are today. There is no sync, no sharing, no team workspace and no server.
- **The existing profile is reused.** "Profile" means the configuration profile DemoClip already has, not a second kind of production configuration. A project names one as its default.
- **The profile lock is unchanged.** A project names a **default** profile, not a fixed one; a recording starts under it and the person may change the recording's profile before capture. Whichever profile is in force still applies its declarations and locks them, so no item a profile declares becomes editable. The exception to a production configuration is a different profile for that clip, not a looser rule inside the profile.
- **A recording's profile is fixed once it begins to capture**, matching today's rule that the choice belongs to the session. The recording keeps the configuration it was made with, even if the profile is edited, renamed or removed later; a later change to the project's default or to the profile concerns recordings made afterwards.
- **The plan is the description for now.** A project's description — its motivation and objectives — stands in for its recording plan in this iteration. No structured plan, checklist or schedule is modelled, and none is implied; a later iteration evolves it.
- **One recording open at a time.** A project is a container and an overview, not a second editor: opening a recording from a project opens it in the same review the app already has, and resumes it — cuts, annotations, properties and further takes — until that session ends.
- **A project needs a name, not a purpose yet.** Motivation and objectives are what a project is for, and the app invites them, but an empty pair does not block recording.
- **A recording's title is the clip's own.** The list shows the clip's title when it has one, and otherwise a label made from the project's name and when the recording was made; the title remains the clip property it already is.
- **The app is always in a project.** Exactly one project is current, the Default one until the person selects another, so the app never starts without somewhere to record. The current project is the app's state and is remembered across a reload, and every recording belongs to the project that was current when it was made.
- **A recording is finished when its clip session is finished.** The session ends at **New**, on export or publish, and that is what makes the recording finished; no separate approval or export is required. Reopening a finished recording opens a session on it, so it is in progress until that session ends again.
- **The Default project is named "Default"**, matching the app's built-in Default profile, and is the only project that cannot be removed or renamed.
- **The Default project is where the existing single-recording flow lands**, and where a recording removed from another project goes, so a person who ignores projects is never asked to choose one and no removal costs a recording.
- **Removing a project or a recording is not the same as deleting one.** A removed recording moves to Default, and removing a project moves its recordings there; destroying recorded bytes is always a separate, explicit act.
- **The agent interface is the existing bounded automation surface**, extended with project operations that **organise but never destroy**: list, read, create, select, edit the description and default profile, move, and remove to Default. Deleting a recording for good and removing a project remain the person's, behind a confirmation, and are not offered as tools.
- **The recordings to migrate are those the app keeps at the moment of update.** Recordings already exported and let go by the previous version are not recoverable and are out of scope.
- **Nothing about recording, cutting, annotating, exporting or publishing changes.** Projects decide where recordings live and under which profile they start, and nothing about how a clip is made.

## Dependencies

- The app's existing **Configuration Profiles**: a project names one as its default, and a recording may use another; the profile's locking rule applies unchanged.
- The app's existing **clip keeping** (a recording surviving a reload) and its store, which projects make hold more than one recording.
- The app's existing **agent interface** and its bounded tool list, which projects extend.