/**
 * ViroCameraTexture.web.tsx
 *
 * Not implemented on web — camera-passthrough-as-texture has no counterpart
 * in the WASM/WebGL2 renderer yet. Exists so the platform-extension resolver
 * picks this over ViroCameraTexture.tsx on web, whose top-level
 * requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

// Type-only re-exports (erased at compile time) so other code importing these
// from "@reactvision/react-viro" still type-checks on web.
export type {
  ViroCameraPosition,
  ViroCameraReadyEvent,
  ViroCaptureResult,
  ViroCapturePhotoOptions,
  ViroCaptureVideoOptions,
} from "./ViroCameraTexture";

export class ViroCameraTexture extends React.Component<any> {
  render() {
    if (__DEV__) {
      console.warn("[Viro web] ViroCameraTexture is not supported on web; rendering nothing.");
    }
    return null;
  }
}
