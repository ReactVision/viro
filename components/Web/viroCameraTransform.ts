/**
 * The camera as native reports it (onCameraTransformUpdate,
 * getCameraOrientationAsync): position, Euler rotation in degrees, and the
 * forward and up vectors, read from the view the navigator publishes for
 * dragging (viroDrag.ts).
 */
import { useEffect, useRef } from "react";
import type { ViroSceneApi } from "@reactvision/viro-web-renderer";
import { cameraView, customCameraActive } from "./viroDrag";
import { cameraBasis, quatToEulerDegrees, type Vec3 } from "./viroMath";
import { useViroScene } from "./ViroWebContext";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

export type ViroWebCameraOrientation = { position: Vec3; rotation: Vec3; forward: Vec3; up: Vec3 };

/** The onCameraTransformUpdate payload, with the deprecated `cameraTransform` key native still sends. */
export type ViroWebCameraTransform = ViroWebCameraOrientation & { cameraTransform: ViroWebCameraOrientation };

const UNKNOWN_CAMERA = "The camera of a ViroCamera or ViroOrbitCamera (onCameraTransformUpdate, getCameraOrientationAsync)";

export function cameraOrientation(scene: ViroSceneApi): ViroWebCameraOrientation | null {
  const view = cameraView(scene);
  if (!view) return null;
  const { forward, up } = cameraBasis(view.orientation);
  return { position: [...view.position] as Vec3, rotation: quatToEulerDegrees(view.orientation), forward, up };
}

/** getCameraOrientationAsync's answer; rejects where the camera is not known. */
export async function cameraOrientationAsync(scene: ViroSceneApi): Promise<ViroWebCameraOrientation> {
  const now = cameraOrientation(scene);
  if (now) return now;
  if (customCameraActive(scene)) warnUnsupported(UNKNOWN_CAMERA, "the web");
  // Also before an AR session has started: there is no camera pose yet.
  throw new Error("The camera's orientation is not known yet.");
}

/** Calls `onUpdate` on each frame the camera has moved, as native does. */
export function useViroCameraTransform(onUpdate: ((transform: ViroWebCameraTransform) => void) | undefined): void {
  const scene = useViroScene();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const wanted = !!onUpdate;

  useEffect(() => {
    if (!wanted) return;
    let frame = 0;
    let last: number[] | null = null;
    const step = () => {
      frame = requestAnimationFrame(step);
      const now = cameraOrientation(scene);
      if (!now) {
        if (customCameraActive(scene)) warnUnsupported(UNKNOWN_CAMERA, "the web");
        return;
      }
      const values = [...now.position, ...now.forward, ...now.up];
      if (last && values.every((v, i) => Math.abs(v - last![i]!) < 1e-5)) return;
      last = values;
      onUpdateRef.current?.({ ...now, cameraTransform: now });
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [scene, wanted]);
}
