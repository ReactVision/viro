/**
 * Web implementation of ViroButton — a ViroImage whose source swaps on
 * hover/click and forwards onClick. Mirrors native: hoverSource (a.k.a.
 * gazeSource) and clickSource (a.k.a. tapSource) fall back to `source`.
 */
import * as React from "react";
type Props = {
    source: unknown;
    hoverSource?: unknown;
    gazeSource?: unknown;
    clickSource?: unknown;
    tapSource?: unknown;
    width?: number;
    height?: number;
    onClick?: (position: [number, number, number], source: number) => void;
    [key: string]: any;
};
export declare function ViroButton(props: Props): React.JSX.Element;
export {};
