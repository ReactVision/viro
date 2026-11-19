import { useEffect, useState, type RefObject } from "react";
import { ViroRecordingErrorConstants } from "../ViroConstants";
import type { ViroCaptureResult } from "../Utilities/VRModuleOpenXR";

const VIDEO_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

const failure = (errorCode: number): ViroCaptureResult => ({ success: false, url: null, errorCode });
const saved = (url: string): ViroCaptureResult => ({
  success: true,
  url,
  errorCode: ViroRecordingErrorConstants.RECORD_ERROR_NONE,
});

// The renderer's canvas has no preserveDrawingBuffer, so between frames it
// reads as black. Its main loop queues the next frame at the end of each draw;
// a frame callback queued from a task lands after that one, so the buffer it
// reads still holds the frame just drawn.
function inNextDrawnFrame<T>(read: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() =>
      requestAnimationFrame(() => {
        try {
          resolve(read());
        } catch (e) {
          reject(e);
        }
      }),
    ),
  );
}

// The web stand-in for the camera roll: the browser saves it as a download.
function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type Recording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  stopped: Promise<void>;
  fileName: string;
  save: boolean;
  stopCompositing: () => void;
};

/** Drawn over every captured frame, e.g. a watermark the page shows outside the canvas. */
export type ViroCaptureOverlay = (g: CanvasRenderingContext2D, width: number, height: number) => void;

// A 2D copy of the canvas, redrawn with the overlay after each of the renderer's frames.
function compositeEachFrame(canvas: HTMLCanvasElement, overlay: ViroCaptureOverlay) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const g = out.getContext("2d")!;
  let live = true;
  const next = () =>
    setTimeout(() =>
      requestAnimationFrame(() => {
        if (!live) return;
        g.drawImage(canvas, 0, 0, out.width, out.height);
        overlay(g, out.width, out.height);
        next();
      }),
    );
  next();
  return { canvas: out, stop: () => (live = false) };
}

export type ViroWebCapture = {
  takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<ViroCaptureResult>;
  startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
  stopVideoRecording: () => Promise<ViroCaptureResult>;
  dispose: () => void;
};

/**
 * Screenshot and video of a web navigator's canvas, with the AR navigator's
 * arguments, error codes and result shape. `url` is an object URL the caller
 * may revoke. Video carries no audio: native records the microphone, which a
 * browser would have to ask for separately.
 */
export function createViroWebCapture(
  getCanvas: () => HTMLCanvasElement | null,
  options: { overlay?: ViroCaptureOverlay } = {},
): ViroWebCapture {
  const { overlay } = options;
  let recording: Recording | null = null;

  return {
    async takeScreenshot(fileName, saveToCameraRoll) {
      const canvas = getCanvas();
      if (!canvas) return failure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
      try {
        const copy = await inNextDrawnFrame(() => {
          const c = document.createElement("canvas");
          c.width = canvas.width;
          c.height = canvas.height;
          const g = c.getContext("2d")!;
          g.drawImage(canvas, 0, 0);
          overlay?.(g, c.width, c.height);
          return c;
        });
        const blob = await new Promise<Blob | null>((resolve) => copy.toBlob(resolve, "image/png"));
        if (!blob) return failure(ViroRecordingErrorConstants.RECORD_ERROR_WRITE_TO_FILE);
        const url = URL.createObjectURL(blob);
        if (saveToCameraRoll) download(url, `${fileName}.png`);
        return saved(url);
      } catch {
        return failure(ViroRecordingErrorConstants.RECORD_ERROR_UNKNOWN);
      }
    },

    startVideoRecording(fileName, saveToCameraRoll, onError) {
      if (recording) {
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_ALREADY_RUNNING);
        return;
      }
      const canvas = getCanvas();
      if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
        return;
      }
      const composite = overlay ? compositeEachFrame(canvas, overlay) : null;
      const stopCompositing = () => composite?.stop();
      let stream: MediaStream;
      let recorder: MediaRecorder;
      try {
        stream = (composite?.canvas ?? canvas).captureStream(30);
        const mimeType = VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      } catch {
        stopCompositing();
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_INITIALIZATION);
        return;
      }
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve()));
      const current: Recording = { recorder, stream, chunks, stopped, fileName, save: saveToCameraRoll, stopCompositing };
      recorder.onerror = () => {
        if (recording !== current) return;
        recording = null;
        stopCompositing();
        stream.getTracks().forEach((t) => t.stop());
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNKNOWN);
      };
      try {
        recorder.start(1000);
      } catch {
        stopCompositing();
        stream.getTracks().forEach((t) => t.stop());
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_INITIALIZATION);
        return;
      }
      recording = current;
    },

    async stopVideoRecording() {
      const current = recording;
      if (!current) return failure(ViroRecordingErrorConstants.RECORD_ERROR_ALREADY_STOPPED);
      recording = null;
      current.recorder.stop();
      await current.stopped;
      current.stopCompositing();
      current.stream.getTracks().forEach((t) => t.stop());
      const type = current.recorder.mimeType || "video/webm";
      const blob = new Blob(current.chunks, { type });
      if (blob.size === 0) return failure(ViroRecordingErrorConstants.RECORD_ERROR_WRITE_TO_FILE);
      const url = URL.createObjectURL(blob);
      if (current.save) download(url, `${current.fileName}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`);
      return saved(url);
    },

    dispose() {
      const current = recording;
      recording = null;
      if (!current) return;
      if (current.recorder.state !== "inactive") current.recorder.stop();
      current.stopCompositing();
      current.stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** One capture per navigator; a recording still running at unmount is dropped. */
export function useViroWebCapture(canvasRef: RefObject<HTMLCanvasElement | null>): ViroWebCapture {
  const [capture] = useState(() => createViroWebCapture(() => canvasRef.current));
  useEffect(() => () => capture.dispose(), [capture]);
  return capture;
}
