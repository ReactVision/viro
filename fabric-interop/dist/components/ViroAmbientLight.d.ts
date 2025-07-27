/**
 * ViroAmbientLight
 *
 * A component for adding ambient lighting to a scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroAmbientLightProps extends ViroCommonProps {
    color?: string;
    intensity?: number;
    temperature?: number;
    influenceBitMask?: number;
}
/**
 * ViroAmbientLight is a component for adding ambient lighting to a scene.
 * Ambient light is a type of light that illuminates all objects in the scene equally,
 * regardless of their position or orientation.
 */
export declare const ViroAmbientLight: React.FC<ViroAmbientLightProps>;
//# sourceMappingURL=ViroAmbientLight.d.ts.map