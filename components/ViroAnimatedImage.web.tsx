/**
 * ViroAnimatedImage.web.tsx
 *
 * Web implementation of ViroAnimatedImage — an animated image (GIF/APNG) on a
 * flat surface. The browser decodes and advances the animation inside an
 * <img> element on its own timeline; a per-frame draw of that <img> to a canvas
 * samples whatever frame is currently displayed and uploads it as the surface's
 * diffuse texture. This reuses the surface + per-frame-texture pattern from
 * ViroImage / ViroVideo, so the animation plays without any native decoder.
 *
 * MVP scope: source, width/height, transform props, paused, onLoadStart/
 * onLoadEnd/onError. `loop` follows the file's own loop count (a GIF encodes
 * its own looping — JS can't override it here). `placeholderSource`,
 * `resizeMode`, `stereoMode` are follow-ups, matching ViroImage.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import { useEffect, useRef } from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  ViroBlendMode,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";

type Props = ViroWebNodeProps & {
  source: unknown;
  width?: number;
  height?: number;
  paused?: boolean;
  loop?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function ViroAnimatedImage(props: Props): null {
  const scene = useViroScene();
  const width = props.width ?? 1;
  const height = props.height ?? 1;
  const url = resolveImageSource(props.source);

  const geometryRef = useRef<ViroHandle>(0);
  useViroNode(props, (s) => {
    const geo = s.createSurface(width, height);
    geometryRef.current = geo;
    return geo;
  });

  const propsRef = useRef(props);
  propsRef.current = props;
  const pausedRef = useRef(props.paused ?? false);
  pausedRef.current = props.paused ?? false;

  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo || !url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const material = scene.createMaterial();
    scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
    scene.setMaterialBlendMode(material, ViroBlendMode.Alpha);

    let currentTex = 0;
    let rafId = 0;
    let cancelled = false;

    const uploadFrame = () => {
      if (cancelled || !ctx) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!pausedRef.current && w > 0 && h > 0) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        // Sampling the <img> each frame captures the GIF/APNG's current frame,
        // which the browser advances on its own animation clock.
        ctx.drawImage(img, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, tex);
        scene.setGeometryMaterial(geo, material);
        if (currentTex) scene.destroyTexture(currentTex);
        currentTex = tex;
      }
      rafId = requestAnimationFrame(uploadFrame);
    };

    propsRef.current.onLoadStart?.();
    img.onload = () => {
      if (cancelled) return;
      propsRef.current.onLoadEnd?.();
      rafId = requestAnimationFrame(uploadFrame);
    };
    img.onerror = () => {
      if (!cancelled) propsRef.current.onError?.(new Error(`image failed: ${url}`));
    };
    img.src = url;

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      img.onload = null;
      img.onerror = null;
      img.src = "";
      if (currentTex) scene.destroyTexture(currentTex);
      scene.destroyMaterial(material);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return null;
}
