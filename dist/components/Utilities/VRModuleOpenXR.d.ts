/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
export declare function exitVRScene(): void;
/** What the native shared-frame calls resolve to. Never rejects — see the module. */
export type VRSharedFrameResult = {
    success: boolean;
    frameId?: string;
    /** Row-major 4x4 as CSV, the pose of the shared anchor in this device's space. */
    transform?: string;
    error?: string;
};
/**
 * What screenshot and stop-recording resolve to, on every navigator. `url` is
 * the local file path on success; `errorCode` is a
 * {@link ViroRecordingErrorConstants} value (`RECORD_ERROR_NONE` on success).
 */
export type ViroCaptureResult = {
    success: boolean;
    url?: string | null;
    errorCode: number;
};
export type VRModuleOpenXRType = {
    recenterTracking?: (viewTag: number) => void;
    /** Left-eye capture of the next frame. Resolves, never rejects. */
    takeScreenshot?: (viewTag: number, fileName: string, saveToCameraRoll: boolean) => Promise<ViroCaptureResult>;
    startVideoRecording?: (viewTag: number, fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
    stopVideoRecording?: (viewTag: number) => Promise<ViroCaptureResult>;
    /** CL-H: publish this headset's frame to a Meta spatial anchor group. */
    rvCreateSharedFrame?: (viewTag: number, groupId: string) => Promise<VRSharedFrameResult>;
    /** CL-H: recover the frame another headset published to that group. */
    rvJoinSharedFrame?: (viewTag: number, groupId: string) => Promise<VRSharedFrameResult>;
    setPassthroughEnabled?: (viewTag: number, enabled: boolean) => void;
    setPassthroughStyle?: (viewTag: number, opacity: number, edgeR: number, edgeG: number, edgeB: number, edgeA: number) => void;
};
/** Options for {@link setPassthroughStyle}. All channels are normalized [0,1]. */
export type ViroPassthroughStyle = {
    /** Texture opacity factor [0,1]. Default 1 (fully opaque passthrough). */
    opacity?: number;
    /** Edge-highlight colour [r,g,b,a]. Alpha 0 (default) disables the edge effect. */
    edgeColor?: [number, number, number, number];
};
/**
 * Style the Quest passthrough layer (XR_FB_passthrough). No-op off-Quest.
 *
 * ```tsx
 * const viewTag = useVRViewTag();
 * if (viewTag != null) {
 *   setPassthroughStyle(viewTag, { opacity: 0.8, edgeColor: [0, 1, 1, 1] });
 * }
 * ```
 */
export declare function setPassthroughStyle(viewTag: number, style: ViroPassthroughStyle): void;
/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when not running on Meta Quest (no-op calls are safe via optional chaining).
 */
export declare const VRModuleOpenXR: VRModuleOpenXRType | undefined;
/**
 * Returns the live viewTag of the ViroVRSceneNavigator running in VRActivity,
 * kept in sync via VRQuestNavigatorBridge.  null until ViroQuestEntryPoint has
 * mounted and published the tag.
 *
 * Use this inside VR scenes when you need to call VRModuleOpenXR methods:
 *
 * ```tsx
 * function MyVRScene() {
 *   const viewTag = useVRViewTag();
 *   const recenter = () => {
 *     if (viewTag != null) VRModuleOpenXR?.recenterTracking?.(viewTag);
 *   };
 *   return <ViroScene>...</ViroScene>;
 * }
 * ```
 */
export declare function useVRViewTag(): number | null;
/**
 * Screen capture on the Quest navigator, by view tag, with the same arguments
 * and results as ViroARSceneNavigator's. What the VR scene navigator and the
 * Quest branch of ViroXRSceneNavigator hand scenes as
 * `sceneNavigator.takeScreenshot` / `startVideoRecording` / `stopVideoRecording`.
 *
 * Off Quest (iOS, visionOS, Cardboard on Android) there is no VRModuleOpenXR
 * and every call reports `RECORD_ERROR_UNSUPPORTED_PLATFORM`. A null tag —
 * the VR scene has not mounted — reports `RECORD_ERROR_NOT_READY`, as native
 * does while the XR session has no swapchains.
 *
 * The capture is the left eye, sized to its swapchain. Passthrough is
 * composited by the OS beneath the app's layer, so a mixed-reality capture
 * holds the virtual content only, over black.
 */
export declare const VRCapture: {
    takeScreenshot(viewTag: number | null, fileName: string, saveToCameraRoll: boolean): Promise<ViroCaptureResult>;
    startVideoRecording(viewTag: number | null, fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void): void;
    stopVideoRecording(viewTag: number | null): Promise<ViroCaptureResult>;
};
/**
 * The same three calls for a navigator that can never capture — the generic
 * ViroSceneNavigator, which visionOS and iOS VR host. They report
 * `RECORD_ERROR_UNSUPPORTED_PLATFORM` rather than leaving a scene written for
 * AR or Quest to call something undefined.
 */
export declare const unsupportedCapture: {
    takeScreenshot: (_fileName: string, _saveToCameraRoll: boolean) => Promise<ViroCaptureResult>;
    startVideoRecording: (_fileName: string, _saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
    stopVideoRecording: () => Promise<ViroCaptureResult>;
};
