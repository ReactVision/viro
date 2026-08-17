/**
 * Web implementation of Viro360Image — sets the scene background to a textured
 * sphere from an equirectangular image. Scene-level (renders no node).
 */
import { useEffect } from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";

type Props = {
  source: unknown;
  rotation?: [number, number, number];
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function Viro360Image(props: Props): null {
  const scene = useViroScene();
  const url = resolveImageSource(props.source);
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let texture = 0;
    props.onLoadStart?.();
    loadImageRGBA(url)
      .then((img) => {
        if (cancelled) return;
        texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
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
  }, [url, rx, ry, rz]);

  return null;
}
