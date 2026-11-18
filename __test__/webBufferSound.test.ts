/**
 * Sounds play from decoded buffers through Web Audio, so iOS cannot stop one
 * when a video starts, and keep their place across a pause.
 */
const mockResume = jest.fn();
jest.mock("../components/Web/viroMedia", () => ({
  resumeAudioWhenAllowed: (...a: unknown[]) => mockResume(...a),
}));

class FakeSource {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped = false;
  connect = jest.fn();
  disconnect = jest.fn();
  start(_when: number, offset: number) {
    this.started.push(offset);
  }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
}
const sources: FakeSource[] = [];
const ctx = {
  currentTime: 0,
  createBufferSource: () => {
    const s = new FakeSource();
    sources.push(s);
    return s;
  },
  decodeAudioData: (_d: ArrayBuffer, ok: (b: unknown) => void) =>
    ok({ duration: 10 }),
};
(globalThis as any).window = {
  AudioContext: function () {
    return ctx;
  },
};
let mockFetchOk = true;
(globalThis as any).fetch = jest.fn(async () => ({
  ok: mockFetchOk,
  status: 404,
  arrayBuffer: async () => new ArrayBuffer(4),
}));

import { createBufferSound } from "../components/Web/viroAudioBuffer";

const flush = () => new Promise((r) => setTimeout(r, 0));
const output = {} as AudioNode;

beforeEach(() => {
  sources.length = 0;
  ctx.currentTime = 0;
  mockFetchOk = true;
  mockResume.mockClear();
});

describe("createBufferSound", () => {
  it("asks for the context and a playback session at play, and starts once decoded", async () => {
    const session = { type: "auto" };
    Object.defineProperty(globalThis.navigator, "audioSession", {
      value: session,
      configurable: true,
    });
    const sound = createBufferSound("a.mp3", output, jest.fn(), jest.fn());
    sound.play();
    expect(mockResume).toHaveBeenCalledWith(ctx);
    expect(session.type).toBe("playback");
    expect(sources).toHaveLength(0);
    await flush();
    expect(sources).toHaveLength(1);
    expect(sources[0].started).toEqual([0]);
  });

  it("keeps its place across a pause, and a pause is not a finish", async () => {
    const onFinish = jest.fn();
    const sound = createBufferSound("a.mp3", output, onFinish, jest.fn());
    sound.play();
    await flush();
    ctx.currentTime = 3;
    sound.pause();
    expect(sources[0].stopped).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
    ctx.currentTime = 20;
    sound.play();
    expect(sources[1].started).toEqual([3]);
  });

  it("wraps a looping sound's place, and applies loop to the playing source", async () => {
    const sound = createBufferSound("a.mp3", output, jest.fn(), jest.fn());
    sound.setLoop(true);
    sound.play();
    await flush();
    expect(sources[0].loop).toBe(true);
    ctx.currentTime = 23;
    sound.pause();
    sound.play();
    expect(sources[1].started).toEqual([3]);
  });

  it("keeps the place in the current lap when loop is turned off mid-play", async () => {
    const sound = createBufferSound("a.mp3", output, jest.fn(), jest.fn());
    sound.setLoop(true);
    sound.play();
    await flush();
    ctx.currentTime = 22;
    sound.setLoop(false);
    expect(sources[0].loop).toBe(false);
    ctx.currentTime = 25;
    sound.pause();
    sound.play();
    expect(sources[1].started).toEqual([5]);
  });

  it("reports a natural end and starts over on the next play", async () => {
    const onFinish = jest.fn();
    const sound = createBufferSound("a.mp3", output, onFinish, jest.fn());
    sound.play();
    await flush();
    ctx.currentTime = 10;
    sources[0].onended!();
    expect(onFinish).toHaveBeenCalledTimes(1);
    sound.play();
    expect(sources[1].started).toEqual([0]);
  });

  it("never starts after dispose, and reports a failed load", async () => {
    const sound = createBufferSound("a.mp3", output, jest.fn(), jest.fn());
    sound.play();
    sound.dispose();
    await flush();
    expect(sources).toHaveLength(0);

    mockFetchOk = false;
    const onError = jest.fn();
    createBufferSound("missing.mp3", output, jest.fn(), onError).play();
    await flush();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("missing.mp3"),
      })
    );
  });
});
