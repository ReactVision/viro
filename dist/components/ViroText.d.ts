import * as React from "react";
import { ColorValue } from "react-native";
import { ViroTextStyle } from "./Styles/ViroTextStyle";
import { ViroBase } from "./ViroBase";
type Props = {
    text: string;
    color?: ColorValue;
    extrusionDepth?: number;
    style?: ViroTextStyle;
    outerStroke?: {
        type?: "None" | "Outline" | "DropShadow";
        width?: number;
        color?: ColorValue;
    };
    maxLines?: number;
    textClipMode?: "None" | "ClipToBounds";
    textLineBreakMode?: "WordWrap" | "CharWrap" | "Justify" | "None";
};
/**
 * Used to render a ViroText
 */
export declare class ViroText extends ViroBase<Props> {
    render(): React.JSX.Element;
}
export {};
