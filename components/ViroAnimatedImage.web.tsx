/**
 * ViroAnimatedImage.web.tsx
 *
 * Not implemented on web — animated GIF/APNG playback via a native decoder
 * has no counterpart in the WASM/WebGL2 renderer yet. Exists so the
 * platform-extension resolver picks this over ViroAnimatedImage.tsx on web,
 * whose top-level requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export class ViroAnimatedImage extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn("[Viro web] ViroAnimatedImage is not supported on web; rendering nothing.");
    }
    return null;
  }
}
