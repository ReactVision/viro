/**
 * ViroOmniLight
 *
 * A component for adding omnidirectional lighting to a scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroOmniLightProps extends ViroCommonProps {
    color?: string;
    intensity?: number;
    temperature?: number;
    attenuationStartDistance?: number;
    attenuationEndDistance?: number;
    influenceBitMask?: number;
}
/**
 * ViroOmniLight is a component for adding omnidirectional lighting to a scene.
 * Omni light is a type of light that illuminates objects in all directions
 * from a single point, similar to a light bulb.
 */
export declare const ViroOmniLight: React.FC<ViroOmniLightProps>;
