/**
 * Media the browser will not start before a user gesture waits for one instead
 * of failing, and video frames reach the GPU without a read-back where the
 * renderer can take them.
 */
import {
  forwardMediaEvents,
  playWhenAllowed,
  resumeAudioWhenAllowed,
  seekMedia,
  streamVideoTexture,
} from "../components/Web/viroMedia";

const listeners = new Map<string, Set<() => void>>();
const activation = { isActive: true };
(globalThis as any).document = {
  addEventListener: (type: string, fn: () => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: jest.fn(),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    }),
  }),
};
Object.defineProperty(globalThis, "navigator", { value: { userActivation: activation }, configurable: true });
class FakeMedia {
  muted = false;
  playing = false;
  allowed = false;
  readyState = 2;
  HAVE_CURRENT_DATA = 2;
  videoWidth = 4;
  videoHeight = 2;
  play = jest.fn(() => {
    if (this.allowed || this.muted) {
      this.playing = true;
      return Promise.resolve();
    }
    return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
  });
}
class FakeVideo extends FakeMedia {}
class FakeAudio extends FakeMedia {}
(globalThis as any).HTMLVideoElement = FakeVideo;

const gesture = (type = "click") => [...(listeners.get(type) ?? [])].forEach((fn) => fn());
const listening = () => [...listeners.values()].some((set) => set.size > 0);
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  activation.isActive = true;
});

describe("playWhenAllowed", () => {
  it("plays a blocked video muted and gives it its sound at the first gesture", async () => {
    const video = new FakeVideo();
    const onError = jest.fn();
    const cancel = playWhenAllowed(video as any, false, onError);
    await flush();
    expect(video.playing).toBe(true);
    expect(video.muted).toBe(true);
    expect(listening()).toBe(true);

    video.allowed = true;
    gesture();
    await flush();
    expect(video.muted).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    expect(listening()).toBe(false);
    cancel();
  });

  it("holds blocked audio until a gesture that grants activation", async () => {
    const audio = new FakeAudio();
    const cancel = playWhenAllowed(audio as any, false);
    await flush();
    expect(audio.playing).toBe(false);

    activation.isActive = false;
    gesture("pointerdown");
    expect(audio.play).toHaveBeenCalledTimes(1);

    activation.isActive = true;
    audio.allowed = true;
    gesture("touchend");
    await flush();
    expect(audio.playing).toBe(true);
    expect(listening()).toBe(false);
    cancel();
  });

  it("drops a cancelled element and reports other failures", async () => {
    const audio = new FakeAudio();
    const cancel = playWhenAllowed(audio as any, false);
    await flush();
    cancel();
    expect(listening()).toBe(false);

    const broken = new FakeAudio();
    broken.play.mockImplementation(() => Promise.reject(new Error("decode")));
    const onError = jest.fn();
    playWhenAllowed(broken as any, false, onError);
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "decode" }));
  });

  it("resumes a suspended audio context at the gesture", async () => {
    const ctx = {
      state: "suspended",
      resume: jest.fn(function (this: any) {
        if (activation.isActive && this.allow) this.state = "running";
        return Promise.resolve();
      }),
      allow: false,
    };
    resumeAudioWhenAllowed(ctx as any);
    await flush();
    expect(listening()).toBe(true);
    ctx.allow = true;
    gesture();
    await flush();
    expect(ctx.state).toBe("running");
    expect(listening()).toBe(false);
  });
});

describe("streamVideoTexture", () => {
  let frames: (() => void)[] = [];
  beforeEach(() => {
    frames = [];
    (globalThis as any).requestAnimationFrame = (cb: () => void) => frames.push(cb);
    (globalThis as any).cancelAnimationFrame = () => {};
  });
  const step = () => frames.splice(0).forEach((cb) => cb());

  function sceneWith(sourceHandle: number) {
    let next = 100;
    return {
      createSourceTexture: jest.fn(() => sourceHandle),
      updateTextureFromSource: jest.fn(() => true),
      createTextureRGBA: jest.fn(() => next++),
      destroyTexture: jest.fn(),
    };
  }

  it("fills one GPU texture from the element, applied once", () => {
    const scene = sceneWith(5);
    const onFrame = jest.fn();
    const stop = streamVideoTexture(scene as any, new FakeVideo() as any, onFrame);
    step();
    step();
    expect(onFrame.mock.calls).toEqual([
      [5, true],
      [5, false],
    ]);
    expect(scene.createTextureRGBA).not.toHaveBeenCalled();
    stop();
    expect(scene.destroyTexture).toHaveBeenCalledWith(5);
  });

  it("falls back to a new texture per frame on a renderer without source textures", () => {
    const scene = sceneWith(0);
    const onFrame = jest.fn();
    const stop = streamVideoTexture(scene as any, new FakeVideo() as any, onFrame);
    step();
    step();
    expect(onFrame.mock.calls).toEqual([
      [100, true],
      [101, true],
    ]);
    expect(scene.destroyTexture).toHaveBeenCalledWith(100);
    stop();
    expect(scene.destroyTexture).toHaveBeenCalledWith(101);
  });
});

describe("forwardMediaEvents", () => {
  class EventMedia {
    currentTime = 0;
    duration = NaN;
    handlers = new Map<string, () => void>();
    addEventListener(type: string, fn: () => void) {
      this.handlers.set(type, fn);
    }
    removeEventListener(type: string) {
      this.handlers.delete(type);
    }
    fire(type: string) {
      this.handlers.get(type)?.();
    }
  }

  it("reports buffering once per stall and progress as native's (current, total)", () => {
    const media = new EventMedia();
    const props = { onBufferStart: jest.fn(), onBufferEnd: jest.fn(), onUpdateTime: jest.fn() };
    const stop = forwardMediaEvents(media as any, () => props);
    media.fire("loadstart");
    media.fire("waiting");
    expect(props.onBufferStart).toHaveBeenCalledTimes(1);
    expect(props.onBufferStart).toHaveBeenCalledWith({ nativeEvent: {} });
    media.fire("canplay");
    media.fire("playing");
    expect(props.onBufferEnd).toHaveBeenCalledTimes(1);
    media.currentTime = 1.5;
    media.fire("timeupdate");
    expect(props.onUpdateTime).toHaveBeenLastCalledWith(1.5, 0);
    media.duration = 4;
    media.fire("timeupdate");
    expect(props.onUpdateTime).toHaveBeenLastCalledWith(1.5, 4);
    stop();
    expect(media.handlers.size).toBe(0);
  });

  it("seeks within the media and ignores a time that is not a number", () => {
    const media = { currentTime: 2 };
    seekMedia(media as any, NaN);
    expect(media.currentTime).toBe(2);
    seekMedia(media as any, -1);
    expect(media.currentTime).toBe(0);
    seekMedia(null, 3);
  });
});
