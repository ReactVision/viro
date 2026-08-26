import type { ViroHandle } from "@reactvision/viro-web-renderer";
import { type ViroBaseTransform } from "./viroAnimationRegistry";
export interface ViroAnimationProp {
    name?: string;
    run?: boolean;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
}
export declare function useViroAnimation(node: ViroHandle, animation: ViroAnimationProp | undefined, base: ViroBaseTransform, ready: boolean): void;
