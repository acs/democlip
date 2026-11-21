# Feature Specification: Export to YouTube

**Feature Branch**: `feat/youtube-export`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Add support for exporting to YouTube"

## Clarifications

### Session 2026-11-21

- Q: Does "export to YouTube" mean the clip leaves the app for the person's own YouTube channel, or that a YouTube-ready file is written for the person to upload by hand? → A: The clip **leaves the app for the person's own channel**; a YouTube-ready file is already covered by the existing MP4 download, so it is not the feature.
- Q: Who should be able to use it? → A: For now, **the app's owner and a few accounts the app is set up for**. Opening it to everyone — which waits on the video service's own review of the upload permission — is a later change, and nothing here waits on it.
- Q: Does a finished upload end the session, as an export or a post does today? → A: **Yes**, for consistency with an export and a post; the kept copy goes with it.

### Session 2026-11-22

Recorded while the real session was run. Both come from what the app's one scope allows, and
both changed the specification rather than the other way round.

- Q: Does the person see YouTube processing the video? → A: **No.** The app asks for the upload
  scope alone, and `videos.list` — which watching the processing needs — is not authorized by
  it. The upload **ends when YouTube has taken the video**: the address is offered at once, and
  the app says in words that YouTube finishes processing it just after. Asking a person to hand
  over read access to their channel to draw a progress line was rejected as too big an ask
  (FR-013, FR-016).
- Q: Does the app say which channel a clip will go to? → A: **When YouTube will name it.** The
  channel read is not authorized by the upload scope either, so the app says whose *account* is
  signed in and leaves the upload to decide; YouTube's own `youtubeSignupRequired` is what says
  an account has no channel (FR-007, FR-008).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a finished clip to my own channel (Priority: P1)

The clip is cut and annotated and the person is happy with it. From the same place a clip already leaves the app they pick **YouTube**, sign in to their own Google account once, and press Upload. The clip is written as a video and made a video on their own channel — the same picture and sound they watched, the cuts applied and the annotations drawn in. While it runs, the app says how far it has got, and when YouTube has finished processing, it offers the video to open.

**Why this priority**: This is the whole point — the clip reaching the person's own channel without a download and a manual upload in between. It is the smallest thing worth shipping.

**Independent Test**: From a clip in the review, pick YouTube in the Export menu, sign in, upload a short clip, and confirm a video exists on the channel holding the cuts and the annotations that were on the preview.

**Acceptance Scenarios**:

1. **Given** a clip and a person not yet signed in, **When** they pick YouTube, **Then** the app asks them to sign in to their Google account and nothing is uploaded until they do.
2. **Given** a signed-in person, **When** they press Upload, **Then** a video appears on their own channel holding the clip's cuts and annotations, at the same moments and places.
3. **Given** an upload in flight, **When** the person watches the app, **Then** they can see how far it has got, and when it is up the app says that YouTube finishes processing it just after — it does not claim to have watched that part.
4. **Given** an upload that has finished, **When** YouTube has processed the video, **Then** the app shows a link to the video.
5. **Given** a clip with sound, **When** it is uploaded, **Then** the video's sound is the clip's own sound, mixed as in the review.

---

### User Story 2 - Say what the video is, and who may see it (Priority: P2)

Before uploading, the person sets the video's title, its description and its visibility — private, unlisted or public — with **private** as where it starts, so nothing goes out wider than they meant. The title starts from something sensible when they have not typed one.

**Why this priority**: An upload with no say over its name or its audience is not one a person would use, but the upload itself is what has to work first.

**Independent Test**: Set a title, a description and each visibility in turn, upload, and confirm the video carries exactly those.

**Acceptance Scenarios**:

1. **Given** the YouTube option, **When** the dialog opens, **Then** the title, the description and the visibility are there to set, with **private** as the starting visibility.
2. **Given** a chosen visibility, **When** the clip is uploaded, **Then** the video's visibility is the one chosen and no other.
3. **Given** a title left empty, **When** the person uploads, **Then** the video is given a sensible default title rather than an empty one.
4. **Given** a chosen title and description, **When** the video is up, **Then** it carries exactly those.

---

### User Story 3 - Refuse what YouTube will not take (Priority: P3)

A clip too long, or too large, for the person's own account is refused **before** it is written, with what is wrong said plainly — exactly as a clip too long for the other video service is refused today. Nothing is uploaded, and the clip is untouched.

**Why this priority**: It protects the person from a failure that arrives after minutes of encoding; it constrains the first story rather than adding to it — but it is not optional.

**Independent Test**: Hand the app a clip over the account's length ceiling and ask to upload: it is refused before anything is encoded, with a reason, and the clip is unchanged.

**Acceptance Scenarios**:

1. **Given** a clip longer than the account may upload, **When** the person asks for YouTube, **Then** the app refuses before encoding and says the clip is too long, without uploading anything.
2. **Given** a clip within the limits, **When** the person asks for YouTube, **Then** the upload proceeds.
3. **Given** an upload that fails — no network, no permission, a sign-in that has expired — **Then** the app says so, the clip is untouched, and the person can try again or close.

---

### Edge Cases

- The person is not signed in: the dialog asks for the sign-in first, and nothing is uploaded.
- The account is not one the app is set up to upload for: the person is told plainly that it cannot upload yet, rather than left with a sign-in that fails.
- The sign-in has expired, or was signed out, between opening the dialog and pressing Upload: the upload is refused with a reason, and the clip is untouched.
- The person closes the dialog, or the tab, while an upload is in flight: the app must not leave the person believing a half-uploaded video is up; an interrupted upload is reported as failed, not as done.
- The person closes the dialog after the bytes are up but before YouTube has finished processing: the app says what state the video is in rather than counting it as done.
- The clip has no kept time at all: there is nothing to upload, and the app says so.
- The clip has no sound: it uploads as a silent video.
- The person's account has more than one channel: the clip goes to the channel the sign-in is for; choosing among an account's channels is not in this version.
- YouTube's own processing takes longer than the clip itself: the app keeps waiting and says so, rather than giving up early.
- The person's own daily allowance for uploads is used up, and the service refuses: the app says the service refused and the person can try again later rather than treating it as a bug.
- The person uploads the same clip twice: the app does not stop them; whether the second is a duplicate is the service's to decide.
- The person makes a change to the clip while an upload is in flight: the upload is of the clip as it was when Upload was pressed.
- The session ends because the upload finished: a second upload of the same clip is not offered.

## Requirements *(mandatory)*

### Functional Requirements

**Where it lives**

- **FR-001**: The person MUST be able to choose YouTube from the same place a clip already leaves the app — the Export menu — beside the existing file options and the other video service.
- **FR-002**: Adding YouTube MUST NOT change any existing option: the files, the editing export and the other video service MUST behave exactly as before.
- **FR-003**: YouTube MUST be optional and reached only when the person asks, so a person who never uses it uploads nothing and the app keeps its promise that nothing leaves the machine unless it is asked to.

**Signing in**

- **FR-004**: A person MUST sign in with their own Google account to upload, and MUST be able to do so once and be recognised afterwards, so a second clip does not mean a second sign-in.
- **FR-005**: The app MUST NOT upload anything before a person has signed in and asked for the upload.
- **FR-006**: A person MUST be able to sign out, after which nothing is uploaded until they sign in again.
- **FR-007**: The app MUST say whose account (or channel) a clip will go to before it goes.
- **FR-008**: An account the app is not set up to upload for MUST be told plainly that it cannot upload yet, and nothing MUST be uploaded for it. For this version the app is set up for a small set of accounts; making it available to everyone is a later change (see Assumptions).

**Making the video**

- **FR-009**: The app MUST write the kept clip — the cuts applied and joined, the annotations drawn into the picture, the sound mixed — as a video the service accepts, exactly as the review and the existing exports show it.
- **FR-010**: The recording MUST NOT be re-encoded beyond writing the export: an uploaded video's picture and sound MUST be the clip's own, as the file exports are.
- **FR-011**: The app MUST offer a title, a description and a visibility before the upload, and MUST start the visibility at **private**.
- **FR-012**: The app MUST give an empty title a sensible default rather than uploading an untitled video.
- **FR-013**: The app MUST report where the upload has got to — writing the video, and uploading it — and MUST offer the finished video as a link, saying in words that YouTube finishes processing it just after the upload rather than claiming a readiness the app cannot see.

**Limits, refusal, failure**

- **FR-014**: YouTube's own limits on what the account may upload (its length and its size) MUST be enforced by the app before any encoding begins, with a plain reason, exactly as the other service's limits are.
- **FR-015**: A refused or failed upload MUST leave the clip unchanged and MUST NOT end the session, so the person can try again or close.
- **FR-016**: An upload that is interrupted MUST be reported as failed rather than left looking finished, so the person is never told a video is up when it is not.

**Ending the session**

- **FR-017**: A finished upload MUST end the session as an export or a post does today, letting go of the kept copy of the clip.

### Key Entities *(include if feature involves data)*

- **YouTube account**: the person's own Google account, and the channel a clip goes to. Signed in once, remembered for the session and across clips as the other service's sign-in is. Only accounts the app is set up for may upload in this version.
- **Video upload**: the clip written as a video the service accepts, with the title, the description and the visibility the person chose. The unit the app hands to the service.
- **Upload job**: the service's own handling of an upload, watched until the video is ready or has failed. Carries a state and, while it runs, a measure of how far along it is.
- **Visibility**: who may see the finished video — private, unlisted or public. Chosen by the person, starting at private.
- **Limits**: the service's own ceiling on the length and the size of a video the account may upload. Enforced by the app before encoding, named in the refusal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person already signed in can go from choosing YouTube to a video on their channel in a single pass, without leaving the app, for a clip under two minutes.
- **SC-002**: In 100% of uploads, the video holds exactly the cuts and the annotations the person watched, at the same moments and places.
- **SC-003**: 100% of clips over the account's limits are refused before encoding, with a reason the person can act on, and nothing is uploaded.
- **SC-004**: Nothing is uploaded without a sign-in and an explicit press of Upload — 100% of the time — and 100% of accounts the app is not set up for are refused before anything is written.
- **SC-005**: A refused, failed or interrupted upload leaves the clip unchanged 100% of the time, and never reports a video as up when it is not.
- **SC-006**: The person is told where the upload has got to at every stage 100% of the time, and is given a link to the video when it is up.
- **SC-007**: Adding YouTube changes the outcome of no existing check: the files, the editing export, the other service's post and the recording are untouched (no regression).

## Assumptions

- **"Export to YouTube" means the clip leaves the app for the person's own YouTube channel**, confirmed by the person; the alternative reading — a YouTube-ready file to upload by hand — is already covered by the existing MP4 download.
- **For this version it is for the app's owner and a few accounts the app is set up for.** The sign-in and the upload work straight away for those accounts; making the feature available to every YouTube account waits on the video service's own review of the upload permission, and is a separate, later change that nothing here is blocked on.
- **The person has a channel** on the account they sign in with, or the service offers its own step to make one; the app does not make channels.
- **The app stays pure-browser and serverless.** The sign-in and the upload happen from the page; no server of ours holds a token or a key. The app owner's one-time registration with the service is a deployment concern, and each person's own account and allowance cover their own uploads. The app's "100% offline unless asked" promise is unchanged.
- **YouTube takes the same MP4 the app already writes for the other video service**, so no second encoding path is added beyond the container the service takes.
- **Visibility starts at private**, and the person may change it to unlisted or public before uploading; the app never makes anything public on its own.
- **The app enforces the service's own limits** — assumed to be 15 minutes and 256 GB for a default account, i.e. the shorter of the account's own ceiling and the service's — before encoding, as the other service's ten minutes and 300 MB are enforced today.
- **A finished upload ends the session**, exactly as an export or a post does; the kept copy goes with it.
- **The agent-facing surface gains YouTube as a destination of its existing publish operation**, so what the app offers a person and what it offers an agent stay one thing; no new operation is added, and the person's own sign-in is still required.
- **The video's thumbnail is the service's own** (a frame it picks), not one the app sets. Setting a thumbnail is out of scope for this version.
- **The clip goes to the channel the sign-in is for.** Choosing among an account's channels, scheduling, playlists, tags beyond the description, monetisation and captions are all out of scope for this version.
