// Reading a file's own bytes, in the page.
//
// The export helpers read a file through a `<video>` and a canvas — its duration, its track
// size, a band of a frame. Some questions are about the packets themselves, which no element
// shows: whether a frame the export wrote is in the file at all, and how long it lasts.
// Mediabunny is the library the export writes through, so it reads the packets back here, in
// page context, where a check imports it through the dev server like any other page module.

import { BufferSource, EncodedPacketSink, Input, MP4, WEBM } from 'mediabunny';

/** One video packet of a file: when it starts, in seconds, and how long it lasts. */
export interface VideoPacket {
  timestamp: number;
  duration: number;
}

/** A file's video packets, in decode order. */
export async function videoPackets(bytes: ArrayBuffer): Promise<VideoPacket[]> {
  const input = new Input({ source: new BufferSource(bytes), formats: [WEBM, MP4] });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return [];
    const out: VideoPacket[] = [];
    for await (const packet of new EncodedPacketSink(track).packets()) {
      out.push({ timestamp: packet.timestamp, duration: packet.duration });
    }
    return out;
  } finally {
    input.dispose();
  }
}
