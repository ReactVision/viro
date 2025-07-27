/**
 * ViroDirectionalLight
 *
 * A component for adding directional lighting to a scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroDirectionalLightProps extends ViroCommonProps {
    color?: string;
    intensity?: number;
    temperature?: number;
    direction?: [number, number, number];
    influenceBitMask?: number;
    castsShadow?: boolean;
    shadowOpacity?: number;
    shadowOrthographicSize?: number;
    shadowOrthographicPosition?: [number, number, number];
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNearZ?: number;
    shadowFarZ?: number;
}
/**
 * ViroDirectionalLight is a component for adding directional lighting to a scene.
 * Directional light is a type of light that illuminates all objects in the scene
 * from a specific direction, similar to sunlight.
 */
export declare const ViroDirectionalLight: React.FC<ViroDirectionalLightProps>;
//# sourceMappingURL=ViroDirectionalLight.d.ts.map