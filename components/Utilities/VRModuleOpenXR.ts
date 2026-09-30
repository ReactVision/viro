import { useEffect, useState } from "react";
import { NativeModules } from "react-native";
import { VRQuestNavigatorBridge } from "./VRQuestNavigatorBridge";
import { ViroRecordingErrorConstants } from "../ViroConstants";

/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
export function exitVRScene(): void {
  VRQuestNavigatorBridge.setVRActive(false);
  (NativeModules.VRLauncher as { exitVRScene?: () => void } | undefined)
    ?.exitVRScene?.();
}

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
  takeScreenshot?: (
    viewTag: number,
    fileName: string,
    saveToCameraRoll: boolean
  ) => Promise<ViroCaptureResult>;
  startVideoRecording?: (
    viewTag: number,
    fileName: string,
    saveToCameraRoll: boolean,
    onError: (errorCode: number) => void
  ) => void;
  stopVideoRecording?: (viewTag: number) => Promise<ViroCaptureResult>;
  /** CL-H: publish this headset's frame to a Meta spatial anchor group. */
  rvCreateSharedFrame?: (viewTag: number, groupId: string) => Promise<VRSharedFrameResult>;
  /** CL-H: recover the frame another headset published to that group. */
  rvJoinSharedFrame?: (viewTag: number, groupId: string) => Promise<VRSharedFrameResult>;
  setPassthroughEnabled?: (viewTag: number, enabled: boolean) => void;
  setPassthroughStyle?: (
    viewTag: number,
    opacity: number,
    edgeR: number,
    edgeG: number,
    edgeB: number,
    edgeA: number
  ) => void;
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
export function setPassthroughStyle(
  viewTag: number,
  style: ViroPassthroughStyle
): void {
  const opacity = style.opacity ?? 1;
  const [r, g, b, a] = style.edgeColor ?? [0, 0, 0, 0];
  VRModuleOpenXR?.setPassthroughStyle?.(viewTag, opacity, r, g, b, a);
}

/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when not running on Meta Quest (no-op calls are safe via optional chaining).
 */
export const VRModuleOpenXR =
  (NativeModules.VRModuleOpenXR as VRModuleOpenXRType | undefined) ?? undefined;

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
export function useVRViewTag(): number | null {
  const [tag, setTag] = useState<number | null>(
    () => VRQuestNavigatorBridge.getViewTag()
  );
  useEffect(() => VRQuestNavigatorBridge.onViewTag(setTag), []);
  return tag;
}

function captureFailure(errorCode: number): ViroCaptureResult {
  return { success: false, url: null, errorCode };
}

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
export const VRCapture = {
  takeScreenshot(
    viewTag: number | null,
    fileName: string,
    saveToCameraRoll: boolean
  ): Promise<ViroCaptureResult> {
    const fn = VRModuleOpenXR?.takeScreenshot;
    if (typeof fn !== "function") {
      return Promise.resolve(
        captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)
      );
    }
    if (viewTag == null) {
      return Promise.resolve(
        captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY)
      );
    }
    return fn(viewTag, fileName, saveToCameraRoll);
  },

  startVideoRecording(
    viewTag: number | null,
    fileName: string,
    saveToCameraRoll: boolean,
    onError: (errorCode: number) => void
  ): void {
    const fn = VRModuleOpenXR?.startVideoRecording;
    if (typeof fn !== "function") {
      onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
      return;
    }
    if (viewTag == null) {
      onError?.(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY);
      return;
    }
    // Native invokes the callback on failure only; a caller without one still
    // records, it just cannot hear why a recording failed.
    fn(viewTag, fileName, saveToCameraRoll, onError ?? (() => {}));
  },

  stopVideoRecording(viewTag: number | null): Promise<ViroCaptureResult> {
    const fn = VRModuleOpenXR?.stopVideoRecording;
    if (typeof fn !== "function") {
      return Promise.resolve(
        captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)
      );
    }
    if (viewTag == null) {
      return Promise.resolve(
        captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY)
      );
    }
    return fn(viewTag);
  },
};

/**
 * The same three calls for a navigator that can never capture — the generic
 * ViroSceneNavigator, which visionOS and iOS VR host. They report
 * `RECORD_ERROR_UNSUPPORTED_PLATFORM` rather than leaving a scene written for
 * AR or Quest to call something undefined.
 */
export const unsupportedCapture = {
  takeScreenshot: (_fileName: string, _saveToCameraRoll: boolean): Promise<ViroCaptureResult> =>
    Promise.resolve(
      captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)
    ),
  startVideoRecording: (
    _fileName: string,
    _saveToCameraRoll: boolean,
    onError: (errorCode: number) => void
  ): void => {
    onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
  },
  stopVideoRecording: (): Promise<ViroCaptureResult> =>
    Promise.resolve(
      captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)
    ),
};
