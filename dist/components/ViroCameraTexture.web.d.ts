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
export type { ViroCameraPosition, ViroCameraReadyEvent, ViroCaptureResult, ViroCapturePhotoOptions, ViroCaptureVideoOptions, } from "./ViroCameraTexture";
export declare class ViroCameraTexture extends React.Component<any> {
    render(): null;
}
