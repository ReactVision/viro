/**
 * ViroBox
 *
 * A 3D box component with customizable dimensions and materials.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroBoxProps extends ViroCommonProps {
    width?: number;
    height?: number;
    length?: number;
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    highAccuracyEvents?: boolean;
}
/**
 * ViroBox is a 3D box component with customizable dimensions and materials.
 */
export declare const ViroBox: React.FC<ViroBoxProps>;
//# sourceMappingURL=ViroBox.d.ts.map