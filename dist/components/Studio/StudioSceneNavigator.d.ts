import * as React from "react";
import { ViewStyle } from "react-native";
import type { StudioColocationOptions, StudioColocationRoom, StudioColocationState } from "./colocation/types";
import { StudioSceneResponse } from "./types";
/** Imperative handle exposed via ref. */
export interface StudioSceneNavigatorHandle {
    /**
     * Screenshots the renderer. On Meta Quest it captures the left eye, without
     * the passthrough room, and resolves `errorCode` 7 (`RECORD_ERROR_NOT_READY`)
     * until the VR scene is rendering.
     */
    takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<{
        success: boolean;
        url?: string;
        errorCode?: string;
    }>;
    /** Leave the shared session; the current `colocation` value stays left. */
    leaveColocation: () => void;
    /**
     * Start the current `colocation` value's session again after it failed or
     * was left. Re-rendering with an equal value never restarts it. False, and
     * nothing changes, while a session is running or no value is set.
     */
    retryColocation: () => boolean;
    getColocationRoom: () => StudioColocationRoom | null;
    /**
     * Host: end the scan and host it, as the indicator's Done button does. Only
     * once the scan covers enough (`canFinish` in the `scanning` state): true
     * when the scan ended, false, changing nothing, before then or outside a scan.
     */
    finishColocationScan: () => boolean;
}
export interface StudioSceneNavigatorProps {
    /**
     * UUID of a specific scene to load. If omitted, the navigator fetches the
     * project configured in the app manifest and uses its opening scene.
     */
    sceneId?: string;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    autofocus?: boolean;
    style?: ViewStyle;
    onSceneReady?: () => void;
    onError?: (err: Error) => void;
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    onExitViro?: () => void;
    /** Fired after the scene is fetched and parsed, before it is pushed. */
    onSceneLoaded?: (sceneData: StudioSceneResponse) => void;
    /** Threaded to the initial scene's StudioARScene (initial scene only). */
    onPlaneDetected?: () => void;
    onPlaneSelected?: () => void;
    /**
     * Web only, where AR tracks from the browser's motion sensors: called when
     * the viewer denied motion access or no motion events arrive. Accepted here
     * so one set of props types on both, and never called on native, where the
     * AR session reads the IMU itself.
     */
    onMotionUnavailable?: (reason: "denied" | "no-events") => void;
    noAssetsMessage?: string;
    /**
     * Opt-in overlay shown until the scene mounts. Omit to render nothing on AR
     * during load (the camera feed); Quest falls back to a built-in spinner.
     */
    loadingView?: React.ReactNode;
    /**
     * Opt-in UI for a failed scene load or a caught render error. `onError` is
     * always called either way; when this is omitted it renders nothing, and a
     * load failure leaves the loading overlay in place.
     *
     * `retry` refetches the scene on the load path, or re-mounts the scene tree
     * on the render path. Errors from a load are StudioApiError, so branch on
     * `code` rather than matching the message.
     */
    renderError?: (error: Error, retry: () => void) => React.ReactNode;
    /**
     * Show the built-in "recording" indicator (a REC pill) while a RECORD_VIDEO
     * action is recording. Default true, positioned top-centre with an approximate
     * safe-area inset. Set false if the host draws its own top-of-screen chrome
     * there and renders `<StudioRecordingIndicator />` (or a custom UI via
     * `useStudioRecording()`) itself.
     */
    recordingIndicator?: boolean;
    /**
     * Show the built-in tap-to-place prompt (a "Tap a surface to place …" pill)
     * while a mobile AR asset awaits placement. Default true, positioned top-centre
     * with an approximate safe-area inset. Set false if the host draws its own
     * top-of-screen chrome there and renders `<StudioPlacementIndicator />` (or a
     * custom UI via `useStudioPlacement()`) itself.
     */
    placementIndicator?: boolean;
    /**
     * Share the scene with other devices in the same physical space. `host` scans
     * the space and creates a room with a join code; `join` looks a code up and
     * aligns to the host's space. Absent, the scene renders alone exactly as
     * before, and changing it to absent leaves the room. One session runs per
     * distinct value: re-rendering with an equal value changes nothing.
     *
     * Content is withheld while the session is set up and then renders where the
     * host placed it on every device. A joiner that is aligned and connected
     * before the host has placed the scene reports `waiting_for_host`. If the
     * session fails, the scene renders alone again and `onColocationStateChange`
     * reports why; `connectTimeoutMs` bounds the wait for the room once the
     * frame is known (`CONNECT_TIMEOUT`, `HOST_TIMEOUT`).
     *
     * Variables, visibility and tap-to-place positions are shared, the last
     * write winning; a device that joins or reconnects takes the room's copy
     * over its own. A drag is shared while it runs: the device dragging an
     * asset holds it, and nobody else can drag it until that drag ends.
     * Animation triggers and sounds play on every device, while the function
     * that caused them runs on one, so nothing it changes is applied twice. A
     * NAVIGATE on any device takes every device to that scene, and the devices
     * that follow do not run its on_load function; a device that joins on
     * another scene moves to the room's. A scene outside the session's project
     * is not entered, and is reported as one that failed to load.
     * Collision bindings run on one device: the host while it is connected,
     * and otherwise the connected device with the lowest peer id, so they keep
     * running when the host leaves. The exception is image-triggered
     * content, which sits on each device's own marker and runs its bindings and
     * drags there; the sounds and animations those bindings cause, including
     * what those animations' on_start and on_finish play, stay on that device.
     * Gaze and proximity run on each device against its own camera, and what
     * they change is shared.
     * Physics simulates on each device, so a dynamic body nobody is dragging can
     * come to rest in different places on different devices.
     *
     * A Meta Quest host shares a Meta spatial anchor instead of scanning, and the
     * scene sits on that anchor rather than on a surface. Rooms do not cross
     * device families: one hosted from a phone is joined from phones, and one
     * hosted from a Quest from Quest headsets; the other family's join fails
     * with `FRAME_KIND_UNSUPPORTED`.
     *
     * On Quest the scene on screen roots in ViroARScene while a session is set
     * up or shared, and in ViroScene otherwise. Changing the root remounts the
     * whole scene, so a sound that is playing starts again from the beginning
     * when a session starts after the scene mounted, and again when a session
     * ends or fails. Set this before the scene mounts to avoid the first.
     */
    colocation?: StudioColocationOptions;
    /**
     * Show the built-in co-location pill (scan guidance and a Done button, then
     * the join code and peer count). Default true, positioned bottom-centre. Set
     * false and render `<StudioColocationIndicator />` (or a custom UI via
     * `useStudioColocation()`) in the host's own chrome. On Quest the status and
     * the join code also show in the scene's head-locked HUD either way, since
     * nothing 2D is visible from inside the headset.
     */
    colocationIndicator?: boolean;
    onColocationStateChange?: (state: StudioColocationState) => void;
    /** Once per room: when the host has its code, or when a joiner is in. */
    onColocationRoom?: (room: StudioColocationRoom) => void;
}
/**
 * Cross-reality Studio scene navigator. Renders a Studio-authored scene on
 * both AR devices (iOS / non-Quest Android) and Meta Quest (VR).
 *
 * Opening-scene resolution order:
 *   1. `sceneId` prop → use it directly
 *   2. Native project (RVProjectId from manifest) → use `opening_scene.id`
 *   3. Fallback → first scene in the project's scene list
 *
 * On Quest, ViroXRSceneNavigator is not rendered until the scene data is
 * ready. This means VRActivity always launches with the actual content scene
 * as its initial scene, avoiding the LoadingVRScene → replace timing race.
 */
export declare const StudioSceneNavigator: React.ForwardRefExoticComponent<StudioSceneNavigatorProps & React.RefAttributes<StudioSceneNavigatorHandle>>;
