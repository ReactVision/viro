import { ViroLightType, type ViroHandle } from "@reactvision/viro-web-renderer";
export interface ViroWebLightProps {
    color?: string | number;
    intensity?: number;
    temperature?: number;
    direction?: [number, number, number];
    position?: [number, number, number];
    attenuationStartDistance?: number;
    attenuationEndDistance?: number;
    innerAngle?: number;
    outerAngle?: number;
    castsShadow?: boolean;
}
export declare function useViroLight(type: ViroLightType, props: ViroWebLightProps): ViroHandle;
