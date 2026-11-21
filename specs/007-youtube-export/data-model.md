# Phase 1 — Data Model

The entities this feature adds, their shapes, the rules they enforce, and how they move.
Field names are the ones the code will use; the words are the ones `GLOSSARY.md` gains first
(step 1 of the plan). The destination's own contract is in `contracts/youtube-api.md`.

## New entity — `Visibility`, who may see the video

`src/domain/youtube/Visibility.ts` — a value object, the smallest thing here.

| Piece | Meaning |
|---|---|
| the word | `private`, `unlisted` or `public` — the three the destination accepts and no others |
| the default | **private** (spec FR-011) |

**Rules**

- anything that is not one of the three words is refused, so the app cannot send the
  destination a value it will reject with `forbiddenPrivacySetting`;
- the app **always** sends the value, because an unset `privacyStatus` means *public* to
  YouTube (`research.md` D6) — sending nothing would publish by omission.

## New entity — `VideoDetails`, what the video says

`src/domain/youtube/VideoDetails.ts` — a class, because it decides something.

| Piece | Meaning | Limit |
|---|---|---|
| `title` | the video's name | non-empty; at most **100** characters |
| `description` | what it is about | at most **5000** characters |
| `visibility` | a `Visibility` | one of the three words |
| `categoryId` | the category the app sends | the app's own default (People & Blogs) |

```ts
class VideoDetails {
  static of(
    input: { title?: string; description?: string; visibility?: Visibility },
    when: Date,
  ): VideoDetails;

  /** The video resource's writable parts, as the destination wants them. */
  record(): {
    snippet: { title: string; description: string; categoryId: string };
    status: { privacyStatus: 'private' | 'unlisted' | 'public' };
  };
}

/** The address of an uploaded video, from the id YouTube gave it. */
function watchUrl(videoId: string): string;   // https://youtu.be/<id>
```

**Rules**

- **an empty title is not refused, it is defaulted** (FR-012): `of` fills a blank title from
  `when` — the app's own name and the moment — so a person who types nothing still gets a
  titled video, and the class is where "never an untitled video" is true;
- a title past the destination's 100 characters, or a description past 5000, is **refused**
  rather than truncated, because silently cutting a person's words is its own surprise;
- `record()` is the only place the metadata becomes the destination's shape, so the
  `privacyStatus` that must be explicit (D6) is explicit in one place;
- `categoryId` is the app's, not the person's, in this version (spec *Assumptions*).

## New entity — `UploadableVideo`, the file YouTube takes

`src/domain/youtube/UploadableVideo.ts` — the Bluesky path's `PublishableVideo`, again.

| Piece | Meaning |
|---|---|
| `blob` | the MP4 bytes — an `video/mp4` blob, never empty |
| `name` | the name it travels under |

```ts
const VIDEO_MIME = 'video/mp4';
const VIDEO_MAX_BYTES = 256 * 1000 ** 3;   // YouTube's own ceiling
const VIDEO_MAX_SECONDS = 15 * 60;         // the app's ceiling, the default account's

class UploadableVideo {
  static of(blob: Blob, name: string): UploadableVideo;   // throws on the wrong type, or empty, or over the ceiling
}
```

**Rules**

- a blob of another type cannot be built, exactly as a WebM cannot become a
  `PublishableVideo` — the type is the rule, not a check a caller remembers;
- `VIDEO_MAX_SECONDS` is the **destination's** fact (`research.md` D5) stored with the video,
  and the use case asks it before planning anything, so an over-long clip is refused before a
  frame is encoded (FR-014, SC-003);
- the byte ceiling is a sanity bound here, not a budget: at the app's own 24 Mbps ceiling a
  15-minute file is about 2.7 GB, so the encoder is given **no** `maxBytes` (D5).

## New entity — `YouTubeService`, the port the use case owns

`src/application/youtube-service.ts` — everything that needs a token or the network, named
without the browser, so the sequencing can be proved in node.

```ts
type UploadProgress = (fraction: number) => void;   // 0..1 of the video's bytes

interface UploadedVideo {
  readonly id: string;                 // the id YouTube gave it
}

interface YouTubeService {
  /** Send the video, reporting how much of it has gone. */
  uploadVideo(video: UploadableVideo, details: VideoDetails, progress: UploadProgress): Promise<UploadedVideo>;
}
```

**Rules**

- **one call, because the destination allows one.** The app asks for the upload scope and
  nothing that reads the account, so `videos.insert` is the whole of an upload. Watching the
  video be processed is `videos.list`, which that scope does not authorize (D4);
- the port holds **what the use case sequences and nothing else** — a sign-in, a channel name
  and a token are the view's and the adapter's, not the use case's, exactly as Bluesky's is;
- `uploadVideo` reporting a fraction is what makes the second stage of the progress line
  possible; the chunking that produces it is the adapter's (D3).

## New entity — `YouTubePublication`, what a publish comes to

`src/application/publish-to-youtube.ts` — the use case, the shape of `publishToBluesky`.

```ts
type YouTubeStage = 'encoding' | 'uploading';

interface YouTubePublicationProgress {
  readonly stage: YouTubeStage;
  readonly progress?: number;          // 0..100 within a stage, when the service says
}

interface YouTubePublicationSettings {
  readonly export: ExportSettings;     // what of the clip to write — the same settings the export takes
  readonly details: VideoDetails;      // the title, the description, the visibility
}

interface YouTubePublication {
  readonly id: string;                 // the video's id
  readonly url: string;                // watchUrl(id)
}

function publishToYouTube(
  clip: Clip,
  settings: YouTubePublicationSettings,
  deps: { service: YouTubeService; encode: (plan: ExportPlan) => Promise<Blob>; now?; onProgress? },
): Promise<YouTubePublication>;
```

**Rules**

- **the ceiling is asked before anything is encoded**: `planExport` first, then a length check
  against `VIDEO_MAX_SECONDS`, then the encode — so an over-long clip costs nothing but the
  plan (FR-014, SC-003);
- the upload **ends when the destination has taken the video** — the id, and therefore the
  address, is what the insert answers with. Nothing is read back: `videos.list` is not
  authorized by the one scope the app asks for, so no readiness is claimed (D4, FR-013);
- the destination's own answer is the one that counts, for whether the account may upload
  (`youtubeSignupRequired`) and for everything else it refuses;
- the sequencing — not the browser work — runs here, so a node test with a fake service can
  hold every rule above.

## New entity — the YouTube account and the token

`src/infra/youtube.ts` — the browser boundary: the sign-in, the upload, the poll, and the one
piece of state that outlives a clip.

| Piece | Meaning | Lifetime |
|---|---|---|
| the access token | Google's, held in the page and **never written down** (no refresh token in the token model, D2) | the page, or until it expires |
| the channel | which channel a clip will go to, read from the account and shown before it goes (FR-007) | the token's |
| the client registration | the app's public client ID, read from `web/public/youtube-client.json` | the build's |

**Rules**

- the token is **memory only** — the app's "nothing leaves the machine" promise kept literally,
  and the reason no `keep.persist()` trip is needed as the Bluesky sign-in needs one;
- `configured()` is false when no client ID was served, and the app says so rather than
  offering a sign-in that cannot work (FR-008, D7);
- a sign-out forgets the token; nothing else is kept.

## New entity — the dialog and its states

`src/ui/publishing/youtube-dialog.ts` — the DOM and the fact of being open; it decides
nothing about YouTube.

| State | What is shown |
|---|---|
| not configured | the app says the feature is not set up here; no sign-in is offered |
| signed out | a **Sign in with Google** press (the gesture the token model needs, D2) |
| signed in | whose channel it will go to, the title, the description, the visibility, and **Upload** |
| running | the stage and its percentage; every control quiet |
| done | the video's address as a link; the controls stay quiet |
| refused / failed | the reason, plainly, with the dialog still usable |

**Rules**

- the dialog owns the DOM and the openness, as the Bluesky dialog does; what a publish *is*
  is the use case's;
- the visibility control starts on **private** and the title starts empty, with the class
  filling the default (FR-011, FR-012);
- a refusal leaves the controls live — try again or close — and only a finished upload leaves
  them spent.

## Changed entity — where a clip leaves the app

`src/ui/exporting/export-menu.ts` — one more choice beside the files, the editing export and
Bluesky (FR-001).

**Rules**

- adding the entry changes no other choice's behaviour (FR-002);
- the entry is the app's own call, and nothing is requested of the network by the menu merely
  being drawn (FR-003).

## Changed entity — the automation surface and the MCP tool

`src/ui/agent/{surface.ts,out.ts}` and `mcp/src/tools.ts` — the publish operation gains a
destination (D8).

```ts
// the surface
readonly out: {
  export(target: string, annotations?: string): Promise<Result<{ filename: string }>>;
  publish(options: {
    destination?: 'bluesky' | 'youtube';   // bluesky when not said, as today
    text?: string; alt?: string;           // the Bluesky post
    title?: string; visibility?: string;   // the YouTube video
  }): Promise<Result<{ url: string }>>;
};
```

| Tool | Takes | Answers |
|---|---|---|
| `publish_clip` | `destination` (`bluesky` \| `youtube`, optional), `text`, `alt` for Bluesky; `title`, `visibility` for YouTube | the post's or the video's address |

**Rules**

- **no new tool and no new operation** — a destination is what the app already offers a
  person, and the surface and the tool list must not drift apart (D8);
- a destination's sign-in is still the person's: with nobody signed in, the call answers
  `{ ok: false, reason }` and nothing leaves the page (spec FR-005, FR-008);
- omitting `destination` behaves exactly as today, so an agent written against the old tool
  keeps working (FR-002).

## State transitions

| From | Event | Effect |
|---|---|---|
| the review | the person picks **YouTube** in the Export menu | the dialog opens; nothing is sent (FR-003) |
| the dialog, not configured | it opens | the app says it is not set up here; no sign-in is offered (FR-008) |
| the dialog, signed out | the person presses **Sign in with Google** | Google's consent opens; on consent the channel is read and the compose view shows (FR-004, FR-007) |
| the dialog, signed in | the person presses **Upload** | the clip is planned; over the ceiling it is refused here, before any encoding (FR-014) |
| a clip within the ceiling | the encode runs | stage *encoding*; the person watches the percentage (FR-013) |
| the MP4 written | it is handed to the destination | stage *uploading*; the bytes go in chunks, resumably (D3) |
| the bytes up, a video id back | the upload finishes | the address is shown as a link, with a word that YouTube finishes processing it just after; the kept copy is let go — the session ends (FR-013, FR-017) |
| an upload that failed or was interrupted | — | the reason is shown; the clip is unchanged and the session is not ended (FR-015) |
| an upload in flight | the person closes the dialog or the tab | nothing is reported as done; the destination's own session expires on its own (FR-016) |
