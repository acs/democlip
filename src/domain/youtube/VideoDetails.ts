// What a video says: its title, its description, who may see it, and the category the
// app sends for it.
//
// The limits are the destination's own — `snippet.title` is at most 100 characters and
// `snippet.description` at most 5000 — and an empty or malformed one comes back as
// `invalidTitle` / `invalidDescription`. A title left blank is **not** refused but
// **defaulted**, because a person who types nothing still wants a video, and "never an
// untitled video" is worth more as a rule here than as a check every caller remembers.
//
// `record()` is the one place these become the destination's shape, and it always
// carries `privacyStatus`: an unset one means *public* to YouTube, so the app must send
// the narrowest unless the person chose otherwise. Sending nothing would publish.

import { Visibility } from './Visibility.js';

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 5000;
/** People & Blogs — what the app sends as the video's category. */
export const CATEGORY_ID = '22';

export interface VideoInput {
  readonly title?: string;
  readonly description?: string;
  readonly visibility?: Visibility;
}

/** The writable parts of YouTube's `video` resource, as `videos.insert` wants them. */
export interface VideoRecord {
  readonly snippet: {
    readonly title: string;
    readonly description: string;
    readonly categoryId: string;
  };
  readonly status: {
    readonly privacyStatus: string;
  };
}

export class VideoDetails {
  private constructor(
    readonly title: string,
    readonly description: string,
    readonly visibility: Visibility,
  ) {}

  /**
   * The details as the person gave them, with the two rules of their own: a blank title
   * becomes the app's default, and one past the destination's limit is refused rather
   * than quietly cut.
   */
  static of(input: VideoInput, when: Date): VideoDetails {
    const title = input.title?.trim() || defaultTitle(when);
    if (title.length > TITLE_MAX) {
      throw new Error(`a video's title is at most ${TITLE_MAX} characters, got ${title.length}`);
    }
    const description = input.description ?? '';
    if (description.length > DESCRIPTION_MAX) {
      throw new Error(`a video's description is at most ${DESCRIPTION_MAX} characters, got ${description.length}`);
    }
    return new VideoDetails(title, description, input.visibility ?? Visibility.PRIVATE);
  }

  /** The resource to send, with the visibility always in it. */
  record(): VideoRecord {
    return {
      snippet: { title: this.title, description: this.description, categoryId: CATEGORY_ID },
      status: { privacyStatus: this.visibility.name },
    };
  }
}

/** The title a video gets when the person typed none: the app's own name and the moment. */
export function defaultTitle(when: Date): string {
  return `DemoClip ${when.toISOString().slice(0, 16).replace('T', ' ')}`;
}

/** The address of an uploaded video, from the id YouTube gave it. */
export function watchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}
