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
 * The tracking engine is loaded as a classic <script> exposing a global
 * `SlamModule` factory (MODULARIZE + EXPORT_NAME='SlamModule'). That engine is
 * tinyvio, built through its platforms/slam drop-in C API — the name is the
 * interface's, not the implementation's, and keeping it is why this file did
 * not change when the engine did. Override via `loadSlam` for ESM setups.
 *
 * MVP scope: single scene; camera + 6-DoF pose tracking. Planes/hit-test are a
 * follow-up.
 */
import * as React from "react";
import { ViroArSession, type ViroWebRendererOptions, type ViroArSessionOptions } from "@reactvision/viro-web-renderer";
/** AR capture/tuning knobs forwarded to the ViroArSession. */
type ArOptions = Partial<Pick<ViroArSessionOptions, "captureWidth" | "captureHeight" | "facingMode" | "intrinsics" | "intrinsicsSize" | "tuning" | "showCameraBackground" | "detectPlanes" | "maxPlanes" | "renderWhileLimited" | "playback">>;
type Props = {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    viroAppProps?: any;
    /** WASM renderer asset-loading options (bundler/ESM). See Viro3DSceneNavigator.web. */
    webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
    /**
     * URL to the tracking engine's glue (tinyvio-slam.js), injected as a <script>.
     *
     * Optional. `@reactvision/viro-web-renderer` ships the engine, and that copy
     * is used when neither this nor `loadSlam` is given. Set this only to serve a
     * different build, or one hosted somewhere your bundler put it.
     */
    slamScriptUrl?: string;
    /** Override how the tracking-engine factory is obtained (e.g. an ESM import()). */
    loadSlam?: ViroArSessionOptions["loadSlam"];
    /** Capture/tuning options for tracking. */
    arOptions?: ArOptions;
    /**
     * Called once the AR session is running, with the session itself.
     *
     * For hosts that drive the session rather than only observe it — replaying a
     * recording means stepping frames by hand, which needs the session object.
     * Live hosts do not need this; the session is also on ViroARContext.
     */
    onSessionReady?: (session: ViroArSession) => void;
    /** Overlay label for the start button. */
    startLabel?: string;
    [key: string]: any;
};
export declare function ViroARSceneNavigator(props: Props): React.JSX.Element;
export {};
