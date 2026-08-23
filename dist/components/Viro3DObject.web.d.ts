/**
 * Web implementation of Viro3DObject — loads a GLB/glTF/VRX model into a node.
 * Fetches the model bytes, writes them to the WASM virtual FS, and invokes the
 * native loader. Transform props apply to the containing node.
 *
 * Model animations become available after load; drive them via ViroAnimations
 * (follow-up). OBJ and external-resource glTF are not supported yet.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
import type { ViroAnimationProp } from "./Web/useViroAnimation";
type Props = ViroWebNodeProps & {
    source: unknown;
    type?: string;
    resources?: unknown[];
    animation?: ViroAnimationProp;
    onLoadStart?: () => void;
    onLoadEnd?: (success?: boolean) => void;
    onError?: (error: unknown) => void;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function Viro3DObject(props: Props): React.JSX.Element;
export {};
