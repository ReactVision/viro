/**
 * ViroVRSceneNavigator.web.tsx
 *
 * Not implemented on web — there's no VR/Cardboard headset target for the
 * WASM/WebGL2 renderer. Exists so the platform-extension resolver picks this
 * over ViroVRSceneNavigator.tsx on web, whose top-level
 * requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
export declare class ViroVRSceneNavigator extends React.Component<any> {
    render(): null;
}
