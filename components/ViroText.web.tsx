/**
 * Web implementation of ViroText — a text geometry rendered by the WASM font
 * pipeline (freetype + Roboto). Maps `text`, `style` (fontSize, color,
 * fontFamily, fontWeight, fontStyle), `width`/`height`, alignment, line-break,
 * clip, `maxLines`, `extrusionDepth` and `outerStroke` onto the renderer.
 *
 * The web carries Roboto only, as Android's sans-serif: a family it lacks draws
 * in Roboto at the requested weight and style.
 */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ViroTextHorizontalAlignment,
  ViroTextVerticalAlignment,
  ViroLineBreakMode,
  ViroTextClipMode,
  ViroTextOuterStroke,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { ViroParentNodeContext, useViroRenderer, useViroScene } from "./Web/ViroWebContext";
import { parseColorToRGBA } from "./Web/viroColor";
import { warnUnsupported } from "./Utilities/ViroUnsupported";

type Props = ViroWebNodeProps & {
  text: string;
  color?: string | number;
  width?: number;
  height?: number;
  maxLines?: number;
  textClipMode?: "None" | "ClipToBounds";
  textLineBreakMode?: "WordWrap" | "CharWrap" | "Justify" | "None";
  extrusionDepth?: number;
  outerStroke?: {
    type?: "None" | "Outline" | "DropShadow";
    width?: number;
    color?: string | number;
  };
  style?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    color?: string | number;
    textAlign?: "Left" | "Right" | "Center" | "left" | "right" | "center";
    textAlignVertical?: "Top" | "Bottom" | "Center" | "top" | "bottom" | "center";
  } & Record<string, unknown>;
  children?: React.ReactNode;
  [key: string]: any;
};

function hAlign(v?: string): ViroTextHorizontalAlignment {
  switch ((v ?? "").toLowerCase()) {
    case "right":
      return ViroTextHorizontalAlignment.Right;
    case "center":
      return ViroTextHorizontalAlignment.Center;
    default:
      return ViroTextHorizontalAlignment.Left;
  }
}
function vAlign(v?: string): ViroTextVerticalAlignment {
  switch ((v ?? "").toLowerCase()) {
    case "bottom":
      return ViroTextVerticalAlignment.Bottom;
    case "center":
      return ViroTextVerticalAlignment.Center;
    default:
      return ViroTextVerticalAlignment.Top;
  }
}
function lineBreak(v?: string): ViroLineBreakMode {
  switch (v) {
    case "CharWrap":
      return ViroLineBreakMode.CharWrap;
    case "Justify":
      return ViroLineBreakMode.Justify;
    case "None":
      return ViroLineBreakMode.None;
    default:
      return ViroLineBreakMode.WordWrap;
  }
}

/** As iOS's VRTText reads it: "normal", "bold", or "100" to "900". */
function fontWeight(v?: string | number): number {
  // The renderer draws whole hundreds; a number is taken to the nearest.
  if (typeof v === "number") return v >= 100 && v <= 900 ? Math.round(v / 100) * 100 : 400;
  const s = (v ?? "").toLowerCase();
  if (s === "bold") return 700;
  const n = Number(s);
  return s !== "" && n >= 100 && n <= 900 && n % 100 === 0 ? n : 400;
}
function strokeType(v?: string): ViroTextOuterStroke {
  switch ((v ?? "").toLowerCase()) {
    case "outline":
      return ViroTextOuterStroke.Outline;
    case "dropshadow":
      return ViroTextOuterStroke.DropShadow;
    default:
      return ViroTextOuterStroke.None;
  }
}

const REGULAR_FACE = "400|false";

export function ViroText(props: Props) {
  const {
    text,
    maxLines = 0,
    style,
  } = props;
  // Inside a ViroFlexView the layout decides the text box, as it does natively:
  // the block still wraps and clips to it, it just no longer sizes itself.
  const slot = useViroFlexSlot();
  const width = slot?.width ?? props.width ?? 1;
  const height = slot?.height ?? props.height ?? 1;

  const fontSize = style?.fontSize ?? 18;
  const colorValue = props.color ?? style?.color ?? "#ffffff";
  const clip = props.textClipMode === "None" ? ViroTextClipMode.None : ViroTextClipMode.ClipToBounds;

  const family = style?.fontFamily;
  const weight = fontWeight(style?.fontWeight);
  const italic = (style?.fontStyle ?? "").toLowerCase() === "italic";
  const extrusion = props.extrusionDepth ?? 0;
  const stroke = strokeType(props.outerStroke?.type);
  // iOS reads a missing width as 0, and 2 only when there is no outerStroke at all.
  const strokeWidth = props.outerStroke ? Math.trunc(props.outerStroke.width ?? 0) : 2;
  const strokeColor = props.outerStroke?.color ?? "#ffffff";
  // A family alone changes nothing on a web that carries only Roboto, so it
  // keeps the plain path, which every renderer version has.
  const renderer = useViroRenderer();
  const scene = useViroScene();
  const styled = weight !== 400 || italic || extrusion > 0.0001 || stroke !== ViroTextOuterStroke.None;
  const canStyle = typeof scene.createStyledText === "function" && scene.supportsTextStyle !== false;

  // A face other than the regular one is fetched the first time a text asks
  // for it; until then, or if it cannot be had, the text draws in the regular face.
  const face = `${weight}|${italic}`;
  const [loadedFace, setLoadedFace] = useState(REGULAR_FACE);
  useEffect(() => {
    if (face === REGULAR_FACE || !canStyle || typeof renderer.loadTextFace !== "function") return;
    let live = true;
    renderer.loadTextFace(weight, italic).then((ok) => {
      if (live && ok) setLoadedFace(face);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, face, canStyle]);
  const faceReady = face === REGULAR_FACE || loadedFace === face;
  if (styled && !canStyle) {
    warnUnsupported(
      "ViroText fontWeight, fontStyle, extrusionDepth and outerStroke",
      "this build of the web renderer",
      "Update @reactvision/viro-web-renderer.",
    );
  }

  // Recreate the geometry when any text-shaping input changes.
  const key = useMemo(
    () =>
      [
        text,
        width,
        height,
        fontSize,
        String(colorValue),
        style?.textAlign,
        style?.textAlignVertical,
        props.textLineBreakMode,
        props.textClipMode,
        maxLines,
        family,
        face,
        faceReady,
        extrusion,
        stroke,
        strokeWidth,
        String(strokeColor),
      ].join("|"),
    [text, width, height, fontSize, colorValue, style?.textAlign, style?.textAlignVertical, props.textLineBreakMode, props.textClipMode, maxLines, family, face, faceReady, extrusion, stroke, strokeWidth, strokeColor],
  );

  const node = useViroNode(
    // As on iOS, materials dress extruded text only: flat text draws its glyphs
    // with materials of its own.
    extrusion > 0.0001 ? props : { ...props, materials: undefined },
    (scene) => {
      const [r, g, b, a] = parseColorToRGBA(colorValue);
      const args = [
        text ?? "",
        width,
        height,
        fontSize,
        hAlign(style?.textAlign),
        vAlign(style?.textAlignVertical),
        lineBreak(props.textLineBreakMode),
        clip,
        maxLines,
        { r, g, b, a },
      ] as const;
      if (!styled || !canStyle) return scene.createText(...args);
      const [sr, sg, sb, sa] = parseColorToRGBA(strokeColor);
      return scene.createStyledText(...args, {
        typefaces: family,
        weight: faceReady ? weight : 400,
        italic: faceReady && italic,
        extrusion,
        stroke,
        strokeWidth,
        strokeColor: { r: sr, g: sg, b: sb, a: sa },
      });
    },
    true,
    // Rebuild the text geometry when shaping inputs change.
    key,
    undefined,
    undefined,
    extrusion > 0.0001,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
