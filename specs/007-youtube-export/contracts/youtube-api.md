# Contract — YouTube

What the app sends the destination and what it expects back. This is **the destination's
contract, not ours**: the endpoint, the headers, the fields and the limits are YouTube's, and
the plan's job is to keep the app's side of it in one adapter and the destination's own
numbers in the domain. Sources are named at the bottom.

## 1. The sign-in

The app is a browser with no server, so it uses Google's **token model** — an access token
issued to the page, never a code to be exchanged.

| Piece | Value |
|---|---|
| the client | `google.accounts.oauth2.initTokenClient({ client_id, scope, callback })`, from the hosted script `https://accounts.google.com/gsi/client` |
| the scope | `https://www.googleapis.com/auth/youtube.upload` — upload only; no read of anything else, which is why the channel read in §4 is best effort rather than relied upon |
| the gesture | `requestAccessToken()` is called from a press (**Sign in with Google**, or **Upload**), which the token model requires |
| the token | an access token in the page; **short-lived, with no refresh token** |
| the client ID | public, not a secret, and read at runtime from the app's own `youtube-client.json` |

**Guarantees**

- **no secret is held anywhere**, in the app or on the page: the client ID is public and the
  token is the person's own;
- **the token is never written down** — not to storage, not to the clip's kept copy — so
  nothing about the account outlives the page;
- the stored consent is Google's, per person per client ID, so a second clip in the same
  session does not mean a second consent (FR-004);
- Google's APIs support CORS by default, which is what allows the calls below from the page.

## 2. The upload

A **resumable session**, in three steps (`research.md` D3).

**Start the session**

```http
POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
Authorization: Bearer <token>
Content-Type: application/json; charset=UTF-8
X-Upload-Content-Length: <the file's bytes>
X-Upload-Content-Type: video/mp4

{ "snippet": { "title": …, "description": …, "categoryId": … },
  "status":  { "privacyStatus": "private" | "unlisted" | "public" } }
```

```http
HTTP/1.1 200 OK
Location: https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=…
```

**Send the bytes**, to the session URI, in chunks of a multiple of 256 KB (the last chunk may
be shorter):

```http
PUT <session URI>
Authorization: Bearer <token>
Content-Type: video/mp4
Content-Range: bytes <first>-<last>/<total>
```

| Answer | Meaning |
|---|---|
| `308 Resume Incomplete`, with `Range: bytes=0-<last>` | the chunk landed; the next chunk starts at `<last> + 1` |
| `201 Created`, body = the video resource | the upload is done; the resource carries the video's `id` |
| `404` | the session expired; a new session must be started |
| `4xx` with an error body | a permanent failure; the reason is the person's to read |

**Guarantees**

- **progress is reported per chunk**, which is what the dialog's *uploading* stage shows;
- **an interruption is resumable**, so a long clip on a poor line does not start again
  (FR-016) — and if it cannot continue, it is reported as **failed**, never as done;
- **the client-side ceiling is asked first**: the clip is checked against `VIDEO_MAX_SECONDS`
  before a frame is encoded (FR-014);
- the app sets **`privacyStatus` explicitly on every upload**, because an unset one means
  *public* to YouTube (`research.md` D6).

**Fallback**: if a browser turns out not to be allowed to read the `Location` header, the
single-request form (`uploadType=multipart`) needs no second URL and uploads the same bytes.
Whether the fallback is needed is settled by the real session (step 7), not by a guess.

## 3. The wait

```http
GET https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=<id>
```

| Field | The app reads it as |
|---|---|
| `status.uploadStatus` | `processed` — ready; `failed` or `rejected` — failed |
| `processingDetails.processingStatus` | `processing` — still going; `succeeded` — ready; `failed` or `terminated` — failed |
| `processingDetails.processingProgress` | `partsProcessed` against `partsTotal`, for the percentage |

**Guarantees**

- **the video's readiness, not the upload's completion, is what ends the wait** (D4, FR-016);
- the poll is bounded, with a budget that follows the clip's length, and giving up is said in
  a sentence rather than a hang.

## 4. Whose channel it is — when YouTube will say

```http
GET https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true
```

The first item's `id` and `snippet.title` are the channel a clip will go to, which the app
shows before anything is sent (FR-007).

**This read is best effort, and nothing may be decided from it.** `channels.list` is
authorized by the account-reading scopes (`youtube.readonly`, `youtube`) and **not** by the
`youtube.upload` scope this app asks for, so it can be refused — and an account with no
channel answers with nothing at all. Neither is evidence that the account cannot upload, so
neither may become a refusal: the app says the clip goes to the signed-in account's channel
and leaves the upload to be tried.

**The authority on whether the account may upload is `videos.insert` itself**, which answers
`youtubeSignupRequired` when there is no channel — so that is where the sentence comes from,
at the moment it is true.

## 5. The refusals the app names

| What came back | What the app says |
|---|---|
| no `youtube-client.json` served | the app is not set up to upload here; nothing is offered (FR-008) |
| the consent closed, or `access_denied` | the account was not allowed; the person is told why |
| `401` | the sign-in has expired; sign in again |
| `youtubeSignupRequired` (401) | the Google account has no YouTube channel yet; create one, then try the upload again |
| `accessNotConfigured` (403) | the YouTube Data API is not enabled for the app's Google project; enable it, then try again |
| `quotaExceeded` / `uploadLimitExceeded` | the allowance for uploads is used up; try again later |
| `invalidTitle` / `invalidDescription` | the title or the description is not one YouTube takes |
| `forbiddenPrivacySetting` | the visibility is not one YouTube takes |

**Guarantees**

- every refusal **leaves the clip unchanged and uploads nothing** (FR-015);
- a refusal is a **sentence a person can act on**, not a status code (D7).

## 6. The deployment facts

**These are not the app's rules; they are what a deploy must do once.**

| Fact | Why it matters |
|---|---|
| a Google Cloud project with the **YouTube Data API v3** enabled, and an OAuth **Web application** client | there is no upload without it |
| the **authorized JavaScript origins** include the deployed host and the dev server (`http://127.0.0.1:5173` and `:5174`) | a sign-in from an unlisted origin is refused |
| the consent screen's **test users** list the accounts the app is set up for | the clarified reach: the owner and a few accounts, for now (`spec.md` *Clarifications*); Google also requires its own review before uploads work for anyone else, and that review is a later change |
| the **client-ID file** (`web/public/youtube-client.json`) carries the client ID | a fork sets its own; the value is public |
| the **allowance is the project's**: 100 `videos.insert` calls a day, shared by everyone the app is set up for | why the reach is limited for now, and why a used-up allowance is said plainly |

## 7. What the app promises not to do

- **not to upload without a sign-in and a press** (FR-005);
- **not to write the token anywhere**, and never to send it to anything but Google;
- **not to re-encode the recording** beyond the export of the kept clip (FR-010);
- **not to choose a wider audience than the person did** — the visibility is theirs, and
  private is where it starts (FR-011).

---

**Sources** (read 2026-11-21): YouTube Data API — `videos.insert`
(`developers.google.com/youtube/v3/docs/videos/insert`), *Resumable uploads*
(`/youtube/v3/guides/using_resumable_upload_protocol`), *Quota costs*
(`/youtube/v3/determine_quota_cost`), *Upload videos longer than 15 minutes*
(`support.google.com/youtube/answer/71673`), and Google Identity Services — *token model*
(`developers.google.com/identity/oauth2/web/guides/use-token-model`).
