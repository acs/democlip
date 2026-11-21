// Who may see a video on YouTube: private, unlisted or public.
//
// The three words are the destination's own — `videos.insert` refuses anything else
// with `forbiddenPrivacySetting` — so they are the type, and nothing else can be
// built here.
//
// **Private** is where a video starts, and that is the app's promise rather than
// YouTube's: an unset `privacyStatus` means *public* to YouTube, so the value is
// always sent, and the one it sends unless the person says otherwise is the narrowest.

/** The three words YouTube takes, and no others. */
export type VisibilityName = 'private' | 'unlisted' | 'public';

export class Visibility {
  private constructor(readonly name: VisibilityName) {}

  /** Where a video starts: the narrowest of the three. */
  static readonly PRIVATE = new Visibility('private');

  /** From one of the destination's own words. Anything else is not a visibility. */
  static of(name: string): Visibility {
    if (name !== 'private' && name !== 'unlisted' && name !== 'public') {
      throw new Error(`a video is private, unlisted or public, not ${name || 'nothing'}`);
    }
    return new Visibility(name);
  }
}
