import { type ViroHandle, type ViroSceneApi } from "@reactvision/viro-web-renderer";
import { type ViroAnimationProp } from "./useViroAnimation";
type ViroPosition = [number, number, number];
export interface ViroWebNodeProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    opacity?: number;
    visible?: boolean;
    materials?: string | string[];
    onClick?: (position: ViroPosition, source: number) => void;
    onClickState?: (clickState: number, position: ViroPosition, source: number) => void;
    onHover?: (isHovering: boolean, position: ViroPosition, source: number) => void;
    animation?: ViroAnimationProp;
}
export declare function useViroNode(props: ViroWebNodeProps, createGeometry?: (scene: ViroSceneApi) => ViroHandle, animationReady?: boolean, geometryKey?: string | number, createNodeFn?: (scene: ViroSceneApi) => ViroHandle): ViroHandle;
export {};
