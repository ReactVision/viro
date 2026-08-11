/**
 * ViroSceneNavigator.web.tsx
 *
 * Not implemented on web — this is the legacy Cardboard/GVR-era base scene
 * navigator; Viro3DSceneNavigator.web.tsx is the real web entry point for a
 * non-AR 3D scene (see that file for the actual WASM/WebGL2 wiring). This
 * stub exists only so the platform-extension resolver picks it over
 * ViroSceneNavigator.tsx on web, whose top-level requireNativeComponent()
 * call otherwise crashes the whole @reactvision/react-viro barrel import on
 * web the moment anything requires it.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export class ViroSceneNavigator extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn(
        "[Viro web] ViroSceneNavigator is not supported on web; use Viro3DSceneNavigator instead.",
      );
    }
    return null;
  }
}
