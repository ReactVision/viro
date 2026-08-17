/**
 * ViroController.web.tsx
 *
 * Not implemented on web — VR controller input has no counterpart in the
 * WASM/WebGL2 renderer yet (there's no VR headset target on web). Exists so
 * the platform-extension resolver picks this over ViroController.tsx on web,
 * whose top-level requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export class ViroController extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn("[Viro web] ViroController is not supported on web; rendering nothing.");
    }
    return null;
  }
}
