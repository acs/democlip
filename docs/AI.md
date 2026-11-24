# Drive it from an agent

DemoClip ships a local [MCP](https://modelcontextprotocol.io) server, so an agent
in your chat can open the app in a browser and edit the clip while you watch.

Add it to [OpenCode](https://opencode.ai) once:

```bash
opencode mcp add democlip --global -- npx -y democlip-mcp
```

Then, in a chat, ask for a DemoClip session. **Your own Chrome** opens on the app, on a
profile of its own, and the server drives that page through the browser's own
**DevTools Protocol** — the interface DevTools itself uses, over a debugging port on
loopback that lives only as long as the session. Your Chrome rather than one the server
ships is deliberate on macOS: screen recording is granted per application, so only a
browser the system recognises can be allowed to capture. **You** record exactly as you
always have — press **Screen** and pick the window, tab or screen in the browser's own
picker; the agent can turn a source on and press Record, but what is *shared* is chosen
by you, in the picker, because that is the one thing a browser will not give away to
anything but a hand. Then ask for the edit: *"cut the pauses, put an arrow on the button
at 0:12, colour it yellow"*. The changes land in that window as you watch, and the app's
own **undo** takes any of them back, in one action, whoever made it. Copy a screenshot
and ask for it to be placed at 0:20, and the server reads your clipboard and adds it as
an image annotation — no path and nothing to upload.

The agent's reach is the app's own operations and nothing more — cut, annotate,
place the picture on your clipboard, set a property, remove, undo, seek, record a
take, import a video file as a take, export, publish, and read the
clip. One of them names a file on your machine, and only one: `import_take`, which
is the app's own **Import** told what to bring in. There is no way for it to run code
in the page, and the recording is never re-encoded. An export writes the same file a
person would get, to your Downloads folder — and that file can come back in as a
take, so a clip can leave, be worked on by whatever you have, and be picked up again,
its annotations coming back with it when they were written beside the video.
A publish goes from **your** own Bluesky or YouTube account, signed in in that window —
and a harness can deny that one tool while keeping the rest.

The transport can't be bounded — a DevTools Protocol port can do anything to a page —
so the bound is where it can be: the **tool list**, which is the app's own vocabulary
and nothing else. The package itself is small for the same reason: it depends on
Playwright only as its protocol client, which is a library with no browser download,
and it never uses a bundled browser because a session launches the one you have.

Requires Node 20+ and a desktop with a display (the browser is opened headful, on
purpose: you are watching it).
