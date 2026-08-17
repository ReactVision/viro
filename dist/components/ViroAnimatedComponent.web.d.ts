/**
 * Web implementation of ViroAnimatedComponent (deprecated). Injects its
 * `animation` into its single child via the child's `animation` prop — the
 * modern per-component animation path. Prefer setting `animation` directly on
 * the component.
 */
import * as React from "react";
type Props = {
    animation: string;
    delay?: number;
    loop?: boolean;
    run?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroAnimatedComponent(props: Props): React.ReactElement<any, string | React.JSXElementConstructor<any>>;
export {};
