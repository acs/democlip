// The YouTube dialog: the YouTube option in the Export menu.
//
// A small modal with four states, and it decides nothing about YouTube. Not set up, it
// says so and sends nothing. Signed out, it offers the Google sign-in — which Google's
// token model requires to come from a press, so it is a button and never automatic.
// Signed in, it asks for the video's title, its description and who may see it, then
// hands off to the YouTube flow (youtube-flow.ts) and reports how far it has got.
//
// It owns the DOM and the fact of being open; the words for a failure come from the
// client, which is the only place that knows what the destination said.

import { el } from '../dom.js';
import {
  signInToYouTube, signOutOfYouTube, uploadClip, youTubeAccount, youtubeConfigured,
  type YouTubeAccount, type YouTubeProgress, type YouTubeVideoLink,
} from './youtube-flow.js';

const STAGE: Record<YouTubeProgress['stage'], string> = {
  encoding: 'Writing the MP4…',
  uploading: 'Uploading to YouTube…',
  processing: 'YouTube is processing the video…',
};

const SIGNIN_NOTE = 'Sign in with your Google account — Google asks you to approve right here, and nothing is uploaded until you press Upload. The sign-in is not kept: it lasts this page.';
const NOT_SET_UP = 'This build is not set up to upload to YouTube — it needs an app of its own on Google. Nothing is sent.';

class YouTubeDialog {
  private busy = false;
  // Set once the clip is on YouTube: the dialog has said its piece, and there is nothing
  // left to press — so its controls go quiet rather than invite a second upload of the
  // same clip.
  private done = false;

  init(): void {
    el.ytClose.addEventListener('click', () => this.close());
    el.ytBd.addEventListener('click', event => { if (event.target === el.ytBd) this.close(); });
    el.ytSignin.addEventListener('click', () => void this.signIn());
    el.ytSignout.addEventListener('click', () => void this.signOut());
    el.ytCancel.addEventListener('click', () => this.close());
    el.ytGo.addEventListener('click', () => void this.upload());
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.isOpen) this.close(); });
  }

  get isOpen(): boolean {
    return el.ytBd.classList.contains('on');
  }

  async open(): Promise<void> {
    if (this.busy) return;
    if (this.done) this.startOver();
    this.status('');
    this.fail('');
    el.ytBd.classList.add('on');
    if (!(await youtubeConfigured())) {
      this.show('not-configured');
      return;
    }
    const account = await youTubeAccount();
    this.show(account ? 'compose' : 'signin', account);
  }

  close(): void {
    if (this.busy) return;    // an upload in flight is not abandoned by a click
    el.ytBd.classList.remove('on');
  }

  private show(view: 'not-configured' | 'signin' | 'compose', account: YouTubeAccount | null = null): void {
    el.ytSigninView.style.display = view === 'compose' ? 'none' : '';
    el.ytComposeView.style.display = view === 'compose' ? '' : 'none';
    el.ytSignin.style.display = view === 'signin' ? '' : 'none';
    el.ytNote.textContent = view === 'not-configured' ? NOT_SET_UP : SIGNIN_NOTE;
    // The channel is what a person recognises; when YouTube will not name it, the account
    // they just consented with is what the app can honestly say.
    if (account) {
      el.ytAs.textContent = account.channel
        ? 'Signed in as ' + account.channel
        : 'Signed in with Google — the clip goes to that account\'s channel';
    }
  }

  private async signIn(): Promise<void> {
    this.fail('');
    this.status('Asking Google…');
    try {
      await signInToYouTube();
    } catch (error) {
      this.status('');
      this.fail((error as Error).message);
      return;
    }
    // Signing in is the whole of what this press is for. Whether the account may upload is
    // YouTube's to say, and it says so when the upload starts — so the compose view opens
    // whatever the channel read came back with, and the app does not refuse on its behalf.
    const account = await youTubeAccount().catch(() => null);
    this.status('');
    this.show('compose', account ?? { channel: null });
  }

  private async signOut(): Promise<void> {
    await signOutOfYouTube();
    this.show('signin');
  }

  private async upload(): Promise<void> {
    this.busy = true;
    this.fail('');
    el.ytStatus.textContent = '';
    this.controls(false);
    await uploadClip({
      title: el.ytTitle.value,
      description: el.ytDescription.value,
      visibility: el.ytVisibility.value,
    }, {
      onProgress: progress => this.status(this.line(progress)),
      onDone: video => this.uploaded(video),
      onError: message => { this.status(''); this.fail(message); },
    });
    this.busy = false;
    // A failure leaves the dialog usable — try again, or close it. An upload leaves it
    // spent, and `uploaded` has already said so.
    if (!this.done) this.controls(true);
  }

  // An uploaded video is something to open, so it is shown as a link rather than as the
  // id it is written at. The controls go quiet here rather than at the call site, so the
  // spent state belongs to the fact of being uploaded.
  private uploaded(video: YouTubeVideoLink): void {
    this.done = true;
    this.controls(false);
    el.ytStatus.textContent = 'Uploaded ✓ ';
    const link = document.createElement('a');
    link.href = video.url;
    link.title = video.id;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = video.url;
    el.ytStatus.append(link);
  }

  // Everything that could start, or lose, another upload of a clip that is already up:
  // the button and the fields. The close button, Escape and the backdrop are left alone
  // — those are how you leave.
  private controls(on: boolean): void {
    el.ytGo.disabled = !on;
    el.ytCancel.disabled = !on;
    el.ytTitle.disabled = !on;
    el.ytDescription.disabled = !on;
    el.ytVisibility.disabled = !on;
  }

  // Opening the dialog again after an upload starts from nothing: the video is up, and
  // the details would only repeat it.
  private startOver(): void {
    this.done = false;
    el.ytTitle.value = '';
    el.ytDescription.value = '';
    el.ytVisibility.value = 'private';
    this.controls(true);
  }

  private line(progress: YouTubeProgress): string {
    const base = STAGE[progress.stage] ?? progress.stage;
    return progress.progress != null ? `${base} ${progress.progress}%` : base;
  }

  private status(text: string): void {
    el.ytStatus.textContent = text;
  }

  private fail(text: string): void {
    el.ytError.textContent = text;
    el.ytError.style.display = text ? '' : 'none';
  }
}

export const youtubeDialog = new YouTubeDialog();
