# Feature Specification: DemoClip MCP

**Feature Branch**: `feat/democlip-mcp`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "I like the idea that the MCP starts a browser, the user can now capture the screen/window/tabs where this browser lives as it is in a normal use by users, and then, the user starts using OpenCode chat to edit the recording. And the user can see the edition by the AI in real time."

## Clarifications

### Session 2026-11-21

- Q: Does the agent also start and stop takes, or is the whole of the recording the person's? → A: The agent may drive the recording — turn the source toggles on and off, and start and stop takes — while **what** is shared stays the person's, chosen in the browser's own picker.
- Q: When one instruction makes several changes, is each taken back on its own, or is the whole instruction one undo? → A: Each change is taken back on its own; the app's one undo is unchanged, and an instruction that makes a dozen changes leaves a dozen to take back.
- Q: Is the agent's side part of this project and released with the app, or a project of its own? → A: Part of this project, in the same repository, released with the app and sharing its version.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record in the browser it opens, then edit it by talking (Priority: P1)

A person asks their agent to start a DemoClip session. A browser window opens on DemoClip. They record exactly as they always have — press Screen, pick the window, tab or screen in the browser's own picker, record their takes. Then, in the chat, they ask for the edit: "cut the pauses, put an arrow on the button at 0:12, colour it yellow". The agent makes those changes in the same window, and the person watches the picture and the timeline change as they happen. When it is wrong they say so, or press the app's own undo.

**Why this priority**: This is the whole point — the *choosing* stays with the person, in the picker, and everything after it is the agent's, the takes included. It is the smallest thing worth shipping: one browser, one clip, one chat.

**Independent Test**: Start the session, record a short clip (or hand it one already recorded), ask for a cut and an arrow, and see both in that window and in the file that comes out.

**Acceptance Scenarios**:

1. **Given** a person who has asked their agent to start a session, **When** the browser opens, **Then** it is a normal browser on DemoClip and the person can record with the browser's own picker, exactly as without the agent.
2. **Given** a clip recorded in that browser, **When** the person asks for a cut and an annotation in the chat, **Then** the clip in that window is cut and annotated.
3. **Given** an agent making a change, **When** the change lands, **Then** the person sees it in that window without asking for a refresh.
4. **Given** a change the agent made, **When** the person presses the app's one undo, **Then** that change is taken back, exactly as if they had made it.
5. **Given** a clip the agent has edited, **When** the person asks for an export, **Then** the file holds what they saw.

---

### User Story 2 - The agent finishes the job: a file, or a post (Priority: P2)

The edit is done. The person asks for an MP4 to send to a colleague, or a post to their own account. The file arrives somewhere they can find it, or the post goes out — and in both cases it is what they were watching.

**Why this priority**: An edit that cannot leave the browser is half a feature; the export and the post are why the clip exists. It is below the first story because editing is what has to work first.

**Independent Test**: After an agent-made edit, ask for an exported file and confirm it holds the edit; ask for a post and confirm it is published from the person's own account.

**Acceptance Scenarios**:

1. **Given** a clip the agent has edited, **When** the person asks for an export, **Then** a file is written where the person can reach it, holding the cut and the annotations they saw.
2. **Given** a person signed in to publish, **When** they ask for a post, **Then** it is published from their account with the clip's edits.
3. **Given** a person not signed in, **When** a post is asked for, **Then** nothing is published and the agent says what is missing.
4. **Given** a published post, **When** the person looks at it, **Then** it is the clip they watched, at the same moments and places.

---

### User Story 3 - The person stays in control (Priority: P3)

The person can see everything the agent does and undo any of it; the agent can drive the recording but never choose what is shared, and it can never publish without them. Nothing about the app's promises changes because an agent is driving it.

**Why this priority**: An agent with a hand on the clip is an agent with a hand on the person's screen and their account. It is last because it constrains the first two rather than adding to them — but it is not optional.

**Independent Test**: Ask the agent to choose what is shared, and to publish without a sign-in: the first is the person's to do in the picker, the second is refused with a reason. Undo every change an agent made, and the clip is back where it started.

**Acceptance Scenarios**:

1. **Given** a session, **When** the agent turns the screen source on, **Then** the browser's picker appears for the person to choose what is shared, and the agent cannot choose it.
2. **Given** a person not signed in, **When** the agent is asked to publish, **Then** nothing leaves the machine.
3. **Given** an agent's change, **When** the person undoes it, **Then** the clip is as it was before that change.
4. **Given** an agent driving the clip, **When** it asks for something the app does not allow — a kind it does not know, a value a property refuses — **Then** the change is refused and the agent is told why.
5. **Given** a clip the agent edited, **When** it is exported, **Then** the recording itself was never re-encoded — an agent's edit is the same kind of change a person's is.

---

### Edge Cases

- No browser can be opened — none installed, or no display — the person is told plainly, and nothing half-starts.
- The person records nothing and asks for an edit: there is no clip, and the agent says so.
- The person closes the window mid-session: the clip is still the app's, kept as it always is, and the agent either reopens onto it or says it is gone.
- The person and the agent act at once — the person moves the playhead while the agent cuts. One clip, two hands: the last change wins, and both can see what happened.
- The person is looking at another window and does not see a change; nothing is lost, and the timeline still shows it.
- A long clip, or an export that takes minutes: the person is told it is running rather than left guessing.
- The agent asks for an edit while the clip is playing.
- Two sessions, or two agents, at once: one clip each, and neither drives the other's.
- The agent's edit is made, then the person makes their own, then the agent undoes: the app's one undo takes back the last change of any kind, whoever made it.
- An instruction makes a dozen changes and the person wants it gone: each is one press of the app's undo, and the agent can be asked to take its own changes back.
- The version of the agent's side and the version of the app disagree about how a clip is written down: the clip is not half-read.
- The person's machine sleeps, or the browser is reloaded, in the middle of an edit.

## Requirements *(mandatory)*

### Functional Requirements

**A session, and the browser it opens**

- **FR-001**: A person MUST be able to start a session from their agent, which opens a browser showing DemoClip.
- **FR-002**: That browser MUST be a normal browser for the person's purposes: the app's own capture works in it, with the browser's own picker, and a person who knows DemoClip needs to learn nothing new.
- **FR-003**: The person MUST be able to record in it exactly as they would without an agent.
- **FR-004**: The agent MUST be able to turn a source on and off and to start and stop takes, and MUST NOT be able to choose **what** is shared: the screen, window or tab is picked by the person in the browser's own picker, and no requirement here changes that.

**What the agent can do**

- **FR-005**: The agent MUST be able to make the changes the app itself offers — record takes and drive the sources, cut a stretch, add and change annotations of every kind, set an annotation's properties, undo, and move the playhead.
- **FR-006**: The agent MUST be able to export the clip and to publish it.
- **FR-007**: Every change the agent makes MUST be an ordinary change to the clip: announced to the app's views, taken back by the one undo, and kept with the clip — with no second path and no second undo.
- **FR-008**: A change the agent asks for that the app refuses MUST be refused with a reason the agent can read, and MUST leave the clip unchanged.
- **FR-009**: The agent MUST NOT be able to re-encode the recording: an edit made by an agent is the same kind of change a person's is.
- **FR-010**: The agent MUST be able to see what the clip is — its length, its takes, its cuts, its annotations and their properties — so it can decide what to do next.

**What the person sees and controls**

- **FR-011**: Every change the agent makes MUST appear in the person's window as it happens, without a reload.
- **FR-012**: The person MUST be able to take back any change the agent made, with the app's own undo. One instruction that makes several changes leaves several changes to take back, one at a time — there is no group, and the app's undo is unchanged.
- **FR-013**: Nothing MUST leave the machine unless a person has asked for an export or a post, or signed in to publish.
- **FR-014**: The agent MUST NOT publish without the person's own sign-in, and MUST say what it published when it does.

**Being driven at all**

- **FR-015**: The agent's reach MUST be the app's own operations and nothing more: no arbitrary scripting of the page, no reaching outside the clip — except `import_take`, which names a file for the app's own Import, the one path any tool takes (see the tools contract, *Guarantees*).
- **FR-016**: The operations offered to an agent MUST be named in the app's own vocabulary, so a person reading the chat recognises what was done.
- **FR-017**: Adding an operation for something the app already does MUST NOT change how the app behaves for a person.
- **FR-018**: The agent's side MUST be part of this project and released with the app, sharing its version, so that how a clip is written down cannot drift between them; a clip that does not match MUST be refused rather than half-read.

### Key Entities *(include if feature involves data)*

- **Agent session**: the browser the server opened, the clip in it, and the person watching — the whole of one sitting.
- **Agent harness**: the chat the person is talking to, which starts the server and offers its operations to the agent.
- **Operation**: one thing the agent may do — cut, annotate, change a property, undo, seek, export, publish — named in the app's vocabulary.
- **Automation surface**: what the app offers to be driven, deliberately bounded to its own operations.
- **Clip**: unchanged — the takes, the cuts and the annotations, with the same rules about all three.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can record a clip in the browser the agent opened and, by talking, get it cut and annotated in under 2 minutes from asking for the first edit.
- **SC-002**: A change the agent makes is visible in the person's window in under a second, 100% of the time.
- **SC-003**: In 100% of exports and posts, the clip holds exactly the cuts and annotations the person watched, at the same moments and places.
- **SC-004**: A change an agent made can be taken back by the person with the app's one undo, in one action, 100% of the time.
- **SC-005**: The agent chooses what is shared zero times — that is the person's, in the picker — and publishes without the person's sign-in zero times.
- **SC-006**: A refused operation leaves the clip unchanged 100% of the time, and the agent is told why every time.
- **SC-007**: Adding an operation for something the app already does changes the outcome of no existing check (no regression).

## Assumptions

- **The server is local and the harness starts it.** The person's agent (OpenCode and others like it) starts the server on their machine and offers its operations to the model; nothing is hosted, and the app's promise that nothing leaves the machine is unchanged.
- **The browser is one the server opens**, headful, on a profile of its own — so the person's everyday browser is untouched, and the publishing sign-in is one they do in that window.
- **The recording is the person's to aim.** The agent may turn a source on and press Record, but what is actually shared is chosen by the person in the picker; the agent's editing begins at the takes.
- **The automation surface is deliberate and bounded** — the app's own operations, offered under a name, not a general remote control of the page. It exists only for a session that was asked for.
- **One clip, one session at a time** in this version; several agents, or several clips, are a later change.
- **The published post is the person's own account**, signed in in that window; the app's existing publishing flow is reused rather than reimplemented.
- **The person and the agent share one clip**, so they must not both be editing at the same instant; the app's last-change-wins and its one undo are the rules, not a new lock.
- **The agent's side lives in this repository and is released with the app**, sharing one version, because a clip's written shape is a contract between them and two release schedules would let it drift.