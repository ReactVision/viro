/**
 * Web implementation of ViroText — a text geometry rendered by the WASM font
 * pipeline (freetype + preloaded Helvetica). Maps `text`, `style` (fontSize,
 * color), `width`/`height`, alignment, line-break, clip and `maxLines` onto the
 * `viroCreateText` C API.
 *
 * MVP scope: single typeface (preloaded system font); custom `fontFamily`,
 * `extrusionDepth` and `outerStroke` are follow-ups.
 */
import * as React from "react";
import { useMemo } from "react";
import {
  ViroTextHorizontalAlignment,
  ViroTextVerticalAlignment,
  ViroLineBreakMode,
  ViroTextClipMode,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";
import { parseColorToRGBA } from "./Web/viroColor";

type Props = ViroWebNodeProps & {
  text: string;
  color?: string | number;
  width?: number;
  height?: number;
  maxLines?: number;
  textClipMode?: "None" | "ClipToBounds";
  textLineBreakMode?: "WordWrap" | "CharWrap" | "Justify" | "None";
  style?: {
    fontSize?: number;
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

export function ViroText(props: Props) {
  const {
    text,
    width = 1,
    height = 1,
    maxLines = 0,
    style,
  } = props;

  const fontSize = style?.fontSize ?? 18;
  const colorValue = props.color ?? style?.color ?? "#ffffff";
  const clip = props.textClipMode === "None" ? ViroTextClipMode.None : ViroTextClipMode.ClipToBounds;

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
      ].join("|"),
    [text, width, height, fontSize, colorValue, style?.textAlign, style?.textAlignVertical, props.textLineBreakMode, props.textClipMode, maxLines],
  );

  const node = useViroNode(
    props,
    (scene) => {
      const [r, g, b, a] = parseColorToRGBA(colorValue);
      return scene.createText(
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
      );
    },
    true,
    // Rebuild the text geometry when shaping inputs change.
    key,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
