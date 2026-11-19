/**
 * ViroAnimatedImage.web.tsx
 *
 * Web implementation of ViroAnimatedImage: an animated image (GIF, APNG, WebP)
 * on a flat surface. The browser's ImageDecoder hands over each frame with its
 * delay, and each is uploaded into one texture the surface keeps, as ViroVideo
 * does. A new texture per frame never drew: virocore puts a texture on the GPU
 * only after the frame that first uses it, and each was replaced first.
 *
 * Drawing an animated <img> to a canvas is no substitute: browsers give the
 * canvas the same frame every time. So where ImageDecoder is missing, or cannot
 * read the file, the image shows as a still.
 *
 * As on native, `loop` (default true) decides whether the animation repeats,
 * whatever the file's own loop count, a delay of 0 plays as 100 ms, and paused
 * holds the current frame. Scope: source, width/height (rebuilt on change),
 * transform props, paused, loop, onLoadStart/onLoadEnd/onError.
 * `placeholderSource`, `resizeMode`, `stereoMode` are follow-ups, matching
 * ViroImage.
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

// ImageDecoder is missing from this TypeScript's DOM lib.
type DecodedFrame = {
  image: CanvasImageSource &
    TexImageSource & { displayWidth: number; displayHeight: number; duration: number | null; close(): void };
};
type FrameDecoder = {
  completed: Promise<void>;
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode(options: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
};
type FrameDecoderClass = {
  new (init: { data: ArrayBuffer; type: string }): FrameDecoder;
  isTypeSupported(type: string): Promise<boolean>;
};

async function openDecoder(url: string): Promise<FrameDecoder | null> {
  const Decoder = (globalThis as { ImageDecoder?: FrameDecoderClass }).ImageDecoder;
  if (!Decoder) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!type || !(await Decoder.isTypeSupported(type))) return null;
    const decoder = new Decoder({ data: await res.arrayBuffer(), type });
    // The frame count is final only once all the data is read and the tracks are known.
    await Promise.all([decoder.completed, decoder.tracks.ready]);
    return decoder;
  } catch {
    return null;
  }
}

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
  useViroNode(
    props,
    (s) => {
      const geo = s.createSurface(width, height);
      geometryRef.current = geo;
      return geo;
    },
    true,
    `${width}x${height}`,
  );

  const propsRef = useRef(props);
  propsRef.current = props;
  const pausedRef = useRef(props.paused ?? false);
  pausedRef.current = props.paused ?? false;
  const loopRef = useRef(props.loop ?? true);
  loopRef.current = props.loop ?? true;
  // Restarts a decoded animation that stopped for pause or for its end.
  const wakeRef = useRef<(() => void) | null>(null);
  useEffect(() => wakeRef.current?.(), [props.paused, props.loop]);

  useEffect(() => {
    if (!url) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const material = scene.createMaterial();
    scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
    scene.setMaterialBlendMode(material, ViroBlendMode.Alpha);
    // Blended, so no depth write: virocore defaults it on and only discards under
    // an alpha cutoff, so a fully transparent border still wrote depth and punched
    // a hole in whatever was drawn behind it after it.
    scene.setMaterialWritesToDepthBuffer(material, false);

    // 0 on a renderer build without source textures: that build gets the first
    // frame as a still image, uploaded once.
    const source = scene.createSourceTexture(true);
    let texture: ViroHandle = 0;
    let appliedGeometry: ViroHandle = 0;
    let rafId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let decoder: FrameDecoder | null = null;
    const img = new Image();

    const upload = (frame: CanvasImageSource & TexImageSource, w: number, h: number) => {
      if (source) {
        if (scene.updateTextureFromSource(source, frame) && texture !== source) {
          texture = source;
          scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
        }
      } else if (!texture && ctx && w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(frame, 0, 0, w, h);
        texture = scene.createTextureRGBA(new Uint8Array(ctx.getImageData(0, 0, w, h).data), w, h, true);
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
      }
    };

    // A size change rebuilds the surface, which then needs the material again.
    const applyToGeometry = () => {
      if (cancelled) return;
      const geo = geometryRef.current;
      if (texture && geo && geo !== appliedGeometry) {
        scene.setGeometryMaterial(geo, material);
        appliedGeometry = geo;
      }
      rafId = requestAnimationFrame(applyToGeometry);
    };
    rafId = requestAnimationFrame(applyToGeometry);

    const fail = () => {
      if (!cancelled) propsRef.current.onError?.(new Error(`image failed: ${url}`));
    };

    const playDecoded = (d: FrameDecoder) => {
      const frames = d.tracks.selectedTrack?.frameCount ?? 1;
      let index = 0;
      let busy = false;
      let loaded = false;
      const show = async () => {
        timer = undefined;
        if (cancelled || busy) return;
        busy = true;
        let delayMs = 100;
        try {
          const { image } = await d.decode({ frameIndex: index });
          if (!cancelled) upload(image, image.displayWidth, image.displayHeight);
          if (image.duration) delayMs = image.duration / 1000;
          image.close();
        } catch {
          busy = false;
          if (!loaded) fail();
          return;
        }
        busy = false;
        if (cancelled) return;
        if (!loaded) {
          loaded = true;
          propsRef.current.onLoadEnd?.();
        }
        if (frames <= 1 || pausedRef.current) return;
        if (index === frames - 1 && !loopRef.current) return;
        timer = setTimeout(() => {
          index = (index + 1) % frames;
          void show();
        }, delayMs);
      };
      wakeRef.current = () => {
        if (!loaded || busy || timer !== undefined || pausedRef.current) return;
        if (index === frames - 1 && !loopRef.current) return;
        index = (index + 1) % frames;
        void show();
      };
      void show();
    };

    const playStill = () => {
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        upload(img, img.naturalWidth, img.naturalHeight);
        propsRef.current.onLoadEnd?.();
      };
      img.onerror = fail;
      img.src = url;
    };

    propsRef.current.onLoadStart?.();
    void openDecoder(url).then((d) => {
      if (cancelled) {
        d?.close();
        return;
      }
      decoder = d;
      if (d) playDecoded(d);
      else playStill();
    });

    return () => {
      cancelled = true;
      wakeRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      if (timer !== undefined) clearTimeout(timer);
      decoder?.close();
      img.onload = null;
      img.onerror = null;
      img.src = "";
      if (texture) scene.destroyTexture(texture);
      else if (source) scene.destroyTexture(source);
      scene.destroyMaterial(material);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return null;
}
