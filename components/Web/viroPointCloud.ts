/**
 * ViroARScene's point cloud on the web: onARPointCloudUpdate and
 * displayPointCloud, from the tracker's feature points.
 *
 * The session reads the points only while something wants them, because each
 * read copies them out of the engine every frame. They arrive in metres once the
 * tracker's scale resolves, and not before, so the callback is quiet until then.
 * Needs @reactvision/viro-web-renderer with the point cloud (and its virocore
 * build to draw it); against an older one both props warn once and do nothing.
 */
import { useEffect, useRef } from "react";
import type { ViroArSession, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { loadImageRGBA, resolveImageSource } from "./viroImageLoader";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

/** Native's payload: points as [x, y, z, confidence] and an id per point. */
export type ViroWebPointCloud = {
  points: [number, number, number, number][];
  identifiers: number[];
};

export type ViroWebDisplayPointCloud = {
  imageSource?: unknown;
  imageScale?: [number, number, number];
  maxPoints?: number;
};

/** What a renderer with the point cloud adds to the session and the scene API. */
type PointCloudSession = {
  setPointCloudEnabled?: (enabled: boolean) => void;
  getPointCloud?: () => { points: [number, number, number][]; identifiers: number[] };
};
type PointCloudScene = {
  arDisplayPointCloud?: (
    display: boolean,
    options?: { texture?: number | null; scale?: [number, number, number]; maxPoints?: number },
  ) => boolean;
};

/** The session's points in native's shape; the web tracker has no confidence, so 1. */
export function toViroPointCloud(cloud: {
  points: [number, number, number][];
  identifiers: number[];
}): ViroWebPointCloud {
  return {
    points: cloud.points.map(([x, y, z]): [number, number, number, number] => [x, y, z, 1]),
    identifiers: [...cloud.identifiers],
  };
}

export function useViroPointCloud(
  session: ViroArSession | null,
  scene: ViroSceneApi | null,
  onUpdate: ((cloud: ViroWebPointCloud) => void) | undefined,
  display: ViroWebDisplayPointCloud | undefined,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const wantsUpdates = !!onUpdate;
  const wantsDisplay = !!display;
  const displayKey = JSON.stringify(display ? { ...display, imageSource: resolveImageSource(display.imageSource) } : null);

  // Read the points while either prop is set.
  useEffect(() => {
    const s = session as (ViroArSession & PointCloudSession) | null;
    if (!s || !(wantsUpdates || wantsDisplay)) return;
    if (typeof s.setPointCloudEnabled !== "function") {
      warnUnsupported(
        "ViroARScene point cloud",
        "this version of @reactvision/viro-web-renderer",
        "Update @reactvision/viro-web-renderer for onARPointCloudUpdate and displayPointCloud.",
      );
      return;
    }
    s.setPointCloudEnabled(true);
    return () => s.setPointCloudEnabled?.(false);
  }, [session, wantsUpdates, wantsDisplay]);

  // onARPointCloudUpdate, every frame there are points, as native fires it.
  useEffect(() => {
    const s = session as (ViroArSession & PointCloudSession) | null;
    if (!s || !wantsUpdates || typeof s.getPointCloud !== "function") return;
    let frame = requestAnimationFrame(function tick() {
      frame = requestAnimationFrame(tick);
      const cloud = s.getPointCloud!();
      if (cloud.identifiers.length > 0) onUpdateRef.current?.(toViroPointCloud(cloud));
    });
    return () => cancelAnimationFrame(frame);
  }, [session, wantsUpdates]);

  // displayPointCloud: the renderer draws the points as particles.
  useEffect(() => {
    const api = scene as (ViroSceneApi & PointCloudScene) | null;
    if (!api || !session || !wantsDisplay) return;
    if (typeof api.arDisplayPointCloud !== "function") return; // warned above
    const opts = JSON.parse(displayKey) as ViroWebDisplayPointCloud & { imageSource?: string };
    let cancelled = false;
    let texture: number | null = null;
    const show = () =>
      api.arDisplayPointCloud!(true, { texture, scale: opts.imageScale, maxPoints: opts.maxPoints }) ||
      warnUnsupported(
        "ViroARScene.displayPointCloud",
        "this virocore web build",
        "The renderer's wasm predates the point cloud; update @reactvision/viro-web-renderer.",
      );
    if (opts.imageSource) {
      loadImageRGBA(opts.imageSource)
        .then((img) => {
          if (cancelled) return;
          texture = api.createTextureRGBA(img.pixels, img.width, img.height, true);
          show();
        })
        .catch(() => !cancelled && show());
    } else {
      show();
    }
    return () => {
      cancelled = true;
      api.arDisplayPointCloud!(false);
      if (texture !== null) api.destroyTexture(texture);
    };
  }, [scene, session, wantsDisplay, displayKey]);
}
