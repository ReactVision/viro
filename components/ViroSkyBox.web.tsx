/**
 * Web implementation of ViroSkyBox — sets the scene background to a cube map
 * from six images (`source` = { px, nx, py, ny, pz, nz }). Scene-level (renders
 * no node). Falls back to nothing if any face fails to load.
 */
import { useEffect } from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";

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
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

const FACE_ORDER: (keyof CubeSource)[] = ["px", "nx", "py", "ny", "pz", "nz"];

export function ViroSkyBox(props: Props): null {
  const scene = useViroScene();
  const src = props.source;
  const key = src ? FACE_ORDER.map((f) => resolveImageSource(src[f]) ?? "").join("|") : "";

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
        scene.setBackgroundCube(texture);
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
