/**
 * Web implementation of Viro3DObject — loads a GLB/glTF/VRX/OBJ model into a
 * node. Fetches the model bytes, writes them to the WASM virtual FS, and invokes
 * the native loader. Transform props apply to the containing node.
 *
 * Model animations become available after load; drive them via ViroAnimations
 * (follow-up).
 *
 * OBJ is not self-contained: pass its .mtl through `resources`, along with every
 * texture that .mtl names. They are matched by basename, exactly as on native,
 * so the URLs may live anywhere as long as the final path segments match the
 * names inside the files.
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
