/**
 * ViroARImageMarker.web.tsx
 *
 * Not implemented on web — image-marker tracking has no counterpart in the
 * WASM/WebGL2 renderer yet. This file exists purely so the platform-extension
 * resolver picks THIS instead of ViroARImageMarker.tsx on web: the native file
 * calls requireNativeComponent() at module scope with no web guard, which
 * crashes the entire @reactvision/react-viro barrel import on web the moment
 * anything requires it — not just when this component is actually used.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export class ViroARImageMarker extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn("[Viro web] ViroARImageMarker is not supported on web; rendering nothing.");
    }
    return null;
  }
}
