/**
 * ViroARObjectMarker.web.tsx
 *
 * Not implemented on web — 3D-object tracking has no counterpart in the
 * WASM/WebGL2 renderer yet. See ViroARImageMarker.web.tsx for why this stub
 * exists at all (the native file crashes the whole barrel import on web).
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

export class ViroARObjectMarker extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn("[Viro web] ViroARObjectMarker is not supported on web; rendering nothing.");
    }
    return null;
  }
}
