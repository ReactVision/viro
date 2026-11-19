/**
 * Web capture answers with the AR navigator's error codes and result shape.
 * jest has no canvas or MediaRecorder; the browser probe checks the pixels.
 */
import { createViroWebCapture } from "../components/Web/viroCapture";

class FakeRecorder {
  static isTypeSupported = (t: string) => t === "video/webm";
  state = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: (() => void)[] = [];
  constructor(_stream: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? "";
  }
  addEventListener(_type: string, fn: () => void) {
    this.listeners.push(fn);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["frames"]) });
    this.listeners.forEach((fn) => fn());
  }
}

const track = { stop: jest.fn() };
const canvas = { captureStream: () => ({ getTracks: () => [track] }) } as unknown as HTMLCanvasElement;

beforeEach(() => {
  (globalThis as any).MediaRecorder = FakeRecorder;
  track.stop.mockClear();
});
afterAll(() => delete (globalThis as any).MediaRecorder);

test("a second start reports ALREADY_RUNNING and keeps the first recording", async () => {
  const capture = createViroWebCapture(() => canvas);
  const errors: number[] = [];
  capture.startVideoRecording("a", false, (e) => errors.push(e));
  capture.startVideoRecording("b", false, (e) => errors.push(e));
  expect(errors).toEqual([4]);
  const result = await capture.stopVideoRecording();
  expect(result).toEqual({ success: true, url: expect.stringMatching(/^blob:/), errorCode: -1 });
  expect(track.stop).toHaveBeenCalled();
});

test("a stop with nothing recording reports ALREADY_STOPPED", async () => {
  const capture = createViroWebCapture(() => canvas);
  expect(await capture.stopVideoRecording()).toEqual({ success: false, url: null, errorCode: 5 });
});

test("without MediaRecorder or a canvas, capture reports UNSUPPORTED_PLATFORM", async () => {
  delete (globalThis as any).MediaRecorder;
  const errors: number[] = [];
  createViroWebCapture(() => canvas).startVideoRecording("a", false, (e) => errors.push(e));
  expect(errors).toEqual([6]);
  expect(await createViroWebCapture(() => null).takeScreenshot("a", false)).toEqual({
    success: false,
    url: null,
    errorCode: 6,
  });
});
