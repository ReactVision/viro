/**
 * ViroLightingEnvironment
 *
 * A component for setting up environment-based lighting using HDR images.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroLightingEnvironmentProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    intensity?: number;
    rotation?: [number, number, number];
}
/**
 * ViroLightingEnvironment is a component for setting up environment-based lighting using HDR images.
 * It provides realistic lighting and reflections based on a 360-degree HDR environment map.
 */
export declare const ViroLightingEnvironment: React.FC<ViroLightingEnvironmentProps>;
