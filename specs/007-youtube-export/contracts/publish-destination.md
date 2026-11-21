# Contract — the publish operation, with a destination

The app and the agent must offer the same thing, so adding YouTube is **one operation gaining
a destination**, not a second operation (`research.md` D8). This records what changed on both
sides of the seam: the automation surface the app publishes, and the tool the MCP server
offers. The rest of the surface is unchanged and is documented in
`specs/006-democlip-mcp/contracts/agent-surface.md`.

## 1. The operation

**Before** — one destination, implied:

```ts
readonly out: {
  publish(options: { text?: string; alt?: string }): Promise<Result<{ url: string }>>;
};
```

**After** — the destination named, defaulting to the one there was:

```ts
readonly out: {
  publish(options: {
    /** Where the clip goes. Bluesky when it is not said, as it was before. */
    destination?: 'bluesky' | 'youtube';
    /** Bluesky: the post's words, and what the video shows. */
    text?: string;
    alt?: string;
    /** YouTube: the video's title, and who may see it. */
    title?: string;
    visibility?: 'private' | 'unlisted' | 'public';
  }): Promise<Result<{ url: string }>>;
};
```

**Guarantees**

- **one operation, one tool.** A destination is a thing the app already offers a person; a
  second tool would be the same operation twice and would make the tool list lie about what
  the app does (D8);
- **omitting `destination` behaves exactly as before** — the Bluesky post — so an agent
  written against the old surface and the old tool keeps working (FR-002);
- **an unknown destination is a result, not a throw**: `{ ok: false, reason }`, the clip
  unchanged, exactly as an unknown export target already is;
- **the answer is the address** of the post or the video — the same shape for both, so a
  caller that only wants the link need not care which destination it used.

## 2. What each destination needs

| Destination | The clip goes to | Takes | Answers |
|---|---|---|---|
| `bluesky` (default) | a video post on the person's own Bluesky account | `text`, `alt` | the post's address |
| `youtube` | a video on the person's own YouTube channel | `title`, `visibility` (private when not said) | the video's address |

**Guarantees**

- **the sign-in is the person's, in that window, for either destination** (FR-005): with
  nobody signed in, the call answers with a reason and **nothing leaves the page**;
- **nothing is uploaded for a destination the app is not set up for** (FR-008): the YouTube
  destination answers with the reason rather than starting a sign-in that cannot work;
- **the limits are each destination's own**: the Bluesky path still refuses past ten minutes
  before encoding, and the YouTube path past fifteen (`research.md` D5) — neither limit
  leaks into the other, and neither leaks into an export to a file.

## 3. The tool the harness sees

| Tool | Takes | Answers |
|---|---|---|
| `publish_clip` | `destination`: `bluesky` \| `youtube` (optional); `text`, `alt` (Bluesky); `title`, `visibility` (YouTube) | the post's or the video's address |

**Guarantees**

- **no tool was added and none was removed**: the tool list still has one tool per operation,
  and still has no tool that evaluates code or reaches outside the clip;
- **the arguments are named in the app's vocabulary** — `visibility` is the app's word for
  who may see a video, and the values are the three the destination accepts;
- an app-level refusal is the tool's **result**, not a transport error, as every other tool's
  is — the agent can read it and try something else;
- **the server and the app agree on the shape by construction**: `mcp/` is released with the
  app's version and refuses a page that does not match (the existing version check), so a
  tool that names a destination cannot meet a surface that does not have one without saying
  so.
