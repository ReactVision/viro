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
import { type ViroWebNodeProps } from "./Web/useViroNode";
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
export declare function ViroText(props: Props): React.JSX.Element;
export {};
