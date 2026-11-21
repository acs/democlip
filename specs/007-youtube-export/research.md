# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Grounded in the code as it stands (the four layers, the Bluesky path as the
pattern) and in the destination's own documented contract, which
`contracts/youtube-api.md` states in full.

## The destination's facts this plan rests on

From Google's own documentation, and nowhere else — a limit the app puts in the domain has
to be the destination's real one:

- **The upload** is `POST https://www.googleapis.com/upload/youtube/v3/videos`, media
  `video/*` or `application/octet-stream`, **at most 256 GB**, authorized by the
  `https://www.googleapis.com/auth/youtube.upload` scope (YouTube Data API, `videos.insert`).
- **The allowance** is **100 `videos.insert` calls a day** per Google Cloud project in its
  own bucket, each call costing 1; everything else shares 10,000 units a day, and the
  counters reset at midnight Pacific. The allowance belongs to the **client**, not the
  person, so it is shared by everyone the app is set up for.
- **The length** is **15 minutes by default**; a verified Google Account may upload longer,
  up to the 12-hour / 256 GB ceiling.
- **The sign-in** is the **token model**: `google.accounts.oauth2.initTokenClient({ client_id,
  scope, callback })` and `requestAccessToken()` from a **user gesture**. It returns an
  access token in the page — **no refresh token, and the token is short-lived** — and Google's
  APIs "support CORS by default", so the token can be used with `fetch`. Only the dialog
  (popup) UX is supported.
- **The metadata** a `videos.insert` may set: `snippet.title` (≤ 100 characters),
  `snippet.description` (≤ 5000), `snippet.tags`, `snippet.categoryId`, and
  `status.privacyStatus` — which, **if left unset, defaults to `public`** — plus
  `status.selfDeclaredMadeForKids` and a few others.
- **The errors worth naming**: `invalidTitle` (an empty or malformed title),
  `invalidDescription`, `forbiddenPrivacySetting`, and `uploadLimitExceeded` (the account has
  uploaded as many videos as it may).

## D1 — A second destination, and the same shape as the first

**Decision**: YouTube is a second destination built exactly as Bluesky's is: pure rules in
`src/domain/youtube/`, a use case in `src/application/` with the network behind a port it
owns (`YouTubeService`), the browser and the token in one adapter (`src/infra/youtube.ts`),
and the view in `src/ui/publishing/`.

**Rationale**: the Domain model skill's shape, twice. The rules that are worth testing — what
a title may be, what a visibility is, what is too long — are pure and go in the domain; the
sequencing that is worth testing — refuse before encoding, then encode, then send, then
wait — runs in node against a fake; and everything that needs the network, a token or the
browser is behind one port, so the use case can be proved without any of them. It also keeps
the two destinations legible side by side: a reader who knows the Bluesky path knows this
one.

**Alternatives considered**: teaching the existing Bluesky use case and dialog a second
destination — rejected, the two share almost nothing (one uploads an MP4 and writes a post,
the other opens a resumable session and sets a video's details) and the join would be a
conditional in every step; a `file` export with a YouTube preset — rejected by the spec's
clarified scope (the clip leaves the app for the person's channel), and the app already
writes MP4.

## D2 — The sign-in is Google's token model, and it is a popup, not a trip

**Decision**: the person's Google sign-in uses **Google Identity Services' token model** —
`initTokenClient` + `requestAccessToken()` — from a press in the dialog, and the access token
lives in the page for the session. Nothing is written down, and there is **no redirect**: the
Bluesky sign-in's `keep.persist()` trip does not happen here.

**Rationale**: the app is a browser with no server, so a flow that ends in an authorization
code to be exchanged would need a token endpoint; the token model is the browser-only way in,
and its stated limits are exactly this app's: no refresh token is stored, the token is
short-lived, and the only UX is the dialog. A redirect would also mean a trip away, which is
why the Bluesky path persists the clip before leaving — and it is why this path does not need
to. The token never being written down is the app's "nothing leaves the machine" promise kept
literally.

**Alternatives considered**: an authorization-code flow with PKCE and a redirect — rejected,
it needs somewhere to exchange the code, which is a server this app does not have; the
`@react-oauth/google` (or similar) wrapper — rejected, it is a dependency for what a hosted
script already does, and the app's rule is no new runtime dependency; an API key — rejected,
a key authorizes an application, not a person's channel, and cannot upload to it.

## D3 — The upload is a resumable session, sent in chunks

**Decision**: the upload starts a **resumable session** (a `POST` to the upload endpoint whose
`Location` header is the session URI) and sends the video's bytes to that URI in **chunks**,
each chunk's progress reported, resuming from the `Range` the service answers when a chunk is
interrupted.

**Rationale**: the destination's own guide says resumable uploads exist for exactly this case
(large files, and a connection that may break), and the chunk loop is what makes a progress
line possible at all (SC-006, FR-013) — a single-shot request reports nothing until it is done.
It also makes FR-016 honest: an interrupted upload can be *retried from where it stopped*, or
reported as failed, rather than leaving the person guessing. The chunk size is the required
multiple of 256 KB.

**What only the real session can settle**: reading the session URI from the `Location`
response header is a **CORS** question — a browser may not be allowed to read it. Google's
upload endpoint is documented to support CORS and its own JavaScript client starts resumable
sessions from a browser, so the choice stands; but if the header turns out not to be readable,
the fallback is the single-request `uploadType=multipart` form, which needs no second URL.
That is named here so step 7 tests it deliberately rather than discovering it as a bug.

**Alternatives considered**: one `multipart` request for the whole file — rejected as the
primary, it reports no progress and cannot resume; but kept as the fallback above. Sending
the remainder in one `PUT` after a session is started — rejected, it loses the progress a long
clip needs.

## D4 — There is no wait: the upload ends when YouTube has taken the video

**Decision**: once the bytes are up and `videos.insert` has answered with the video's id, the
app is **done**. It does not poll the video's status; it says in words that YouTube finishes
processing the video afterwards.

**What the real session settled.** This was a watcher, and only a real upload could have found
the fault in it. Watching a video being processed is `videos.list`, which is authorized by the
account-reading scopes (`youtube.readonly`, `youtube`) and **not** by the `youtube.upload`
scope the app asks for. The first real upload went up — the session started, the chunks landed,
the video exists — and then the app's own status read was refused with *"Request had
insufficient authentication scopes"*, so a **successful upload was reported as a failure**,
which is the worst thing it could have done. The same fault, found a step earlier, was behind
the channel read (D7's neighbour): a read the scope does not authorize, turned into a refusal.

**Rationale for what replaced it.** The alternative — asking for `youtube.readonly` — means
asking a person to hand over read access to their whole channel in order to draw a progress
line: a much bigger ask than the feature is worth, and it would make the app's "upload only, no
read of anything else" untrue. So the honest shape is the smaller one: **one call, because the
destination allows one.** The video *is* up when the app says so, which is what the person
wants to know; what YouTube is still doing with it is said, not watched. The destination is
still the authority on whether an account may upload, because that answer comes from
`videos.insert` itself.

**Alternatives considered**: `youtube.readonly` for a progress line — rejected as too big an
ask; an unauthenticated status read — impossible, the endpoint requires a token; calling the
upload "processing" without watching — rejected, it is the same claim without the evidence;
treating a refused status read as done and keeping the call — rejected, a request that cannot
succeed with this scope and a lie in the code.

## D5 — The length is the limit that binds; the size is not

**Decision**: the app enforces **15 minutes** (the destination's ceiling for a default
account) as a refusal **before any encoding**, and checks the 256 GB ceiling as a sanity
bound only. It does **not** hand the encoder a byte budget, as the Bluesky path does.

**Rationale**: this app's own bitrate ceiling is 24 Mbps (`export-target.ts`), so the longest
clip it will make is about 2.7 GB — two orders of magnitude under 256 GB. A byte budget would
be a limit that can never bind, and the honest simple thing is to say so rather than carry
the machinery. The length, by contrast, binds every day: a default account may not upload past
15 minutes, and the app should say so in a second rather than after encoding a clip the
destination will refuse (SC-003). The Bluesky path keeps its byte budget because there the
ceiling really does bind (300 MB).

**Alternatives considered**: reading the account's verification and raising the ceiling —
rejected for this version, there is no clean signal to read and the spec's clarified ceiling is
the default account's; a byte budget for uniformity with Bluesky — rejected as machinery that
cannot do anything.

## D6 — What the video says: title, description, visibility, and private set explicitly

**Decision**: the dialog offers a **title** (defaulted when empty, capped at the destination's
100 characters), a **description** (capped at 5000), and a **visibility** — private, unlisted
or public — **starting at private**; the app sends a **category** of its own (People & Blogs)
and **always sends `privacyStatus` explicitly**.

**Rationale**: the destination's own default for an unset `privacyStatus` is **public**, so
sending nothing would be the app publishing a person's clip to the world by omission — the one
thing FR-011 and the app's promise forbid. Sending it explicitly is what makes "private at the
start" true rather than hoped for. The title and description limits are the destination's own,
so they belong in the domain class that holds them, where the unit test can hold them.

**Alternatives considered**: leaving the visibility unset to follow the channel's own default
— rejected, the app cannot read that default and must not guess in the direction of *more*
visible; a tag or category field for the person — deferred, the spec keeps tags and
categories out of this version, and the app sends a sensible category so the person does not
have to.

## D7 — A refusal is a plain reason, and nothing is uploaded

**Decision**: three refusals are said plainly, each before anything is sent: the app is **not
configured** (the client-ID file is missing, so the menu entry says so), **Google refused the
account** (a consent error, or a project whose test-user list does not include them), and the
**allowance is used up** (`quotaExceeded` / `uploadLimitExceeded`). Each leaves the clip
unchanged and uploads nothing.

**Rationale**: FR-008 and the clarified reach — the feature is for the app's owner and a few
accounts for now, so a person outside that set must be told why rather than left with a
sign-in that fails silently. It is the same posture the app already takes when a share comes
back silent: the browser that owns the limit says so, and the app passes it on.

**Alternatives considered**: hiding the menu entry unless a token exists — rejected, a person
would never discover the feature or how to be let in; a generic "the upload failed" — rejected,
the three causes need three different actions from the person.

## D8 — The agent's publish gains a destination

**Decision**: the automation surface's `out.publish` gains a `destination` (`bluesky` or
`youtube`) and the YouTube details; the MCP tool `publish_clip` gains the same three
arguments. No new operation and no new tool is added, and a destination's sign-in is still the
person's — with nobody signed in, the call is refused with a reason and nothing leaves the
page.

**Rationale**: spec FR-002 and the automation surface's own rule — what the app offers a
person and what it offers an agent must not drift apart, and a destination is not a second
operation. It keeps the tool list's promise (one tool per operation) intact, and a person
reading the chat still recognises "publish" as what they would press.

**Alternatives considered**: a new tool `publish_to_youtube` — rejected, it would be the same
operation twice and would make the tool list lie about what the app does; leaving the agent
out — rejected, the surface and the app would then disagree, which is the drift the surface
exists to prevent.

## D9 — What is proved how

**Decision**:

- the domain rules — the title, the description, the visibility, the length and size bounds,
  the video's address — by **unit tests in node** beside each class;
- the use case's sequencing — the ceiling refused before any encoding, each stage, a failed
  upload, a poll that gives up — by a **unit test in node** with a fake service;
- the adapter's mapping — the session start, a chunk, a resume, the errors — by a
  **unit test with an injected `fetch`** and a fake token, as `infra/bluesky.test.ts` does;
- the menu entry, the dialog's states, the progress lines and the refusals — by a
  **committed check in `e2e/`**, with the Google script and the upload stood in by `page.route`
  (nothing touches the network, as the publishing check already does);
- a **real Google consent** and a **real upload to a real channel** — by a **real session, by
  the user**, because no check can hold someone's Google account or consent to a scope — and it
  is that session, too, that settles D3's CORS question and whether the destination requires a
  "made for kids" declaration.

**Rationale**: the Verification skill's three levels. The menu and the dialog are drawn, so
they need a browser; the rules and the sequencing are not, so they need node. The real session
is the same row the real publish already occupies, and it is named rather than hidden.

**Alternatives considered**: a temporary `verify-*.html` harness — retired by the project in
favour of the committed suite; driving a real upload from a check — impossible without a
person's account and consent.
