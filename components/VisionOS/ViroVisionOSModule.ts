/**
 * ViroVisionOSModule
 *
 * JavaScript API for controlling the visionOS ImmersiveSpace.
 * On iOS / Android the calls are no-ops (module returns false / resolves silently).
 *
 * ── Host-app setup required ──────────────────────────────────────────────────
 *
 * 1. Add the ImmersiveSpace to your SwiftUI App struct (visionOS only):
 *
 *    #if os(visionOS)
 *    import ViroReact
 *    #endif
 *
 *    @main struct MyApp: App {
 *      var body: some Scene {
 *        WindowGroup {
 *          ContentView()
 *            #if os(visionOS)
 *            .viroImmersiveSpaceController()
 *            #endif
 *        }
 *        #if os(visionOS)
 *        ImmersiveSpace(id: "ViroImmersive") {
 *          ViroImmersiveSpaceView()
 *        }
 *        .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
 *        #endif
 *      }
 *    }
 *
 * 2. Call from JavaScript:
 *
 *    import { ViroVisionOSModule } from '@reactvision/react-viro';
 *
 *    await ViroVisionOSModule.enterImmersiveSpace('mixed');
 *    // ... render Viro scene inside ImmersiveSpace ...
 *    await ViroVisionOSModule.exitImmersiveSpace();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NativeModules, Platform } from "react-native";

/**
 * Immersion styles Viro can present.
 *
 * "progressive" is absent on purpose. Declaring it on the ImmersiveSpace changes what
 * CompositorServices requires: presentation must then go through the drawable's render context,
 * and encodePresent — which this renderer uses — is rejected outright with "BUG IN CLIENT:
 * cannot present drawable: need to use drawable render context when supporting progressive
 * style", aborting the process seconds after the space opens. Supporting it means implementing
 * the render-context path first.
 */
export type ImmersiveSpaceStyle = "mixed" | "full";

/** @internal — raw NativeModule reference */
const { VRTVisionOSModule } = NativeModules;

/**
 * Returns true if the app is running on Apple Vision Pro (visionOS).
 * Uses the native module constant; falls back to Platform.isVision when
 * available (React Native 0.83+).
 */
export function isVisionOS(): boolean {
  // React Native 0.83+ exposes Platform.isVision on visionOS builds.
  if ((Platform as any).isVision === true) return true;
  // Fallback: check the native module constant.
  return VRTVisionOSModule?.isVisionOS === true;
}

/**
 * Opens the Viro ImmersiveSpace on visionOS.
 *
 * @param style  "mixed" (default) — virtual content blended over passthrough
 *               "full"  — fully virtual, passthrough hidden
 */
export async function enterImmersiveSpace(
  style: ImmersiveSpaceStyle = "mixed"
): Promise<boolean> {
  if (!VRTVisionOSModule) {
    if (__DEV__) {
      console.warn("[Viro] VRTVisionOSModule not available on this platform");
    }
    return false;
  }
  return VRTVisionOSModule.enterImmersiveSpace(style);
}

/**
 * Dismisses the Viro ImmersiveSpace and returns to the window layer.
 */
export async function exitImmersiveSpace(): Promise<boolean> {
  if (!VRTVisionOSModule) return false;
  return VRTVisionOSModule.exitImmersiveSpace();
}

/** Convenience object matching the typical NativeModules pattern. */
/** Live input tuning for the visionOS ray. All fields optional; omitted ones keep their value. */
export type ViroInputTuning = {
  /**
   * `"head"` (default) aims from between the eyes through the hand; `"finger"` aims along the
   * index finger. The finger ray inherits articulation noise — the joints move whenever the hand
   * does anything, and hardest as a pinch begins — so `"head"` is steadier and matches how people
   * physically point.
   */
  rayOrigin?: "head" | "finger";
  /** 0 disables filtering, 1 is heavy. Applies to the live ray only, never to the frozen aim. */
  smoothing?: number;
  /** Radians the ray must move off a hovered target before hover is dropped. */
  hoverHysteresis?: number;
  /** Angular radius, in radians, of the cone used when the ray itself misses.
   *  A zero-width ray demands more precision than hand tracking can give; this
   *  gives small targets a tolerance without changing a precise aim, which is
   *  always tried first. 0 disables it. Default 0.03 (~1.7°). */
  coneAngle?: number;
};

/**
 * Adjusts how the visionOS ray behaves, while the ImmersiveSpace is open.
 *
 * Exists to be called from JavaScript during a session: these numbers can only be judged with a
 * headset on, and a native rebuild is ten minutes. No-op on every other platform.
 */
export function setInputTuning(tuning: ViroInputTuning): void {
  VRTVisionOSModule?.setInputTuning?.(tuning);
}

export const ViroVisionOSModule = {
  isVisionOS,
  enterImmersiveSpace,
  exitImmersiveSpace,
} as const;

// ─── Shared coordinate space (CL-I) ──────────────────────────────────────────

/** State of the visionOS shared coordinate space. */
export type ViroSharedSpaceState = {
  /** False when this device cannot join a shared coordinate space at all. */
  supported: boolean;
  /** True once ARKit has aligned this device with at least one other. */
  sharing: boolean;
  /** Participants aligned to the space, excluding this device. */
  participants: number;
};

const NOT_SUPPORTED: ViroSharedSpaceState = {
  supported: false,
  sharing: false,
  participants: 0,
};

/**
 * Current shared-space state.
 *
 * Unlike a cloud anchor or a Meta spatial anchor, there is no frame to locate
 * here: ARKit aligns the **world origin itself**, so once `sharing` is true,
 * world coordinates already mean the same thing on every participant.
 */
export async function sharedSpaceState(): Promise<ViroSharedSpaceState> {
  if (!VRTVisionOSModule?.sharedSpaceState) return NOT_SUPPORTED;
  return VRTVisionOSModule.sharedSpaceState();
}

/**
 * Alignment data to deliver to the other participants, base64-encoded, or null
 * when there is nothing new to send.
 *
 * ARKit does not move this data itself — it emits blobs and expects them
 * delivered, by any transport. Poll this and ship whatever it returns; the
 * receiving device passes it to {@link sharedSpacePushIncoming}. Until both
 * sides do that, `sharing` never becomes true.
 */
export async function sharedSpaceNextOutgoing(): Promise<string | null> {
  if (!VRTVisionOSModule?.sharedSpaceNextOutgoing) return null;
  return VRTVisionOSModule.sharedSpaceNextOutgoing();
}

/** Hand ARKit base64 alignment data received from another participant. */
export async function sharedSpacePushIncoming(base64: string): Promise<boolean> {
  if (!VRTVisionOSModule?.sharedSpacePushIncoming) return false;
  return VRTVisionOSModule.sharedSpacePushIncoming(base64);
}
