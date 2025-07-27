/**
 * ViroFlexView
 *
 * A component for creating flexible layouts in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroFlexViewProps extends ViroCommonProps {
    width?: number;
    height?: number;
    flex?: number;
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around";
    alignItems?: "flex-start" | "flex-end" | "center" | "stretch";
    padding?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    backgroundColor?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    materials?: string | string[];
    children?: React.ReactNode;
}
/**
 * ViroFlexView is a component for creating flexible layouts in 3D space.
 * It allows you to arrange child components using flexbox-like layout rules.
 */
export declare const ViroFlexView: React.FC<ViroFlexViewProps>;
