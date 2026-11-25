// The tools the harness sees.
//
// One tool per operation the app has, named in the app's own vocabulary, so a person
// reading a chat recognises what was done. Every tool ends in an operation the surface
// publishes, and the two lists cannot drift apart — apart from the two the *server*
// delivers, because they are the browser's own doors and the page cannot open them for
// itself: `turn_source_on` for `screen` presses the app's Screen button, so the picker
// gets the activation it insists on, and `import_take` fills the app's file input,
// because a page cannot read a disk. There is no tool that evaluates code, scripts the
// page, or reaches the network except through `publish_clip`.
//
// Two tools reach outside the clip by design: `add_image` reads the person's own
// clipboard, which is not a file and takes no path, because a browser hands a picture
// only to a page a hand has just touched; and `import_take` names a path — the only one
// any tool takes. The *browser* reads that file, not the server, and what becomes of it
// is the app's own rule, so what an agent may bring in is exactly what a person could
// have chosen in the app's own Import.
//
// An app-level refusal is a **result**, not a transport error: the surface answers
// `{ ok: false, reason }` and the tool hands that back, so the agent can read it and
// try something else.

import type { Session } from './session.js';
import { pressScreenButton, screenCaptureBlocked } from './press.js';
import { watchDownloads } from './downloads.js';
import { readClipboardPicture } from './clipboard.js';
import { importTakeFile } from './import.js';
import { callSurface } from './surface.js';

export type Args = Readonly<Record<string, unknown>>;

export interface JsonSchema {
  readonly type: 'object';
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  run(session: Session, args: Args): Promise<unknown>;
}

const SOURCES = ['screen', 'webcam', 'microphone'] as const;

function objectSchema(properties: Readonly<Record<string, unknown>> = {}, required: readonly string[] = []): JsonSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const fraction = (description: string): unknown => ({
  type: 'number',
  minimum: 0,
  maximum: 1,
  description,
});

/** What the clip is: the length, the takes, the cuts, the annotations and the properties. */
const describeClip: Tool = {
  name: 'describe_clip',
  description:
    'Read the clip: its length in seconds, how much is left after the cuts, the takes, the cuts as fractions of the clip, every annotation with its kind, its stretch and the properties it holds, and what the clip says about itself — its title and its description. Read-only; call it before deciding what to change.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'describe'),
};

/** Take a stretch out of the clip. */
const cut: Tool = {
  name: 'cut',
  description:
    'Cut a stretch out of the clip. `from` and `to` are fractions of the clip (0 to 1). The stretch leaves the timeline and what is left closes up; one undo puts it back.',
  inputSchema: objectSchema({ from: fraction('Where the cut starts'), to: fraction('Where it ends') }, ['from', 'to']),
  run: (session, args) => callSurface(session, 'edit.cut', args.from, args.to),
};

/** Draw an annotation over a stretch. */
const annotate: Tool = {
  name: 'annotate',
  description:
    'Add an annotation over a stretch of the clip. `kind` is "arrow", "text" or "sound", and `span` is { s, e } as fractions of the clip giving the stretch it is shown over. An arrow needs `from` and `to`, each { x, y } as fractions of the picture. A text needs `text`, and may take `x`, `y` and `height` (fractions) to place it. A sound plays one of the app\u2019s own sounds over the stretch, mixed with the recorded sound, and takes `sound` — the name of the sound — with no file to give. An image is not made here: use add_image, which places the picture already on the person\u2019s clipboard.',
  inputSchema: objectSchema({
    kind: { type: 'string', enum: ['arrow', 'text', 'sound'], description: 'Which kind of annotation' },
    span: {
      type: 'object',
      properties: { s: fraction('Where the stretch starts'), e: fraction('Where it ends') },
      required: ['s', 'e'],
      description: 'The stretch of the clip the annotation is shown over',
    },
    from: { type: 'object', description: 'The arrow\u2019s tail, as { x, y } fractions of the picture' },
    to: { type: 'object', description: 'The arrow\u2019s head, as { x, y } fractions of the picture' },
    text: { type: 'string', description: 'The words, for a text' },
    x: { type: 'number', description: 'Where a text is placed, as a fraction of the width' },
    y: { type: 'number', description: 'Where a text is placed, as a fraction of the height' },
    height: { type: 'number', description: 'How tall a text is, as a fraction of the height' },
    sound: { type: 'string', description: 'For a sound, the name of one of the app\u2019s own sounds: "chime", "gong", "pluck", "whoosh" and more. Left out, the app\u2019s default is used. There is no file to give.' },
  }, ['kind', 'span']),
  run: (session, args) => callSurface(session, 'edit.annotate', String(args.kind ?? ''), args),
};

/** Place the picture the person already put on their clipboard. */
const addImage: Tool = {
  name: 'add_image',
  description:
    'Add the picture already on the person\u2019s own clipboard as an image over a stretch of the clip. The person copies the picture first; the server reads it from the host\u2019s clipboard, and takes no path or address, so there is nothing to point at. `span` is { s, e } as fractions of the clip. `x` and `y` are the rect\u2019s top-left as fractions of the picture, and `width` is its width as a fraction of the picture\u2019s width — centred at 40% when left out — and the picture keeps its own proportions.',
  inputSchema: objectSchema({
    span: {
      type: 'object',
      properties: { s: fraction('Where the stretch starts'), e: fraction('Where it ends') },
      required: ['s', 'e'],
      description: 'The stretch of the clip the image is shown over',
    },
    x: fraction('The rect\u2019s left edge, as a fraction of the width'),
    y: fraction('The rect\u2019s top edge, as a fraction of the height'),
    width: fraction('How wide, as a fraction of the width (default 0.4)'),
  }, ['span']),
  async run(session, args) {
    const read = await readClipboardPicture();
    if (!read.ok) return { ok: false, reason: read.reason };

    const params: Record<string, unknown> = {
      span: args.span,
      picture: { type: read.picture.type, data: read.picture.bytes.toString('base64') },
    };
    for (const key of ['x', 'y', 'width'] as const) {
      if (args[key] !== undefined) params[key] = args[key];
    }
    return callSurface(session, 'edit.annotate', 'image', params);
  },
};

/** Change something about a placed annotation. */
const setProperty: Tool = {
  name: 'set_property',
  description:
    'Change one property of a placed annotation: `id` from describe_clip, the property ("colour", "words" for a text, or "sound" for a sound annotation — the name of one of the app\u2019s own sounds), and the value. A colour is one of the app\u2019s palette names.',
  inputSchema: objectSchema({
    id: { type: 'string', description: 'The annotation\u2019s id, from describe_clip' },
    property: { type: 'string', description: 'Which property, such as "colour" or "words"' },
    value: { type: 'string', description: 'The new value' },
  }, ['id', 'property', 'value']),
  run: (session, args) => callSurface(session, 'edit.setProperty', args.id, args.property, args.value),
};

/** Change what the clip says about itself. */
const setClipProperty: Tool = {
  name: 'set_clip_property',
  description:
    'Change what the clip says about itself. `property` is "title" or "description" (the words), "addToExport" (whether an export puts a title card — those words over the clip\u2019s first frame — at the head of the file), or "soundBoost" (whether the clip\u2019s sound is brought to a competitive loudness, in the review and in every file; on by default). For the two words, `value` is the text; for the two switches, "true" turns one on and anything else turns it off. Publishing fills its fields from the title and description, so a clip is branded once. One undo takes it back.',
  inputSchema: objectSchema({
    property: { type: 'string', enum: ['title', 'description', 'addToExport', 'soundBoost'], description: 'Which of the clip\u2019s own properties' },
    value: { type: 'string', description: 'The new text, or "true" / "" for "addToExport" or "soundBoost"' },
  }, ['property', 'value']),
  run: (session, args) => callSurface(session, 'edit.setClipProperty', args.property, args.value),
};

/** Take a placed annotation away. */
const removeAnnotation: Tool = {
  name: 'remove_annotation',
  description: 'Remove one annotation by its id. One undo puts it back.',
  inputSchema: objectSchema({ id: { type: 'string', description: 'The annotation\u2019s id' } }, ['id']),
  run: (session, args) => callSurface(session, 'edit.remove', args.id),
};

/** Take the last change back. */
const undo: Tool = {
  name: 'undo',
  description:
    'Take back the last change to the clip, whatever kind it was — a cut, an annotation, a property, whoever made it. One call is one change: an instruction that made a dozen cuts needs a dozen calls.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'edit.undo'),
};

/** Move the playhead. */
const seek: Tool = {
  name: 'seek',
  description: 'Move the playhead to a moment, in seconds from the start of the clip, and hold the frame there.',
  inputSchema: objectSchema({ seconds: { type: 'number', minimum: 0, description: 'Seconds from the start' } }, ['seconds']),
  run: (session, args) => callSurface(session, 'view.seek', args.seconds),
};

/** Start a take. */
const startTake: Tool = {
  name: 'start_take',
  description:
    'Start recording a take. Needs a source: turn the screen, the webcam or the microphone on first — the microphone alone records a sound-only take. The take is appended to the end of the clip.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'takes.start'),
};

/** Stop the take in flight. */
const stopTake: Tool = {
  name: 'stop_take',
  description: 'Stop the take in flight and answer with the take that arrived, and how long it is.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'takes.stop'),
};

/** Turn a source on. */
const turnSourceOn: Tool = {
  name: 'turn_source_on',
  description:
    'Turn a source on: "screen", "webcam" or "microphone". For "screen" this is a real press on the app\u2019s own Screen button, so the browser opens its picker and the person chooses what to share — you cannot choose it, and you should say that the picker is waiting.',
  inputSchema: objectSchema({ source: { type: 'string', enum: [...SOURCES], description: 'Which source' } }, ['source']),
  async run(session, args) {
    const source = String(args.source ?? '');
    if (source === 'screen') {
      // macOS grants Screen Recording per application bundle, so a browser it does not
      // recognise cannot be granted it and the picker would never open. Say so, rather
      // than pressing a button that does nothing.
      const blocked = screenCaptureBlocked(session.browser, process.platform);
      if (blocked) return { ok: false, reason: blocked };
      const pressed = await pressScreenButton(session);
      if (!pressed.pressed) return { ok: false, reason: pressed.reason };
      return { ok: true, sources: await callSurface(session, 'sources'), note: 'the browser is asking the person what to share' };
    }
    return callSurface(session, 'takes.turnSourceOn', source);
  },
};

/** Turn a source off. */
const turnSourceOff: Tool = {
  name: 'turn_source_off',
  description: 'Turn a source off: "screen", "webcam" or "microphone".',
  inputSchema: objectSchema({ source: { type: 'string', enum: [...SOURCES], description: 'Which source' } }, ['source']),
  run: (session, args) => callSurface(session, 'takes.turnSourceOff', args.source),
};

/** Bring a video file already on the machine in as a take. */
const importTake: Tool = {
  name: 'import_take',
  description:
    'Bring a video file already on this machine into the clip as a take: WebM or MP4, the two containers an export can read back. It is appended to the end of the clip holding its own length and sound, and the review opens on it. `path` is an absolute path — the one path any tool takes — and it is how a clip that was improved outside the app comes back. A sidecar written beside the file (what `export_clip` with `annotations: "carried"` leaves) is read with it, and the annotations it holds are put back over the stretch the file is given.',
  inputSchema: objectSchema({
    path: { type: 'string', description: 'The file to bring in, as an absolute path on this machine' },
  }, ['path']),
  run: (session, args) => importTakeFile(session, String(args.path ?? '')),
};

/** Encode the clip and write it to a file, with its annotations beside it if asked. */
const exportClip: Tool = {
  name: 'export_clip',
  description:
    'Encode the clip offline and write it to a file, answering with the path it was written to and its size. `target` is "webm" or "mp4". The file holds exactly the cuts the person watched, and the annotations too — unless `annotations` is "carried": then the file is the picture alone, a sidecar holding the annotations is written beside it, and both paths are answered with. That is the pair a clip goes out to be worked on with, and `import_take` brings it back whole.',
  inputSchema: objectSchema({
    target: { type: 'string', enum: ['webm', 'mp4'], description: 'Which container' },
    annotations: {
      type: 'string',
      enum: ['drawn', 'carried'],
      description: 'Drawn into the picture (the default), or carried in a sidecar beside it',
    },
  }, ['target']),
  async run(session, args) {
    const target = String(args.target ?? '');
    if (target !== 'webm' && target !== 'mp4') {
      return { ok: false, reason: `the app exports webm or mp4, not ${target}` };
    }
    const annotations = args.annotations === undefined ? 'drawn' : String(args.annotations);
    if (annotations !== 'drawn' && annotations !== 'carried') {
      return {
        ok: false,
        reason: `the annotations are drawn into the picture or carried beside it, not ${annotations}`,
      };
    }
    // A file that carries its annotations is written with a sidecar beside it: two
    // downloads, and the watcher goes up before the export is asked for.
    const watcher = watchDownloads(session.page, session.downloadsDir, annotations === 'carried' ? 2 : 1);
    const outcome = await callSurface<{ ok: boolean; filename?: string; reason?: string }>(
      session, 'out.export', target, annotations,
    );
    if (!outcome.ok) {
      watcher.stop();
      return outcome;
    }
    // Which of the two is which is read from their names, not from the order they arrived
    // in: a browser delivers the two download events as they go, and the sidecar has come
    // back before the video it belongs to. It is named for the video it was written with —
    // `.democlip.json` in place of the video's extension — so its name is what says so.
    const saved = await watcher.saved;
    const sidecar = saved.find(file => file.path.endsWith('.democlip.json'));
    const video = saved.find(file => file !== sidecar) ?? saved[0];
    return {
      ok: true,
      path: video.path,
      bytes: video.bytes,
      filename: outcome.filename,
      ...(sidecar ? { annotations: sidecar.path } : {}),
    };
  },
};

/** Publish the clip: a post on Bluesky, or a video on the person's own YouTube channel. */
const publishClip: Tool = {
  name: 'publish_clip',
  description:
    'Publish the clip, from the account the person signed in with in this window. `destination` is "bluesky" (the default) for a video post, or "youtube" for a video on their own channel. For Bluesky, `text` is the post\u2019s words and `alt` describes the video. For YouTube, `title` names the video (the app names it when left out) and `visibility` is "private" (the default), "unlisted" or "public". Needs a sign-in: with nobody signed in it is refused with a reason and nothing leaves the machine.',
  inputSchema: objectSchema({
    destination: { type: 'string', enum: ['bluesky', 'youtube'], description: 'Where the clip goes; bluesky when not said' },
    text: { type: 'string', description: 'The post\u2019s words (Bluesky)' },
    alt: { type: 'string', description: 'A description of the video, for readers who cannot see it (Bluesky)' },
    title: { type: 'string', description: 'The video\u2019s title (YouTube)' },
    visibility: { type: 'string', enum: ['private', 'unlisted', 'public'], description: 'Who may see the video (YouTube); private when not said' },
  }),
  run: (session, args) => callSurface(session, 'out.publish', {
    destination: args.destination,
    text: args.text,
    alt: args.alt,
    title: args.title,
    visibility: args.visibility,
  }),
};

/** Every tool the server offers, in the order a reader should meet them. */
export function toolList(): readonly Tool[] {
  return [
    describeClip,
    cut,
    annotate,
    addImage,
    setProperty,
    setClipProperty,
    removeAnnotation,
    undo,
    seek,
    startTake,
    stopTake,
    turnSourceOn,
    turnSourceOff,
    importTake,
    exportClip,
    publishClip,
  ];
}

export function findTool(name: string): Tool | null {
  return toolList().find(tool => tool.name === name) ?? null;
}

/** The tools as the protocol describes them, without their implementations. */
export function toolDefinitions(): ReadonlyArray<Pick<Tool, 'name' | 'description' | 'inputSchema'>> {
  return toolList().map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
