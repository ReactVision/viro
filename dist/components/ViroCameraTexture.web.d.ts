/**
 * ViroCameraTexture.web.tsx
 *
 * Web implementation of ViroCameraTexture — binds a live device-camera feed to
 * a registered material's diffuse channel. Any geometry using that material
 * name (e.g. a ViroQuad with materials={["selfieMat"]}) then shows the camera.
 * This mirrors the native behaviour: the component owns the camera texture and
 * writes it onto a named material; the material only needs a lightingModel.
 *
 * Reuses the per-frame upload pattern from ViroMaterialVideo / the AR camera
 * background: getUserMedia → hidden <video> → canvas → createTextureRGBA →
 * setMaterialTexture(Diffuse). Front camera is mirrored, matching native.
 *
 * The imperative capture API (capturePhoto / startRecording / stopRecording) is
 * exposed via a ref, same call sites as native. On web there is no filesystem
 * path, so `url` is a data: URL (photo) or an object URL (recording, webm), and
 * `outputPath` is ignored.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
export type { ViroCameraPosition, ViroCameraReadyEvent, ViroCaptureResult, ViroCapturePhotoOptions, ViroCaptureVideoOptions, } from "./ViroCameraTexture";
import type { ViroCameraPosition, ViroCaptureResult, ViroCapturePhotoOptions, ViroCaptureVideoOptions } from "./ViroCameraTexture";
type Props = {
    material: string;
    cameraPosition?: ViroCameraPosition;
    paused?: boolean;
    onCameraReady?: () => void;
    onError?: (event: {
        nativeEvent: {
            error: string;
        };
    }) => void;
    [key: string]: any;
};
/** Imperative handle exposed via ref — matches the native class methods. */
export interface ViroCameraTextureHandle {
    capturePhoto(options?: ViroCapturePhotoOptions): Promise<ViroCaptureResult>;
    startRecording(options?: ViroCaptureVideoOptions): Promise<ViroCaptureResult>;
    stopRecording(): Promise<ViroCaptureResult>;
}
export declare const ViroCameraTexture: React.ForwardRefExoticComponent<Omit<Props, "ref"> & React.RefAttributes<ViroCameraTextureHandle>>;
