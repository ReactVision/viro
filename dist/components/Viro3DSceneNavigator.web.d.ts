/**
 * Web implementation of Viro3DSceneNavigator. Owns the <canvas> and the
 * ViroWebRenderer (WASM host), and provides the renderer + scene root node to
 * the component tree via context. Scenes render their children as C-API-backed
 * nodes rather than native views.
 *
 * MVP scope: renders the initial scene; multi-scene push/pop navigation is a
 * follow-up (the API surface is stubbed so scenes can mount).
 */
import * as React from "react";
import { type ViroWebRendererOptions } from "@reactvision/viro-web-renderer";
type Props = {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    viroAppProps?: any;
    /**
     * How to load the WASM renderer assets. Required under bundlers that rewrite
     * import.meta.url (e.g. Vite/webpack): pass importGlue + locateFile, or an
     * assetBaseUrl. Omit for direct-ESM hosting where the package self-resolves.
     */
    webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
    [key: string]: any;
};
export declare function Viro3DSceneNavigator(props: Props): React.JSX.Element;
export {};
