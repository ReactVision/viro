import * as React from "react";
import { AppState, NativeModules, ViewProps } from "react-native";
import { ViroARSceneNavigator } from "./AR/ViroARSceneNavigator";
import { ViroSceneNavigator } from "./ViroSceneNavigator";
import { isQuest, isVisionOS } from "./Utilities/ViroPlatform";
import {
  enterImmersiveSpace,
  exitImmersiveSpace,
  ImmersiveSpaceStyle,
} from "./VisionOS/ViroVisionOSModule";
import { VRQuestNavigatorBridge } from "./Utilities/VRQuestNavigatorBridge";

const VRLauncher = NativeModules.VRLauncher as
  | { launchVRScene?: () => void }
  | undefined;

// Quest VR requires a lifecycle-correct VRActivity that drives
// ReactHostImpl.onHostResume(VRActivity) on entry. The skipActivityIdentity
// AssertionOnHostPause feature flag (used to suppress the racy MainActivity.
// onPause assertion when currentActivity has been promoted to VR) is only
// honored on RN >= 0.83. Without it, MainActivity.onPause hard-crashes via
// Assertions.assertCondition, so the entire VR path requires RN 0.83+.
// AR continues to work on RN >= 0.81 (Expo 54+) — only the Quest VR launch
// is gated.
const MIN_RN_FOR_VR = { major: 0, minor: 83 };

function checkRNVersionForVR(): void {
  let version = "unknown";
  try {
    version = require("react-native/package.json").version as string;
    const [maj, min] = version.split(".").map((n) => parseInt(n, 10));
    if (
      Number.isFinite(maj) &&
      Number.isFinite(min) &&
      (maj > MIN_RN_FOR_VR.major ||
        (maj === MIN_RN_FOR_VR.major && min >= MIN_RN_FOR_VR.minor))
    ) {
      return;
    }
  } catch {
    // fall through to throw with version="unknown"
  }
  throw new Error(
    `[Viro] Meta Quest VR requires React Native >= ${MIN_RN_FOR_VR.major}.${MIN_RN_FOR_VR.minor} ` +
      `(Expo SDK >= 55). Detected: ${version}. ` +
      `AR features still work on this version — only ViroXRSceneNavigator's VR path on Quest is gated.`
  );
}

type SceneFactory = { scene: () => React.JSX.Element };

type Props = ViewProps & {
  /**
   * Scene used on both AR and VR platforms when no platform-specific scene is provided.
   * Most apps want a different scene per platform — pass `arInitialScene` and
   * `vrInitialScene` instead in that case.
   */
  initialScene?: SceneFactory;

  /** Scene mounted on iOS / non-Quest Android (rendered via ViroARSceneNavigator). */
  arInitialScene?: SceneFactory;

  /**
   * Scene mounted on Meta Quest (rendered via ViroVRSceneNavigator in VRActivity).
   * On Quest, this scene is forwarded to VRActivity via VRQuestNavigatorBridge
   * rather than rendered inline, because OpenXR exclusive display requires the
   * VR intent category on the host Activity.
   *
   * The scene root may be either:
   *  - `ViroScene`   → fully-virtual VR.
   *  - `ViroARScene` → mixed reality: passthrough is enabled automatically and
   *    real-time plane detection (XR_EXT_plane_detection, Quest 3 / 3S) drives
   *    `onAnchorFound` and `ViroARPlane`, exactly as on phone AR. A single
   *    AR-rooted `initialScene` therefore runs on phones (ARCore) and Quest (OpenXR)
   *    with no per-platform changes. See docs/QUEST_SETUP.md §7b.
   */
  vrInitialScene?: SceneFactory;

  // ── Forwarded to ViroARSceneNavigator ──────────────────────────────────────
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
  autofocus?: boolean;
  videoQuality?: "High" | "Low";
  numberOfTrackedImages?: number;
  /** AR depth/people occlusion. Flows via ...rest to ViroARSceneNavigator. */
  occlusionMode?: "peopleOnly" | "depthBased";

  // ── Forwarded to ViroVRSceneNavigator (Quest path via bridge) ──────────────
  vrModeEnabled?: boolean;
  passthroughEnabled?: boolean;
  handTrackingEnabled?: boolean;
  onExitViro?: () => void;

  // ── visionOS ───────────────────────────────────────────────────────────────
  /**
   * Immersion style used when the ImmersiveSpace is opened on visionOS.
   *
   *  - `"mixed"` (default) — virtual content blended over passthrough. This is the
   *    closest analogue to phone AR, and the right default for a scene that expects
   *    to sit in the user's room.
   *  - `"full"` — fully virtual, passthrough hidden.
   *  - `"progressive"` — graduated immersion, dialled by the Digital Crown.
   *
   * Ignored on every other platform.
   */
  visionOSImmersionStyle?: ImmersiveSpaceStyle;

  // ── Common ─────────────────────────────────────────────────────────────────
  viroAppProps?: any;
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;
  debug?: boolean;
};

/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator` (rendered inline)
 *  - **Apple Vision Pro** → opens the visionOS ImmersiveSpace and renders the scene
 *    through `ViroSceneNavigator`. Unlike Quest, the ImmersiveSpace shares this
 *    React runtime, so the scene tree stays mounted here rather than being forwarded.
 *  - **Meta Quest** → launches VRActivity via `VRLauncher.launchVRScene()` and
 *    forwards all navigator operations (push/pop/etc.) to the
 *    `ViroVRSceneNavigator` running there via `VRQuestNavigatorBridge`.
 *    Render output is null — VRActivity owns the display.
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * `passthroughEnabled`, etc.) are forwarded to ViroVRSceneNavigator on Quest
 * via the intent bridge.
 */
export const ViroXRSceneNavigator = React.forwardRef<unknown, Props>(
  function ViroXRSceneNavigator(props, ref) {
    const {
      initialScene,
      arInitialScene,
      vrInitialScene,
      // VR-only renderer config — forwarded via bridge on Quest
      hdrEnabled,
      pbrEnabled,
      bloomEnabled,
      shadowsEnabled,
      multisamplingEnabled,
      vrModeEnabled,
      passthroughEnabled,
      handTrackingEnabled,
      onExitViro,
      debug,
      visionOSImmersionStyle = "mixed",
      ...rest
    } = props;

    // Inner ref used on the AR path to capture the ViroARSceneNavigator instance.
    const arRef = React.useRef<ViroARSceneNavigator>(null);
    // Same idea on visionOS, where the host is a ViroSceneNavigator instead.
    const visionRef = React.useRef<ViroSceneNavigator>(null);

    // Expose navigator interface on the ref.
    // Quest: proxy push/pop/etc. through VRQuestNavigatorBridge to VRActivity.
    // AR:    expose the underlying ViroARSceneNavigator instance directly.
    React.useImperativeHandle(ref, () => {
      if (isQuest) {
        const bridgeNav = {
          push:    (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "push",    scene }),
          replace: (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
          jump:    (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "jump",    scene }),
          pop:     ()           => VRQuestNavigatorBridge.dispatchOp({ type: "pop"              }),
          popN:    (n: number)  => VRQuestNavigatorBridge.dispatchOp({ type: "popN",   n       }),
        };
        return { sceneNavigator: bridgeNav, arSceneNavigator: bridgeNav };
      }
      if (isVisionOS) {
        // Expose the instance under both names, as the Quest branch does. Callers written for
        // the AR path reach for `arSceneNavigator` (Studio does), and there is no reason for
        // them to learn a third spelling just because the host underneath changed.
        const nav = visionRef.current as any;
        return { sceneNavigator: nav, arSceneNavigator: nav };
      }
      return arRef.current as any;
    }, []);

    // Track AppState so we can detect background → active transitions.
    const appStateRef = React.useRef(AppState.currentState);
    // Timestamp at which AppState last left "active". Lets us distinguish a
    // genuine Quest-menu return (background lasts seconds) from racy
    // background→active bounces caused by the dual-Activity ReactHost
    // transitioning state (background lasts <500ms). Only the former should
    // re-launch VR; the latter would trigger a no-op startActivity that can
    // contribute to the lifecycle storm in some configurations.
    const leftActiveAtRef = React.useRef(0);

    // On visionOS: open the ImmersiveSpace on mount and close it on unmount.
    //
    // This mirrors what the Quest branch does with VRActivity — in both cases something other
    // than the React view hierarchy owns the display. The difference is that VRActivity runs its
    // own React host, so Quest forwards the scene across a bridge and renders null here, whereas
    // the visionOS ImmersiveSpace shares this runtime: the scene tree below stays mounted, and
    // the native side hands its VRTScene to the CompositorServices render loop.
    React.useEffect(() => {
      if (!isVisionOS) return;
      let cancelled = false;
      enterImmersiveSpace(visionOSImmersionStyle).then((opened) => {
        if (!opened && !cancelled) {
          console.warn(
            "[Viro] Could not open the visionOS ImmersiveSpace. Check that the host app's " +
              "SwiftUI App declares `ImmersiveSpace(id: ViroImmersiveSpace.id)` and applies " +
              "`.viroImmersiveSpaceController()` to the React Native root view."
          );
        }
      });
      return () => {
        cancelled = true;
        exitImmersiveSpace();
      };
    }, []);

    // On Quest: register the intent (scene + renderer config) then launch VRActivity.
    // Also re-launch when the app returns from background (e.g. Quest system menu),
    // because VRActivity auto-finishes when MainActivity resumes.
    React.useEffect(() => {
      if (!isQuest) return;
      checkRNVersionForVR();
      const scene = vrInitialScene ?? initialScene;
      if (scene) {
        VRQuestNavigatorBridge.setIntent(scene, {
          hdrEnabled,
          pbrEnabled,
          bloomEnabled,
          shadowsEnabled,
          multisamplingEnabled,
          vrModeEnabled,
          passthroughEnabled,
          handTrackingEnabled,
          onExitViro,
          debug,
        });
      }
      VRQuestNavigatorBridge.setVRActive(true);
      VRLauncher?.launchVRScene?.();

      const sub = AppState.addEventListener("change", (nextState) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;
        if (prev === "active" && nextState !== "active") {
          leftActiveAtRef.current = Date.now();
        }
        // Re-launch VR when the app returns from being backgrounded by the system
        // (Quest menu, home, recents). Explicit exitVRScene() clears isVRActive()
        // before finishing VRActivity, so Activity-transition-driven background→active
        // cycles are ignored here.
        if (prev !== "active" && nextState === "active" && VRQuestNavigatorBridge.isVRActive()) {
          // Skip if we were only briefly out of "active" — that's a racy
          // dual-Activity ReactHost bounce, not a genuine menu return.
          const backgroundedFor = Date.now() - leftActiveAtRef.current;
          if (leftActiveAtRef.current > 0 && backgroundedFor < 1500) return;
          VRQuestNavigatorBridge.setVRActive(true);
          VRLauncher?.launchVRScene?.();
        }
      });
      return () => sub.remove();
    }, []);

    // Quest renders nothing here — VRActivity owns the display.
    if (isQuest) return null;

    if (isVisionOS) {
      // The visionOS renderer has no AR subsystem — every VROAR* class is excluded from the
      // xros build, so a ViroARScene root has no view manager and fails at mount with
      // "View config not found for component `VRTARScene`". The scene root has to be a plain
      // ViroScene, which is what the Quest VR scene already is, so `vrInitialScene` is the
      // right source and `arInitialScene` is deliberately not consulted.
      const visionScene = vrInitialScene ?? initialScene;
      if (!visionScene) {
        console.warn(
          "[Viro] ViroXRSceneNavigator on visionOS requires `vrInitialScene` or `initialScene`, " +
            "rooted in a ViroScene (not a ViroARScene)."
        );
        return null;
      }
      return (
        <ViroSceneNavigator
          ref={visionRef}
          initialScene={visionScene}
          {...rest}
        />
      );
    }

    const scene = arInitialScene ?? initialScene;
    if (!scene) {
      console.warn(
        "[Viro] ViroXRSceneNavigator requires `arInitialScene` or `initialScene`."
      );
      return null;
    }
    return (
      <ViroARSceneNavigator
        ref={arRef}
        initialScene={scene}
        {...rest}
      />
    );
  }
);
