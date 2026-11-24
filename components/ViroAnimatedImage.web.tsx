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
 * read a GIF, the GIF is decoded here (viroGifDecoder), and any other file
 * shows as a still.
 *
 * As on native, `loop` (default true) decides whether the animation repeats,
 * whatever the file's own loop count, a delay of 0 plays as 100 ms, and paused
 * holds the current frame. The surface is sized, cropped and given a
 * placeholder by ViroImage's rules, as native's VRTAnimatedImage extends
 * VRTImage. Native draws no stereoMode here, so neither does this.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import { useEffect, useRef, useState } from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  ViroBlendMode,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { useViroScene } from "./Web/ViroWebContext";
import { decodeGif, isGif, type GifAnimation } from "./Web/viroGifDecoder";
import { resolveImageSource } from "./Web/viroImageLoader";
import { resolveSurface, useImagePlaceholder } from "./ViroImage.web";

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

type FrameImage = CanvasImageSource & TexImageSource;
type FrameSource = {
  frameCount: number;
  /** Hands frame `index` to `draw` and resolves with its delay in ms. */
  show(index: number, draw: (image: FrameImage, width: number, height: number) => void): Promise<number>;
  close(): void;
};

async function openImageDecoder(data: ArrayBuffer, type: string): Promise<FrameSource | null> {
  const Decoder = (globalThis as { ImageDecoder?: FrameDecoderClass }).ImageDecoder;
  if (!Decoder || !type) return null;
  let decoder: FrameDecoder | undefined;
  try {
    if (!(await Decoder.isTypeSupported(type))) return null;
    decoder = new Decoder({ data, type });
    // The frame count is final only once all the data is read and the tracks are known.
    await Promise.all([decoder.completed, decoder.tracks.ready]);
  } catch {
    decoder?.close();
    return null;
  }
  const d = decoder;
  return {
    frameCount: d.tracks.selectedTrack?.frameCount ?? 1,
    show: async (index, draw) => {
      const { image } = await d.decode({ frameIndex: index });
      try {
        draw(image, image.displayWidth, image.displayHeight);
        return image.duration ? image.duration / 1000 : 100;
      } finally {
        image.close();
      }
    },
    close: () => d.close(),
  };
}

function gifFrames(gif: GifAnimation): FrameSource | null {
  const canvas = document.createElement("canvas");
  canvas.width = gif.width;
  canvas.height = gif.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !gif.width || !gif.height) return null;
  return {
    frameCount: gif.frameCount,
    show: async (index, draw) => {
      ctx.putImageData(new ImageData(gif.render(index), gif.width, gif.height), 0, 0);
      draw(canvas, gif.width, gif.height);
      return gif.delays[index]!;
    },
    close: () => {},
  };
}

async function openFrames(url: string): Promise<FrameSource | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const data = await res.arrayBuffer();
    const bytes = new Uint8Array(data);
    let gif: GifAnimation | null = null;
    try {
      if (isGif(bytes)) gif = decodeGif(bytes);
    } catch {}
    const decoded = await openImageDecoder(data, type);
    if (!gif) return decoded;
    // A decoder that sees fewer frames than the file holds, or cannot decode the first, cannot play it.
    try {
      if (decoded && decoded.frameCount >= gif.frameCount) {
        await decoded.show(0, () => {});
        return decoded;
      }
    } catch {}
    decoded?.close();
    return gifFrames(gif);
  } catch {
    return null;
  }
}

type Props = ViroWebNodeProps & {
  source: unknown;
  width?: number;
  height?: number;
  resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
  imageClipMode?: "None" | "ClipToBounds";
  placeholderSource?: unknown;
  style?: { width?: number; height?: number } & Record<string, unknown>;
  paused?: boolean;
  loop?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function ViroAnimatedImage(props: Props): null {
  const scene = useViroScene();
  const slot = useViroFlexSlot();
  const widthProp = slot?.width ?? props.width ?? props.style?.width;
  const heightProp = slot?.height ?? props.height ?? props.style?.height;
  // The first frame's aspect, which only the load can supply.
  const [aspect, setAspect] = useState<number | null>(null);
  const { width, height, uv } = resolveSurface(
    widthProp ?? 1,
    heightProp ?? 1,
    widthProp !== undefined || heightProp !== undefined,
    props.resizeMode ?? "StretchToFill",
    props.resizeMode !== undefined,
    aspect,
    props.imageClipMode ?? "ClipToBounds",
  );
  const url = resolveImageSource(props.source);

  const geometryRef = useRef<ViroHandle>(0);
  const geometryKey = `${width}x${height}|${uv.join(",")}`;
  useViroNode(
    props,
    (s) => {
      const geo = s.createSurfaceUV(width, height, uv[0], uv[1], uv[2], uv[3]);
      geometryRef.current = geo;
      return geo;
    },
    true,
    geometryKey,
    undefined,
    undefined,
    false,
  );
  const imageShownRef = useImagePlaceholder(props, url, geometryRef, geometryKey);

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
    let player: FrameSource | null = null;
    const img = new Image();

    const upload = (frame: FrameImage, w: number, h: number) => {
      if (!texture && w > 0 && h > 0) setAspect(w / h);
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
        imageShownRef.current = true;
        appliedGeometry = geo;
      }
      rafId = requestAnimationFrame(applyToGeometry);
    };
    rafId = requestAnimationFrame(applyToGeometry);

    const fail = () => {
      if (!cancelled) propsRef.current.onError?.(new Error(`image failed: ${url}`));
    };

    const playFrames = (src: FrameSource) => {
      const frames = src.frameCount;
      let index = 0;
      let busy = false;
      let loaded = false;
      const show = async () => {
        timer = undefined;
        if (cancelled || busy) return;
        busy = true;
        let delayMs: number;
        try {
          delayMs = await src.show(index, (image, w, h) => {
            if (!cancelled) upload(image, w, h);
          });
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
    void openFrames(url).then((src) => {
      if (cancelled) {
        src?.close();
        return;
      }
      player = src;
      if (src) playFrames(src);
      else playStill();
    });

    return () => {
      cancelled = true;
      wakeRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      if (timer !== undefined) clearTimeout(timer);
      player?.close();
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
