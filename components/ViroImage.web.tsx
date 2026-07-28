/**
 * Web implementation of ViroImage — a flat surface textured with an image loaded
 * from `source`. Reuses the existing async image pipeline (loadImageRGBA →
 * createTextureRGBA) and applies it to a Constant-lit, alpha-blended material so
 * the image shows unlit with transparency, matching native.
 *
 * MVP scope: `source`, `width`/`height` (via style or props), load callbacks.
 * `resizeMode`, `placeholderSource`, `stereoMode`, `mipmap`, `format` are
 * follow-ups (the surface stretches the image to width×height for now).
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  ViroBlendMode,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";

type Props = ViroWebNodeProps & {
  source: unknown;
  width?: number;
  height?: number;
  style?: { width?: number; height?: number } & Record<string, unknown>;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function ViroImage(props: Props) {
  const scene = useViroScene();
  const width = props.width ?? props.style?.width ?? 1;
  const height = props.height ?? props.style?.height ?? 1;

  const geometryRef = useRef<ViroHandle>(0);
  const node = useViroNode(props, (s) => {
    const geo = s.createSurface(width, height);
    geometryRef.current = geo;
    return geo;
  });

  const url = resolveImageSource(props.source);
  const materialRef = useRef<ViroHandle>(0);
  const textureRef = useRef<ViroHandle>(0);

  // Load the image and apply it as the surface's diffuse texture.
  const propsRef = useRef(props);
  propsRef.current = props;
  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo || !url) return;
    let cancelled = false;

    propsRef.current.onLoadStart?.();
    loadImageRGBA(url)
      .then((img) => {
        if (cancelled) return;
        const texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
        const material = scene.createMaterial();
        scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
        scene.setMaterialBlendMode(material, ViroBlendMode.Alpha);
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
        scene.setGeometryMaterial(geo, material);
        textureRef.current = texture;
        materialRef.current = material;
        propsRef.current.onLoadEnd?.();
      })
      .catch((err) => {
        if (!cancelled) propsRef.current.onError?.(err);
      });

    return () => {
      cancelled = true;
      if (materialRef.current) {
        scene.destroyMaterial(materialRef.current);
        materialRef.current = 0;
      }
      if (textureRef.current) {
        scene.destroyTexture(textureRef.current);
        textureRef.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return null;
}
