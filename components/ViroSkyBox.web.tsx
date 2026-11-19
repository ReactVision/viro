/**
 * Web implementation of ViroSkyBox — sets the scene background to a cube map
 * from six images (`source` = { px, nx, py, ny, pz, nz }), or to a solid
 * `color` when there is no source. Scene-level (renders no node). Falls back to
 * nothing if any face fails to load.
 */
import { useEffect } from "react";
import { useViroParentNode, useViroScene } from "./Web/ViroWebContext";
import { setViroBackgroundCube } from "./Web/viroBackground";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";
import { parseColorToRGBA } from "./Web/viroColor";

type CubeSource = {
  px: unknown;
  nx: unknown;
  py: unknown;
  ny: unknown;
  pz: unknown;
  nz: unknown;
};

type Props = {
  source?: Partial<CubeSource>;
  color?: string | number;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

const FACE_ORDER: (keyof CubeSource)[] = ["px", "nx", "py", "ny", "pz", "nz"];

export function ViroSkyBox(props: Props): null {
  const scene = useViroScene();
  const parent = useViroParentNode();
  const src = props.source;
  const key = src ? FACE_ORDER.map((f) => resolveImageSource(src[f]) ?? "").join("|") : "";
  const color = !src && props.color != null ? props.color : null;

  // The wasm's background takes a cube texture only, so the colour is a 1x1 one.
  useEffect(() => {
    if (color === null) return;
    const face = new Uint8Array(parseColorToRGBA(color).map((c) => Math.round(c * 255)));
    const texture = scene.createTextureCubeRGBA({ px: face, nx: face, py: face, ny: face, pz: face, nz: face }, 1, 1);
    setViroBackgroundCube(scene, parent, texture);
    return () => scene.destroyTexture(texture);
  }, [scene, parent, color]);

  useEffect(() => {
    if (!src) return;
    const urls = FACE_ORDER.map((f) => resolveImageSource(src[f]));
    if (urls.some((u) => !u)) return;
    let cancelled = false;
    let texture = 0;

    Promise.all(urls.map((u) => loadImageRGBA(u as string)))
      .then((faces) => {
        if (cancelled) return;
        const { width, height } = faces[0];
        texture = scene.createTextureCubeRGBA(
          {
            px: faces[0].pixels,
            nx: faces[1].pixels,
            py: faces[2].pixels,
            ny: faces[3].pixels,
            pz: faces[4].pixels,
            nz: faces[5].pixels,
          },
          width,
          height,
        );
        setViroBackgroundCube(scene, parent, texture);
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
  }, [key]);

  return null;
}
