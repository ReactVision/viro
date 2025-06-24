/**
 * ViroSkyBox
 *
 * A component for creating skybox environments.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSkyBoxProps extends ViroCommonProps {
    source: {
        nx: {
            uri: string;
        } | number;
        px: {
            uri: string;
        } | number;
        ny: {
            uri: string;
        } | number;
        py: {
            uri: string;
        } | number;
        nz: {
            uri: string;
        } | number;
        pz: {
            uri: string;
        } | number;
    };
    format?: "RGBA8" | "RGB565";
    isHdr?: boolean;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: string) => void;
}
/**
 * ViroSkyBox is a component for creating skybox environments.
 * It uses six cube faces to create an immersive 360-degree environment.
 */
export declare const ViroSkyBox: React.FC<ViroSkyBoxProps>;
//# sourceMappingURL=ViroSkyBox.d.ts.map