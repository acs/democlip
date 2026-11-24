// Codec selection — the browser boundary for "which WebM mime can we record?".
//
// A take with a picture is a video file; a **sound-only** take is an audio file, and
// asking for a video codec on a stream with no video track is a mismatch a browser
// may refuse. So the stream's own tracks decide which list is asked.

const WITH_AUDIO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const VIDEO_ONLY = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const AUDIO_ONLY = ['audio/webm;codecs=opus', 'audio/webm'];

export function getBestMime(hasVideo: boolean, hasAudio: boolean): string | null {
  const list = !hasVideo
    ? AUDIO_ONLY
    : hasAudio ? WITH_AUDIO : VIDEO_ONLY;
  for (const m of list) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}
