// The automation surface: the app's own operations in one object, published on the
// page only when the page asked to be driven.
//
// It adds no rule of its own. Every operation is the app's — the clip's own
// operations, the flows a button calls — and every one answers with a value rather
// than throwing, so an agent can read a refusal and try something else instead of
// losing the session. What the surface offers is the whole of what an agent can do:
// there is no way to run code, to script the page, or to reach outside the clip.
//
// It exists **only when asked**. `agentAskedFor` is the whole of the gate; a page
// opened without the flag publishes nothing at all.
//
// The module is deliberately free of the DOM: it names the shape, and the
// composition root hands it the parts. That is what lets its rules be proved in
// node, beside it.

/** What an operation answers: the outcome, or a reason it did nothing. */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

/** One take of the clip: where it sits, and how long it is. */
export interface TakeSummary {
  readonly index: number;
  readonly seconds: number;
}

/** One of an annotation's properties, as the inspector would show it. */
export interface AnnotationPropertySummary {
  readonly id: string;
  readonly label: string;
  readonly control: string;
  readonly value: string;
}

/** One of the clip's own properties, as the properties panel would show it. */
export interface ClipPropertySummary {
  readonly id: string;
  readonly label: string;
  readonly control: string;
  readonly value: string;
  /**
   * The values a list property (`control: "choice"`) may take, so an agent is offered what a
   * person is offered. Absent for every other kind.
   */
  readonly choices?: readonly string[];
  /** True for a property the app shows but the person does not set — the clip size. */
  readonly readOnly: boolean;
}

/** One annotation of the clip, as data. */
export interface AnnotationSummary {
  readonly id: string;
  readonly kind: string;
  readonly span: { readonly s: number; readonly e: number };
  readonly properties: readonly AnnotationPropertySummary[];
}

/** The clip as plain data — everything an agent needs to decide what to do next. */
export interface ClipDescription {
  /** The whole recording, in seconds. */
  readonly length: number;
  /** What is left once the cuts are gone, in seconds. */
  readonly keptLength: number;
  readonly takes: readonly TakeSummary[];
  /** The cuts, as fractions of the clip. */
  readonly cuts: readonly { readonly s: number; readonly e: number }[];
  readonly annotations: readonly AnnotationSummary[];
  /** What the clip says about itself — its title, its description. */
  readonly properties: readonly ClipPropertySummary[];
}

/** The numbers and strings a kind needs to make a new annotation. */
export type AnnotationParams = Readonly<Record<string, unknown>>;

/** Which of the three sources are on. */
export interface SourceState {
  readonly screen: boolean;
  readonly webcam: boolean;
  readonly microphone: boolean;
}

/**
 * What the app offers to be driven. Named in the app's own vocabulary, so a person
 * reading a chat recognises what was done.
 */
export interface AgentSurface {
  /** The app's version, so the server can refuse a page it does not match. */
  readonly version: string;
  /** What the clip is, as data. Read-only. */
  describe(): ClipDescription;
  /** Which sources are on. Read-only — turning the screen on is the server's own press. */
  sources(): SourceState;
  /** The takes, through the app's own recording flow. */
  readonly takes: {
    start(): Result;
    stop(): Promise<Result<{ take: TakeSummary }>>;
  };
  /** The editing operations, each the app's own. */
  readonly edit: {
    cut(from: number, to: number): Result<{ removed: number }>;
    /** May wait on the browser: an image's picture is decoded and kept first. */
    annotate(kind: string, params: AnnotationParams): Promise<Result<{ id: string }>>;
    setProperty(id: string, property: string, value: string): Result<{ value: string }>;
    /** Change what the clip says about itself — its title, its description. */
    setClipProperty(property: string, value: string): Result<{ value: string }>;
    remove(id: string): Result<{ kind: string }>;
    undo(): Result<{ change: string }>;
  };
  /** The transport, in the app's own terms. */
  readonly view: {
    seek(seconds: number): Result<{ at: number }>;
    play(): Result;
    pause(): Result;
  };
  /** What leaves the browser: the file, the post, and the video. */
  readonly out: {
    /** `annotations` is `drawn` (in the picture) or `carried` (beside it, for a sidecar). */
    export(target: string, annotations?: string): Promise<Result<{ filename: string }>>;
    /**
     * Publish the clip: a video post on **Bluesky** (what it did before there were two),
     * or a video on the person's own **YouTube** channel. A destination's sign-in is the
     * person's, in that window; with nobody signed in the call is refused with a reason
     * and nothing leaves the page.
     */
    publish(options: {
      destination?: string;
      text?: string;
      alt?: string;
      title?: string;
      visibility?: string;
    }): Promise<Result<{ url: string }>>;
  };
}

/** Was this page opened asking to be driven? The whole of the gate. */
export function agentAskedFor(search: string): boolean {
  return new URLSearchParams(search).get('agent') === '1';
}

/** The parts the surface is made of; each is the app's own, handed in by main.ts. */
export interface AgentParts {
  readonly version: string;
  readonly describe: () => ClipDescription;
  readonly sources: () => SourceState;
  readonly takes: AgentSurface['takes'];
  readonly edit: AgentSurface['edit'];
  readonly view: AgentSurface['view'];
  readonly out: AgentSurface['out'];
}

/** The surface: the parts it was given, and nothing else of its own. */
export function createAgentSurface(parts: AgentParts): AgentSurface {
  return {
    version: parts.version,
    describe: parts.describe,
    sources: parts.sources,
    takes: parts.takes,
    edit: parts.edit,
    view: parts.view,
    out: parts.out,
  };
}

declare global {
  interface Window {
    /** The automation surface, present only on a page opened with `?agent=1`. */
    democlip?: AgentSurface;
  }
}
