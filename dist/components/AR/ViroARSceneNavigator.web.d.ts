/**
 * Web implementation of ViroARSceneNavigator. Owns the <canvas> + ViroWebRenderer
 * (WASM host, virocore) and drives a ViroArSession which runs slam-wasm to track
 * the device and inject poses into the renderer. Scenes render their children as
 * C-API-backed nodes via context, exactly like Viro3DSceneNavigator.web.
 *
 * Web AR needs a user gesture: getUserMedia and (on iOS Safari) DeviceMotion
 * permission can only be requested from a tap. So we render a "Start AR" overlay
 * and begin tracking on tap.
 *
 * slam-wasm is loaded as a classic <script> exposing a global `SlamModule`
 * factory (matches the slam web build: MODULARIZE + EXPORT_NAME='SlamModule').
 * Override via the `loadSlam` prop for bundler/ESM setups.
 *
 * MVP scope: single scene; camera + 6-DoF pose tracking. Planes/hit-test are a
 * follow-up.
 */
import * as React from "react";
import { type ViroWebRendererOptions, type ViroArSessionOptions } from "@reactvision/viro-web-renderer";
/** AR capture/tuning knobs forwarded to the ViroArSession. */
type ArOptions = Partial<Pick<ViroArSessionOptions, "captureWidth" | "captureHeight" | "facingMode" | "intrinsics" | "tuning" | "showCameraBackground" | "detectPlanes" | "maxPlanes" | "renderWhileLimited">>;
type Props = {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    viroAppProps?: any;
    /** WASM renderer asset-loading options (bundler/ESM). See Viro3DSceneNavigator.web. */
    webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
    /**
     * URL to the slam-wasm glue (slam_wasm.js). Injected as a <script>; the build
     * exposes a global `SlamModule` factory. Ignored if `loadSlam` is provided.
     */
    slamScriptUrl?: string;
    /** Override how the slam-wasm factory is obtained (e.g. an ESM import()). */
    loadSlam?: ViroArSessionOptions["loadSlam"];
    /** Capture/tuning options for tracking. */
    arOptions?: ArOptions;
    /** Overlay label for the start button. */
    startLabel?: string;
    [key: string]: any;
};
export declare function ViroARSceneNavigator(props: Props): React.JSX.Element;
export {};
