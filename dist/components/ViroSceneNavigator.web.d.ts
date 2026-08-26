/**
 * ViroSceneNavigator.web.tsx
 *
 * Web implementation of ViroSceneNavigator — the non-AR, multi-scene navigator.
 * Owns the <canvas> and the ViroWebRenderer (WASM host) exactly like
 * Viro3DSceneNavigator.web, and adds a real scene stack (push/pop/popN/jump/
 * replace) on top. Only the top-of-stack scene is mounted against the single
 * WASM scene root; navigating swaps which scene's children build C-API nodes.
 *
 * VR-specific surface has no web counterpart and is a graceful no-op:
 * `vrModeEnabled`, `onExitViro`, and `recenterTracking` do nothing on web
 * (there is no headset target). `project`/`unproject` are provided by the
 * renderer where available.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import { type ViroWebRendererOptions } from "@reactvision/viro-web-renderer";
type SceneDescriptor = {
    scene: React.ComponentType<any>;
    passProps?: any;
};
type Props = {
    initialScene: SceneDescriptor;
    initialSceneKey?: string;
    viroAppProps?: any;
    vrModeEnabled?: boolean;
    onExitViro?: () => void;
    webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
    [key: string]: any;
};
export declare function ViroSceneNavigator(props: Props): React.JSX.Element;
export {};
