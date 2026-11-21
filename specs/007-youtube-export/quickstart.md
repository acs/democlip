# Quickstart — proving the YouTube destination works

How to check the change end to end, and what each check is worth. The rules are in
`data-model.md`; the destination's own contract is in `contracts/youtube-api.md`; the
sequence is in `plan.md`.

## Prerequisites

```bash
npm install
npx playwright install chromium     # the end-to-end suite's browser

# once, for the real session (step 7) only:
#   a Google Cloud project with the YouTube Data API v3 enabled,
#   an OAuth Web-application client whose authorized origins include the app,
#   the accounts listed as test users on its consent screen,
#   and its client ID written to web/public/youtube-client.json
```

The suite and the unit tests need **none** of that: they stand the Google script and the
upload in, and the checks below say so where it matters.

## 1. The rules — unit tests, in node

```bash
npx vitest run src/domain/youtube
npx vitest run src/application/publish-to-youtube.test.ts
npx vitest run src/infra/youtube.test.ts
```

**What must pass**

- **`Visibility`** refuses anything but private, unlisted and public, and starts at private;
- **`VideoDetails`** fills a blank title from the moment rather than refusing it, refuses a
  title past 100 characters and a description past 5000, and `record()` always carries an
  explicit `privacyStatus`;
- **`UploadableVideo`** refuses a blob that is not `video/mp4`, an empty one, and one over
  256 GB — and carries the 15-minute ceiling the use case asks;
- **the use case** refuses a clip over the ceiling **before** the encode is called (the fake's
  encode counts its calls), reports the three stages in order, answers the video's id and
  `watchUrl`, reports a failed upload without ending the session, and gives up on a poll that
  never comes ready with a sentence;
- **the adapter**, with an injected `fetch` and a fake token: the session start carries the
  right headers and the explicit `privacyStatus`, a chunk carries the right `Content-Range`,
  a `308` resumes from the `Range`, the status maps `processing`/`succeeded`/`failed`, and the
  errors become the sentences in `contracts/youtube-api.md` §5.

**What this does not prove**: anything about the page, the picture, the file or Google — those
are the suite's and the real session's, below.

## 2. What a person sees — the committed end-to-end suite

```bash
npm run test:e2e
# or the new area alone:
npx playwright test --config e2e/playwright.config.ts e2e/checks/youtube.spec.ts
```

The suite drives the real app in a headless Chromium. The Google script and the upload are
stood in by `page.route`, as the publishing check already stands its service in, so **nothing
touches the network**.

| Scenario | Assert |
|---|---|
| The way in | with a clip in the review, the Export menu shows **YouTube** beside the files and Bluesky, and every other choice still behaves as it did (FR-001, FR-002) |
| Not set up | with no client ID served, the dialog says the app is not set up to upload here, offers no sign-in, and **makes no request** (FR-008) |
| Signed out | the dialog opens on the sign-in view, with the **Sign in with Google** press (FR-004, FR-005) |
| Signed in, stood in | with the script returning a token and the channel stood in, the compose view shows whose channel it will go to, and the title, the description and the visibility — **private** at the start (FR-007, FR-011) |
| An empty title | uploading with the title left blank shows the app's own default title in the request the check reads back (FR-012) |
| Over the ceiling | a clip longer than 15 minutes is refused **before** any upload, with a reason, and the fake service received nothing (FR-014, SC-003) |
| The stages | the progress line reads *encoding*, then *uploading*, then *processing*, and the link to the video appears when it is ready (FR-013) |
| A refusal | an upload the stood-in service refuses shows the reason, leaves the clip untouched, and leaves the dialog usable (FR-015) |
| The session | after a finished upload the kept copy is let go — the app is back where an export leaves it (FR-017) |

**What this does not prove**: Google's consent, the real endpoint, and the video on a real
channel — all three are the user's session, below.

## 3. The agent's publish

```bash
npm --prefix mcp test
npx vitest run src/ui/agent/out.test.ts
```

**What must pass**: the tool list still has one `publish_clip`; its schema takes the
destination optional and defaults to Bluesky; an unknown destination is a result; and one
end-to-end check (step 6) shows that a YouTube publish with nobody signed in is refused with a
reason and sends nothing.

## 4. The real session — the user's

Three things no check can do, and all three are a person's:

- **a real Google consent.** Press **YouTube**, then **Sign in with Google**, and consent to
  the upload scope. This is the one place the clarified reach is at Google's mercy: an account
  not on the consent screen's test-user list is refused, and the app should say so.
- **a real upload to a real channel.** Upload a short clip and open the link. The suite stands
  the service in; only a real channel proves the real thing — and only a real upload shows the
  video at the cuts and annotations the review held.
- **the things that only the real thing can settle** (`research.md` D3, D7):
  - whether YouTube's own session start exposes its **`Location`** header to a browser. The
    suite's stand-in has to expose it, and `Range` with it, or the page cannot read either —
    which is the CORS rule rather than a choice of the app's. Google's endpoint is documented
    to support CORS and its own JavaScript client starts resumable sessions from a browser, so
    the app reads the header it needs and the plan keeps the `uploadType=multipart` fallback
    in reserve; a real upload is what confirms Google's own answer.
  - whether YouTube requires the video's **"made for kids"** declaration on insert. It is not
    sent: declaring it for a person is a claim about their content, and the refusal, if it
    comes, is reported plainly. Only a real insert answers this either way.

## 5. What cannot be checked here

- **Google's consent and a real upload** — a check cannot hold someone's account or consent to
  a scope; the suite proves everything *up to* the request and *from* the response.
- **the video's pixels on YouTube** — the checks assert the renderers ran and the file was
  written; what YouTube shows after transcoding is the real session's.
- **the destination's allowance and processing** — real quota and real transcoding are the
  destination's to give and to take; the checks use a stood-in service.
- **a channel YouTube will not name** — `channels.list` is not authorized by the upload
  scope, so the app may not be able to say which channel a clip will go to. It says whose
  *account* instead, and lets the upload be tried; whether the account may upload at all is
  the destination's own answer, and the app passes it on. The two are told apart in the
  console: *YouTube would not name the channel* is a refused read, *YouTube named no channel
  for this account* is a read that worked and found none.
- **a verified account's longer limit** — out of scope in this version (`research.md` D5), and
  not exercised.

## Reporting

In the pull request: the unit-test output, the suite's output, the words of the Verification
skill — which level each part got — and the honest gaps above, including the real session the
user ran and the two things it settled.
