import * as React from "react";
import {
  AppState,
  NativeModules,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
} from "react-native";
import { ViroARSceneNavigator } from "./AR/ViroARSceneNavigator";
import { ViroSceneNavigator } from "./ViroSceneNavigator";
import { isQuest, isVisionOS } from "./Utilities/ViroPlatform";
import {
  beginSceneRootScan,
  claimImmersiveSpace,
  ownsImmersiveSpace,
  releaseImmersiveSpace,
  scheduleImmersiveSpaceExit,
  sawARSceneRoot,
} from "./VisionOS/ViroImmersiveSpaceGate";
import {
  enterImmersiveSpace,
  exitImmersiveSpace,
  ImmersiveSpaceStyle,
} from "./VisionOS/ViroVisionOSModule";
import { VRQuestNavigatorBridge } from "./Utilities/VRQuestNavigatorBridge";
import { VRCapture, VRModuleOpenXR } from "./Utilities/VRModuleOpenXR";
import type { Viro3DPoint } from "./Types/ViroUtils";

const ViroSceneNavigatorModule = NativeModules.VRTSceneNavigatorModule as
  | {
      project: (tag: number, point: Viro3DPoint) => Promise<any>;
      unproject: (tag: number, point: Viro3DPoint) => Promise<any>;
    }
  | undefined;

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

// Declared in the manifest by withViroAndroid.ts, but Horizon OS treats these
// as dangerous runtime permissions — the manifest entry alone doesn't grant
// them. USE_ANCHOR_API/USE_SCENE gate plane & anchor data (needed now that the
// ViroARScene root mounts on Quest too); HEADSET_CAMERA gates the passthrough
// Camera2 feed ViroObjectDetector reads. Requested once before the first VR
// launch, as questPermissions picks; denial degrades gracefully elsewhere (no
// planes / no passthrough feed, see QuestPassthroughCamera) rather than
// blocking VR.
export type QuestRuntimePermission = "spatialData" | "headsetCamera";
const QUEST_RUNTIME_PERMISSIONS: Record<QuestRuntimePermission, string[]> = {
  spatialData: [
    "horizonos.permission.USE_ANCHOR_API",
    "com.oculus.permission.USE_SCENE",
  ],
  headsetCamera: ["horizonos.permission.HEADSET_CAMERA"],
};
const DEFAULT_QUEST_PERMISSIONS: QuestRuntimePermission[] = [
  "spatialData",
  "headsetCamera",
];

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

function launchVR(): void {
  VRQuestNavigatorBridge.setVRActive(true);
  VRLauncher?.launchVRScene?.();
}

/** The default `renderQuestPanel`. */
function QuestPanel({
  onEnter,
  style,
}: {
  onEnter: () => void;
  style?: ViewProps["style"];
}) {
  return (
    <View style={[styles.questPanel, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onEnter}
        style={({ pressed }) => [
          styles.questEnterButton,
          pressed && styles.questEnterButtonPressed,
        ]}
      >
        <Text style={styles.questEnterLabel}>Enter immersive view</Text>
      </Pressable>
    </View>
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
   *    planes drive `onAnchorFound` and `ViroARPlane` as on phone AR. On Meta
   *    Quest the planes are the room model the wearer made in Space Setup
   *    (XR_FB_scene) rather than live detection, and arrive only with the
   *    spatial data permission (`questPermissions`). A runtime with
   *    XR_EXT_plane_detection detects them live instead. A single AR-rooted
   *    `initialScene` therefore runs on phones (ARCore) and Quest (OpenXR)
   *    with no per-platform changes.
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

  // ── Meta Quest panel ───────────────────────────────────────────────────────
  /**
   * What the app's 2D panel shows on Meta Quest, where the scene runs in the
   * headset view instead. Horizon OS brings the panel forward whenever the
   * headset view closes: the Back button, quitting from the system menu, going
   * Home or opening another app's panel. The headset view is not reopened on
   * its own, because none of those can be told apart here from the wearer
   * reopening the app. Call `enter` to reopen it. Defaults to an "Enter
   * immersive view" button.
   */
  renderQuestPanel?: (enter: () => void) => React.ReactNode;
  /**
   * The Meta Quest runtime permissions asked for before the headset view first
   * opens: "spatialData" for the room's planes and anchors, "headsetCamera" for
   * the passthrough feed ViroObjectDetector reads. Horizon OS skips a permission
   * the manifest does not declare, so ask only for what the app declares and
   * uses; [] asks for nothing. Defaults to both.
   */
  questPermissions?: QuestRuntimePermission[];

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
 *    VRActivity owns the display; what renders here is the app's 2D panel
 *    (`renderQuestPanel`).
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * Screen capture is on the same `sceneNavigator` everywhere:
 * `takeScreenshot(fileName, saveToCameraRoll)` and `stopVideoRecording()`
 * resolve `{ success, url, errorCode }`, and `startVideoRecording(fileName,
 * saveToCameraRoll, onError)` reports failures to `onError`. On Quest the
 * ref's `sceneNavigator` and the scene's own forward to VRModuleOpenXR, which
 * captures the left eye without the passthrough room and reports
 * `RECORD_ERROR_NOT_READY` until the XR session is rendering. visionOS has
 * no capture, and reports `RECORD_ERROR_UNSUPPORTED_PLATFORM`.
 *
 * `multisamplingEnabled`) reach ViroARSceneNavigator as props and
 * ViroVRSceneNavigator on Quest via the intent bridge. visionOS gets neither:
 * ViroSceneNavigator does not take them. `passthroughEnabled`, `vrModeEnabled`
 * and `handTrackingEnabled` are Quest-only and go over the bridge alone.
 */
export const ViroXRSceneNavigator = React.forwardRef<unknown, Props>(
  function ViroXRSceneNavigator(props, ref) {
    // Opens the scan the mount effect reads. Here rather than in an effect because a parent
    // renders before its children: this has to run before the scene root does.
    if (isVisionOS) beginSceneRootScan();

    const {
      initialScene,
      arInitialScene,
      vrInitialScene,
      // Renderer config. Destructured because Quest forwards it over the intent
      // bridge rather than as props; the AR branch passes it on by hand below,
      // and leaving it out of that list is how the AR path silently lost every
      // one of these.
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
      renderQuestPanel,
      questPermissions = DEFAULT_QUEST_PERMISSIONS,
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
        // project/unproject/recenterTracking can't go through dispatchOp — that
        // queue is fire-and-forget (push/pop/etc. have no return value), while
        // these three need a result back. Instead they reuse the same viewTag
        // handoff VRQuestNavigatorBridge already publishes for VRModuleOpenXR:
        // both activities share one Fabric UIManager, so a tag captured in
        // VRActivity resolves fine from a native module call made here in the
        // panel. recenterTracking goes through VRModuleOpenXR (Quest-specific,
        // already used this way elsewhere); project/unproject reuse the generic
        // VRTSceneNavigatorModule, which already resolves views by raw tag.
        const requireViewTag = (): number => {
          const tag = VRQuestNavigatorBridge.getViewTag();
          if (tag == null) {
            throw new Error(
              "[Viro] Quest VR scene not mounted yet — call this after the VR scene is active."
            );
          }
          return tag;
        };
        const bridgeNav = {
          push:    (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "push",    scene }),
          replace: (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
          jump:    (scene: any) => VRQuestNavigatorBridge.dispatchOp({ type: "jump",    scene }),
          pop:     ()           => VRQuestNavigatorBridge.dispatchOp({ type: "pop"              }),
          popN:    (n: number)  => VRQuestNavigatorBridge.dispatchOp({ type: "popN",   n       }),
          recenterTracking: () => VRModuleOpenXR?.recenterTracking?.(requireViewTag()),
          // async so a missing viewTag rejects the returned promise instead of
          // throwing synchronously — callers doing `nav.project(p).catch(...)`
          // without awaiting still get the rejection.
          project: async (point: Viro3DPoint) =>
            ViroSceneNavigatorModule?.project(requireViewTag(), point),
          unproject: async (point: Viro3DPoint) =>
            ViroSceneNavigatorModule?.unproject(requireViewTag(), point),
          // Screen capture, with ViroARSceneNavigator's signatures and results.
          // VRModuleOpenXR again, for the reason given for the shared frame
          // below. They resolve (or call onError) with RECORD_ERROR_NOT_READY
          // before the VR scene has mounted, rather than throwing.
          takeScreenshot: (fileName: string, saveToCameraRoll: boolean) =>
            VRCapture.takeScreenshot(VRQuestNavigatorBridge.getViewTag(), fileName, saveToCameraRoll),
          startVideoRecording: (
            fileName: string,
            saveToCameraRoll: boolean,
            onError: (errorCode: number) => void
          ) =>
            VRCapture.startVideoRecording(
              VRQuestNavigatorBridge.getViewTag(),
              fileName,
              saveToCameraRoll,
              onError
            ),
          stopVideoRecording: () =>
            VRCapture.stopVideoRecording(VRQuestNavigatorBridge.getViewTag()),
          // CL-H. These are the two names `metaSpatialAnchorFrameSource` looks for,
          // and their absence here is the whole of why co-location did not work on
          // Quest: the native side has driven Meta's group sharing since the OpenXR
          // session learned it, and nothing forwarded to it. They go through
          // VRModuleOpenXR rather than ARSceneNavigatorModule because that module
          // resolves its view as a VRTARSceneNavigator, which VRActivity does not host.
          rvCreateSharedFrame: async (groupId: string) =>
            VRModuleOpenXR?.rvCreateSharedFrame?.(requireViewTag(), groupId) ?? {
              success: false,
              error: "VRModuleOpenXR is unavailable — is this a Quest build?",
            },
          rvJoinSharedFrame: async (groupId: string) =>
            VRModuleOpenXR?.rvJoinSharedFrame?.(requireViewTag(), groupId) ?? {
              success: false,
              error: "VRModuleOpenXR is unavailable — is this a Quest build?",
            },
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

    // Identity of this navigator for ImmersiveSpace ownership. A symbol rather than a
    // counter: it cannot collide, and it means nothing outside this comparison.
    const visionOSOwnerRef = React.useRef<symbol>(Symbol("ViroXRSceneNavigator"));

    // On visionOS: open the ImmersiveSpace on mount and close it on unmount.
    //
    // This mirrors what the Quest branch does with VRActivity — in both cases something other
    // than the React view hierarchy owns the display. The difference is that VRActivity runs its
    // own React host, so Quest forwards the scene across a bridge and renders only its panel
    // here, whereas the visionOS ImmersiveSpace shares this runtime: the scene tree below stays
    // mounted, and the native side hands its VRTScene to the CompositorServices render loop.
    React.useEffect(() => {
      if (!isVisionOS) return;
      // An AR-rooted scene has nothing to put in the space — ViroARScene cannot mount on visionOS
      // and rendered null just above. Opening it anyway dims the room and shows an empty world.
      if (sawARSceneRoot()) {
        console.warn(
          "[Viro] The scene given to ViroXRSceneNavigator is rooted in ViroARScene, which " +
            "visionOS does not support, so the ImmersiveSpace was not opened. Root the scene " +
            "in ViroScene, or pass one through `vrInitialScene`."
        );
        return;
      }
      // Ownership, as on Quest. There VRActivity is the single display and `setVRActive` names
      // who has it; here the ImmersiveSpace is, and this is the same flag. The last navigator to
      // claim it is the one driving it, and only that one may close it again.
      const owner = visionOSOwnerRef.current;
      claimImmersiveSpace(owner);

      let cancelled = false;
      const open = () =>
        enterImmersiveSpace(visionOSImmersionStyle).then((opened) => {
          if (!opened && !cancelled) {
            console.warn(
              "[Viro] Could not open the visionOS ImmersiveSpace. Check that the host app's " +
                "SwiftUI App declares `ImmersiveSpace(id: ViroImmersiveSpace.id)` and applies " +
                "`.viroImmersiveSpaceController()` to the React Native root view."
            );
          }
        });
      open();

      // visionOS closes the ImmersiveSpace when the app leaves the foreground, so it is reopened
      // when the app is active again. Only by whoever owns it, or two mounted navigators would
      // both reopen and fight over the one surface.
      const appStateSub = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active" && ownsImmersiveSpace(owner)) {
          open();
        }
      });

      return () => {
        cancelled = true;
        appStateSub.remove();
        // Not on the way out of a screen that no longer owns the space: another navigator has
        // taken it over, and closing it would blank what the wearer is actually looking at.
        if (releaseImmersiveSpace(owner)) {
          scheduleImmersiveSpaceExit(() => {
            exitImmersiveSpace();
          });
        }
      };
    }, []);

    // On Quest: register the intent (scene + renderer config) then launch VRActivity.
    // Only on mount; renderQuestPanel says why it is not relaunched.
    React.useEffect(() => {
      if (!isQuest) return;
      checkRNVersionForVR();

      const registerIntentAndLaunch = () => {
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
        launchVR();
      };

      // Request the runtime grants once before the first launch. Caught and
      // ignored on failure — a denied/unavailable permission should degrade
      // (no planes, no passthrough camera), not block VR from opening at all.
      const permissions = questPermissions.flatMap(
        (permission) => QUEST_RUNTIME_PERMISSIONS[permission]
      );
      (permissions.length > 0
        ? PermissionsAndroid.requestMultiple(permissions as any)
        : Promise.resolve()
      )
        .catch(() => undefined)
        .then(registerIntentAndLaunch);
    }, []);

    // The panel is only seen while the headset view is closed. Re-entry keeps the
    // intent registered on mount.
    if (isQuest) {
      return renderQuestPanel ? (
        renderQuestPanel(launchVR)
      ) : (
        <QuestPanel onEnter={launchVR} style={rest.style} />
      );
    }

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
      // Zero-sized and hidden on purpose. This view is not a render surface on visionOS — the
      // ImmersiveSpace is — so anything it occupies in the window is space the app cannot use,
      // showing nothing. Left at its natural size it fills the window and the result reads as a
      // black panel floating in front of the immersive content, because an empty React Native
      // window is black. The scene tree still mounts, which is what matters: that is how the
      // native VRTScene reaches the renderer.
      const { style: _ignoredStyle, ...visionRest } = rest as { style?: unknown };
      return (
        <View style={styles.visionOSHost} pointerEvents="none">
          <ViroSceneNavigator
            ref={visionRef}
            initialScene={visionScene}
            {...(visionRest as object)}
          />
        </View>
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
        hdrEnabled={hdrEnabled}
        pbrEnabled={pbrEnabled}
        bloomEnabled={bloomEnabled}
        shadowsEnabled={shadowsEnabled}
        multisamplingEnabled={multisamplingEnabled}
        {...rest}
      />
    );
  }
);

const styles = StyleSheet.create({
  /** See the visionOS branch above: present in the tree, absent from the layout. */
  visionOSHost: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
  questPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  questEnterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  questEnterButtonPressed: {
    opacity: 0.7,
  },
  questEnterLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
});
