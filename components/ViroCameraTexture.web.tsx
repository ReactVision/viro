/**
 * ViroCameraTexture.web.tsx
 *
 * Web implementation of ViroCameraTexture — binds a live device-camera feed to
 * a registered material's diffuse channel. Any geometry using that material
 * name (e.g. a ViroQuad with materials={["selfieMat"]}) then shows the camera.
 * This mirrors the native behaviour: the component owns the camera texture and
 * writes it onto a named material; the material only needs a lightingModel.
 *
 * Reuses the per-frame upload pattern from ViroMaterialVideo / the AR camera
 * background: getUserMedia → hidden <video> → canvas → createTextureRGBA →
 * setMaterialTexture(Diffuse). Front camera is mirrored, matching native.
 *
 * The imperative capture API (capturePhoto / startRecording / stopRecording) is
 * exposed via a ref, same call sites as native. On web there is no filesystem
 * path, so `url` is a data: URL (photo) or an object URL (recording, webm), and
 * `outputPath` is ignored.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { ViroTextureChannel, type ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./Web/ViroWebContext";
import { getSharedMaterialHandle } from "./Web/viroMaterialRegistry";

// Type-only re-exports (erased at compile time) so callers importing these from
// "@reactvision/react-viro" still type-check on web.
export type {
  ViroCameraPosition,
  ViroCameraReadyEvent,
  ViroCaptureResult,
  ViroCapturePhotoOptions,
  ViroCaptureVideoOptions,
} from "./ViroCameraTexture";

import type {
  ViroCameraPosition,
  ViroCaptureResult,
  ViroCapturePhotoOptions,
  ViroCaptureVideoOptions,
} from "./ViroCameraTexture";

type Props = {
  material: string;
  cameraPosition?: ViroCameraPosition;
  paused?: boolean;
  onCameraReady?: () => void;
  onError?: (event: { nativeEvent: { error: string } }) => void;
  [key: string]: any;
};

/** Imperative handle exposed via ref — matches the native class methods. */
export interface ViroCameraTextureHandle {
  capturePhoto(options?: ViroCapturePhotoOptions): Promise<ViroCaptureResult>;
  startRecording(options?: ViroCaptureVideoOptions): Promise<ViroCaptureResult>;
  stopRecording(): Promise<ViroCaptureResult>;
}

export const ViroCameraTexture = React.forwardRef<ViroCameraTextureHandle, Props>(
  function ViroCameraTexture(props, ref): null {
    const scene = useViroScene();
    const materialName = props.material;
    const facingMode: "user" | "environment" =
      (props.cameraPosition ?? "front") === "back" ? "environment" : "user";
    const mirror = facingMode === "user";

    const propsRef = useRef(props);
    propsRef.current = props;
    const pausedRef = useRef(props.paused ?? false);
    pausedRef.current = props.paused ?? false;

    // The canvas holding the most-recent frame, and the live stream — read by the
    // imperative capture API.
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);

    useEffect(() => {
      if (!materialName) return;
      const material: ViroHandle = getSharedMaterialHandle(scene, materialName);
      if (!material) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvasRef.current = canvas;

      let video: HTMLVideoElement | null = null;
      let rafId = 0;
      let currentTex = 0;
      let firstFrame = true;
      let cancelled = false;

      const uploadFrame = () => {
        if (cancelled || !ctx || !video) return;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!pausedRef.current && w > 0 && h > 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          if (mirror) {
            ctx.save();
            ctx.setTransform(-1, 0, 0, 1, w, 0);
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(video, 0, 0, w, h);
          }
          const rgba = ctx.getImageData(0, 0, w, h).data;
          const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
          scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, tex);
          if (currentTex) scene.destroyTexture(currentTex);
          currentTex = tex;
          if (firstFrame) {
            firstFrame = false;
            propsRef.current.onCameraReady?.();
          }
        }
        rafId = requestAnimationFrame(uploadFrame);
      };

      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;

          video = document.createElement("video");
          video.playsInline = true;
          video.muted = true;
          video.srcObject = stream;
          // Safari won't decode/paint a detached <video>, so drawImage() would
          // yield black frames — attach it hidden to the DOM (same as arSession).
          video.setAttribute("aria-hidden", "true");
          Object.assign(video.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "1px",
            height: "1px",
            opacity: "0",
            pointerEvents: "none",
            zIndex: "-1",
          } as Partial<CSSStyleDeclaration>);
          document.body.appendChild(video);
          await video.play();
          rafId = requestAnimationFrame(uploadFrame);
        } catch (err) {
          if (!cancelled) {
            propsRef.current.onError?.({
              nativeEvent: { error: err instanceof Error ? err.message : String(err) },
            });
          }
        }
      })();

      return () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        recorderRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (video) {
          video.pause();
          video.srcObject = null;
          video.remove();
        }
        canvasRef.current = null;
        if (currentTex) scene.destroyTexture(currentTex);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [materialName, facingMode]);

    useImperativeHandle(
      ref,
      (): ViroCameraTextureHandle => ({
        async capturePhoto(): Promise<ViroCaptureResult> {
          const canvas = canvasRef.current;
          if (!canvas || canvas.width === 0) {
            return { success: false, error: "camera texture is not ready" };
          }
          try {
            return { success: true, url: canvas.toDataURL("image/jpeg", 0.92) };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        },

        async startRecording(): Promise<ViroCaptureResult> {
          const stream = streamRef.current;
          if (!stream) return { success: false, error: "camera is not started" };
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            return { success: false, error: "already recording" };
          }
          if (typeof MediaRecorder === "undefined") {
            return { success: false, error: "MediaRecorder is not supported in this browser" };
          }
          try {
            const chunks: BlobPart[] = [];
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            (recorder as any)._chunks = chunks;
            recorder.start();
            recorderRef.current = recorder;
            return { success: true, url: "" };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        },

        async stopRecording(): Promise<ViroCaptureResult> {
          const recorder = recorderRef.current;
          if (!recorder || recorder.state === "inactive") {
            return { success: false, error: "not recording" };
          }
          return new Promise<ViroCaptureResult>((resolve) => {
            recorder.onstop = () => {
              const chunks: BlobPart[] = (recorder as any)._chunks ?? [];
              const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
              recorderRef.current = null;
              resolve({ success: true, url: URL.createObjectURL(blob) });
            };
            recorder.stop();
          });
        },
      }),
      [],
    );

    return null;
  },
);
