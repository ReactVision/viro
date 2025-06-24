/**
 * ViroAnimatedComponent
 *
 * A component wrapper for adding animations to Viro components.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroAnimatedComponentProps extends ViroCommonProps {
    animation?: {
        name?: string;
        delay?: number;
        loop?: boolean;
        onStart?: () => void;
        onFinish?: () => void;
        run?: boolean;
        interruptible?: boolean;
    };
    children?: React.ReactNode;
}
/**
 * ViroAnimatedComponent is a wrapper for adding animations to Viro components.
 * It provides animation capabilities to its children.
 */
export declare const ViroAnimatedComponent: React.FC<ViroAnimatedComponentProps>;
//# sourceMappingURL=ViroAnimatedComponent.d.ts.map