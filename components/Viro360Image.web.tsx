/**
 * Web implementation of Viro360Image — sets the scene background to a textured
 * sphere from an equirectangular image, or from a radiance .hdr with `isHdr`.
 * Scene-level (renders no node).
 */
import { useEffect } from "react";
import type { ViroHandle, ViroWebRenderer } from "@reactvision/viro-web-renderer";
import { useViroRenderer, useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";

let hdrFiles = 0;

/** The browser cannot decode .hdr, so virocore's loader reads it from the wasm's file system. */
async function loadHdrTexture(renderer: ViroWebRenderer, url: string): Promise<ViroHandle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const fs = renderer.wasmModule.FS;
  const path = `/viro_360_${hdrFiles++}.hdr`;
  fs.writeFile(path, bytes);
  try {
    const texture = renderer.scene.loadRadianceHDRTexture(path);
    if (!texture) throw new Error(`failed to load HDR image: ${url}`);
    return texture;
  } finally {
    fs.unlink?.(path);
  }
}

type Props = {
  source: unknown;
  isHdr?: boolean;
  rotation?: [number, number, number];
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function Viro360Image(props: Props): null {
  const scene = useViroScene();
  const renderer = useViroRenderer();
  const url = resolveImageSource(props.source);
  const isHdr = !!props.isHdr;
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let texture = 0;
    props.onLoadStart?.();
    const load = isHdr
      ? loadHdrTexture(renderer, url)
      : loadImageRGBA(url).then((img) => scene.createTextureRGBA(img.pixels, img.width, img.height, true));
    load
      .then((loaded) => {
        if (cancelled) {
          scene.destroyTexture(loaded);
          return;
        }
        texture = loaded;
        scene.setBackgroundSphere(texture);
        scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
        props.onLoadEnd?.();
      })
      .catch((err) => {
        if (!cancelled) props.onError?.(err);
      });
    return () => {
      cancelled = true;
      if (texture) scene.destroyTexture(texture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isHdr, rx, ry, rz]);

  return null;
}
