/**
 * ViroSpotLight
 *
 * A component for adding spot lighting to a scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSpotLightProps extends ViroCommonProps {
    color?: string;
    intensity?: number;
    temperature?: number;
    direction?: [number, number, number];
    innerAngle?: number;
    outerAngle?: number;
    attenuationStartDistance?: number;
    attenuationEndDistance?: number;
    influenceBitMask?: number;
    castsShadow?: boolean;
    shadowOpacity?: number;
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNearZ?: number;
    shadowFarZ?: number;
}
/**
 * ViroSpotLight is a component for adding spot lighting to a scene.
 * Spot light is a type of light that illuminates objects in a cone-shaped area,
 * similar to a flashlight or stage spotlight.
 */
export declare const ViroSpotLight: React.FC<ViroSpotLightProps>;
