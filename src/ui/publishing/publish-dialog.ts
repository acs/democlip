// The publish dialog: the Bluesky option in the Export menu.
//
// A small modal. Signed out it asks for a handle and sends the person to their
// server; signed in it asks for the post's text and the video's description, then
// hands off to the publish flow (src/publisher.ts) and reports how far it has got.
// It owns the DOM and the fact of being open; it decides nothing about Bluesky.

import { el } from '../dom.js';
import { session } from '../../session.js';
import {
  blueskyAccount, signInToBluesky, signOutOfBluesky, publishClip,
  type BlueskyAccount, type PublishedPost, type PublishProgress,
} from './publish-flow.js';

const STAGE: Record<PublishProgress['stage'], string> = {
  encoding: 'Encoding the MP4…',
  uploading: 'Uploading to Bluesky…',
  processing: 'Bluesky is processing the video…',
  posting: 'Writing the post…',
};

// A percentage is only worth saying while a stage counts through one.
const counts = (stage: PublishProgress['stage']): boolean => stage === 'encoding' || stage === 'processing';

class PublishDialog {
  private busy = false;
  // Set once the clip is on Bluesky: the dialog has said its piece, and there is
  // nothing left to press — so its controls go quiet rather than invite a second
  // post of the same clip.
  private done = false;

  init(): void {
    el.pubClose.addEventListener('click', () => this.close());
    el.pubBd.addEventListener('click', event => { if (event.target === el.pubBd) this.close(); });
    el.pubSignin.addEventListener('click', () => void this.signIn());
    el.pubHandle.addEventListener('keydown', event => { if (event.key === 'Enter') void this.signIn(); });
    el.pubCancel.addEventListener('click', () => this.close());
    el.pubSignout.addEventListener('click', () => void this.signOut());
    el.pubGo.addEventListener('click', () => void this.publish());
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.isOpen) this.close(); });
  }

  get isOpen(): boolean {
    return el.pubBd.classList.contains('on');
  }

  async open(): Promise<void> {
    if (this.busy) return;
    if (this.done) this.startOver();
    this.status('');
    this.fail('');
    el.pubBd.classList.add('on');
    this.show(await blueskyAccount());
  }

  close(): void {
    if (this.busy) return;    // a publish in flight is not abandoned by a click
    el.pubBd.classList.remove('on');
  }

  private show(account: BlueskyAccount | null): void {
    el.pubSigninView.style.display = account ? 'none' : '';
    el.pubComposeView.style.display = account ? '' : 'none';
    // The handle is what a person recognises; the DID is the fallback when the
    // account will not say.
    if (account) {
      el.pubAs.textContent = 'Signed in as ' + (account.handle ?? account.did);
      this.prefill();
    }
  }

  // The clip's own title and description — set once in the properties panel — fill the
  // post's text and its alt, so the branding goes out with the post. Either may still be
  // changed here, for this post alone.
  private prefill(): void {
    el.pubText.value = session.clip.properties.get('title');
    el.pubAlt.value = session.clip.properties.get('description');
  }

  private async signIn(): Promise<void> {
    // The `@` is how mentions are shown, not part of the handle; the empty check
    // wants the real thing (the client strips it again, harmlessly).
    const handle = el.pubHandle.value.trim().replace(/^@/, '');
    if (!handle) { this.fail('Enter your Bluesky handle, like you.bsky.social'); return; }
    this.fail('');
    this.status('Taking you to your server…');
    try {
      await signInToBluesky(handle);   // redirects away; never returns
    } catch (err) {
      this.status('');
      this.fail((err as Error).message);
    }
  }

  private async signOut(): Promise<void> {
    await signOutOfBluesky();
    this.show(null);
  }

  private async publish(): Promise<void> {
    this.busy = true;
    this.fail('');
    el.pubStatus.textContent = '';
    this.controls(false);
    await publishClip(el.pubText.value, el.pubAlt.value, {
      onProgress: progress => this.status(this.line(progress)),
      onDone: post => this.posted(post),
      onError: message => { this.status(''); this.fail(message); },
    });
    this.busy = false;
    // A failure leaves the dialog usable — try again, or close it. A publish leaves
    // it spent, and `posted` has already said so.
    if (!this.done) this.controls(true);
  }

  // A published post is something to open, so it is shown as a link rather than as
  // the AT-URI it is written at. The controls go quiet here rather than at the call
  // site, so the spent state belongs to the fact of being published.
  private posted(post: PublishedPost): void {
    this.done = true;
    this.controls(false);
    el.pubStatus.textContent = 'Published ✓ ';
    const link = document.createElement('a');
    link.href = post.url;
    link.title = post.uri;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = post.url;
    el.pubStatus.append(link);
  }

  // Everything that could start, or lose, another post of a clip that is already
  // published: the two buttons, and the text a second post would carry. The close
  // button, Escape and the backdrop are left alone — those are how you leave.
  private controls(on: boolean): void {
    el.pubGo.disabled = !on;
    el.pubCancel.disabled = !on;
    el.pubText.disabled = !on;
    el.pubAlt.disabled = !on;
  }

  // Opening the dialog again after a publish starts from nothing: the post is made,
  // and the text would only repeat it.
  private startOver(): void {
    this.done = false;
    el.pubText.value = '';
    el.pubAlt.value = '';
    this.controls(true);
  }

  private line(progress: PublishProgress): string {
    const base = STAGE[progress.stage] ?? progress.stage;
    return counts(progress.stage) && progress.progress != null ? `${base} ${progress.progress}%` : base;
  }

  private status(text: string): void {
    el.pubStatus.textContent = text;
  }

  private fail(text: string): void {
    el.pubError.textContent = text;
    el.pubError.style.display = text ? '' : 'none';
  }
}

export const publishDialog = new PublishDialog();
