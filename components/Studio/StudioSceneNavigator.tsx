import * as React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  PixelRatio,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroScene } from "../ViroScene";
import { ViroXRSceneNavigator } from "../ViroXRSceneNavigator";
import { isQuest, isVisionOS } from "../Utilities/ViroPlatform";
import { VRQuestNavigatorBridge } from "../Utilities/VRQuestNavigatorBridge";
import { StudioRecordingIndicator } from "./StudioRecordingIndicator";
import { StudioPlacementIndicator } from "./StudioPlacementIndicator";
import { StudioColocationIndicator } from "./StudioColocationIndicator";
import { studioPlacementBannerStore } from "./domain/placementBannerStore";
import { studioColocationStore } from "./domain/colocationStore";
import {
  questMenuStore,
  type StudioQuestMenuItem,
} from "./domain/questMenuStore";
import { StudioColocationController } from "./colocation/controller";
import type {
  StudioColocationOptions,
  StudioColocationRoom,
  StudioColocationState,
} from "./colocation/types";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementStore, isTapToPlaceAsset } from "./domain/placementStore";
import { studioApiError } from "./domain/studioApiError";
import { StudioARScene, type StudioPlacementApi } from "./StudioARScene";
import { StudioSceneErrorBoundary } from "./StudioSceneErrorBoundary";
import { StudioProjectApiResponse, StudioSceneResponse } from "./types";
import { VRTStudioModule } from "./VRTStudioModule";

// Tone mapping off here too, or the camera feed takes the default Hable curve for
// the moment a scene is loading and then snaps when the authored scene mounts.
function LoadingARScene() {
  return <ViroARScene toneMappingEnabled={false} />;
}
function LoadingVRScene() {
  return <ViroScene toneMappingEnabled={false} />;
}

type ViroOcclusionMode = "peopleOnly" | "depthBased" | undefined;

function mapOcclusionMode(
  dbValue: string | null | undefined
): ViroOcclusionMode {
  switch (dbValue) {
    case "PEOPLEONLY":
      return "peopleOnly";
    case "DEPTHBASED":
      return "depthBased";
    default:
      return undefined;
  }
}

// Approximate top inset for the built-in recording indicator. Dependency-free
// (viro takes no safe-area-context peer dep); hosts wanting exact placement set
// recordingIndicator={false} and render <StudioRecordingIndicator /> themselves.
const DEFAULT_RECORDING_TOP =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : 52;

const styles = StyleSheet.create({
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  recordingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  placementBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  colocationOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
});

const PLACEMENT_BANNER_TOP =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 12 : 64;

// Bottom-centre, clear of the top pills; approximate, like the top insets.
const COLOCATION_INDICATOR_BOTTOM = Platform.OS === "android" ? 24 : 40;

/**
 * Mobile AR placement layer: a full-screen tap catcher shown while a tap-to-place
 * asset is awaiting placement. Each tap hit-tests a real surface (via the scene's
 * placement API); a miss prompts the user to scan more of the space. Rendered only
 * when an asset is active, so normal object interaction is untouched otherwise.
 * Headset placement is in-scene (controller trigger), so this never mounts there.
 *
 * The visible prompt is a separate position-agnostic indicator; this layer only
 * publishes active/name/miss state to the banner store so the host can render the
 * prompt in its own chrome.
 */
const StudioPlacementOverlay: React.FC<{
  store: StudioPlacementStore;
  apiRef: React.MutableRefObject<StudioPlacementApi | null>;
  getName: (assetId: string) => string | null;
}> = ({ store, apiRef, getName }) => {
  const [activeId, setActiveId] = useState<string | null>(() =>
    store.activeAssetId()
  );
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveId(store.activeAssetId());
    return store.subscribeActive(() => setActiveId(store.activeAssetId()));
  }, [store]);

  useEffect(() => {
    studioPlacementBannerStore.set(
      !!activeId,
      activeId ? getName(activeId) : null
    );
  }, [activeId, getName]);

  useEffect(
    () => () => {
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      studioPlacementBannerStore.reset();
    },
    []
  );

  const handleRelease = useCallback(
    (evt: GestureResponderEvent) => {
      const api = apiRef.current;
      if (!api) return;
      const { locationX, locationY } = evt.nativeEvent;
      const ratio = PixelRatio.get();
      void api
        .placeAtScreenPoint(locationX * ratio, locationY * ratio)
        .then((result) => {
          if (result !== "miss") {
            studioPlacementBannerStore.setShowMiss(false);
            return;
          }
          studioPlacementBannerStore.setShowMiss(true);
          if (missTimerRef.current) clearTimeout(missTimerRef.current);
          missTimerRef.current = setTimeout(
            () => studioPlacementBannerStore.setShowMiss(false),
            2500
          );
        });
    },
    [apiRef]
  );

  if (!activeId) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onResponderRelease={handleRelease}
    />
  );
};

/** Imperative handle exposed via ref. */
export interface StudioSceneNavigatorHandle {
  /**
   * Screenshots the renderer. On Meta Quest it captures the left eye, without
   * the passthrough room, and resolves `errorCode` 7 (`RECORD_ERROR_NOT_READY`)
   * until the VR scene is rendering.
   */
  takeScreenshot: (
    fileName: string,
    saveToCameraRoll: boolean
  ) => Promise<{ success: boolean; url?: string; errorCode?: string }>;
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
  /** Meta Quest only. Passed to `ViroXRSceneNavigator`, which documents it. */
  renderQuestPanel?: (enter: () => void) => React.ReactNode;
  /**
   * Meta Quest only. Buttons for the in-scene menu, listed above its Exit
   * button. The wearer opens and closes the menu with the left controller's Y
   * button, and pressing a button closes it. Nothing 2D can be seen from
   * inside the headset, so this is where the host's scene actions go.
   */
  questMenuItems?: readonly StudioQuestMenuItem[];
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
export const StudioSceneNavigator = forwardRef<
  StudioSceneNavigatorHandle,
  StudioSceneNavigatorProps
>(function StudioSceneNavigator(
  {
    sceneId,
    worldAlignment = "Gravity",
    autofocus = true,
    style,
    onSceneReady,
    onError,
    onSceneChange,
    onExitViro,
    renderQuestPanel,
    questMenuItems,
    onSceneLoaded,
    onPlaneDetected,
    onPlaneSelected,
    noAssetsMessage,
    loadingView,
    renderError,
    recordingIndicator = true,
    placementIndicator = true,
    colocation,
    colocationIndicator = true,
    onColocationStateChange,
    onColocationRoom,
  },
  ref
) {
  const navigatorRef = useRef<any>(null);
  const loadedSceneIdRef = useRef<string | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  // A failed load has to be state, not just an onError callback: the loading
  // overlay is gated on isSceneReady, which never flips when the load throws,
  // so without this the host is left showing its loadingView forever.
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Deliberately does not clear loadedSceneIdRef: it is only assigned after a
  // successful parse, so it is already null on the path that can fail. Leaving
  // it means a retry after a scene did load is a no-op rather than a second
  // push of the same scene onto the navigator.
  const retryLoad = useCallback(() => {
    setLoadError(null);
    setIsSceneReady(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  // Session-scoped variable store: outlives every scene push, resets when the
  // navigator (= the AR/VR session) unmounts.
  const variableStoreRef = useRef<StudioVariableStore | null>(null);
  if (variableStoreRef.current === null) {
    variableStoreRef.current = new StudioVariableStore();
  }
  useEffect(() => {
    return () => {
      variableStoreRef.current?.reset();
      variableStoreRef.current = null;
    };
  }, []);

  // Tap-to-place: the store is owned here so the mobile overlay can read active
  // state; StudioARScene re-seeds it per scene. placementApiRef receives the
  // scene's hit-test bridge. placementNamesRef maps asset id → name for the
  // overlay prompt. All ephemeral — placement never persists.
  const placementStoreRef = useRef<StudioPlacementStore | null>(null);
  if (placementStoreRef.current === null) {
    placementStoreRef.current = new StudioPlacementStore();
  }
  const placementApiRef = useRef<StudioPlacementApi | null>(null);
  const placementNamesRef = useRef<Map<string, string>>(new Map());
  const getPlacementName = useCallback(
    (assetId: string) => placementNamesRef.current.get(assetId) ?? null,
    []
  );
  const rememberPlacementNames = useCallback(
    (sceneData: StudioSceneResponse) => {
      placementNamesRef.current = new Map(
        sceneData.assets
          .filter((a) => isTapToPlaceAsset(a))
          .map((a) => [a.id, a.name ?? ""])
      );
    },
    []
  );

  const onColocationStateChangeRef = useRef(onColocationStateChange);
  const onColocationRoomRef = useRef(onColocationRoom);
  onColocationStateChangeRef.current = onColocationStateChange;
  onColocationRoomRef.current = onColocationRoom;

  // One controller for the navigator's lifetime, handed to every scene like
  // the variable store, so a session survives scene pushes. The AR session
  // persists across a push too, so nothing re-resolves on NAVIGATE.
  const colocationRef = useRef<StudioColocationController | null>(null);
  // This navigator's token in the module-level store, which another mounted
  // navigator may be writing too.
  const [colocationStoreOwner] = useState(() => ({}));
  if (colocationRef.current === null) {
    const controller = new StudioColocationController();
    controller.setNavigatorAccessor(
      () => navigatorRef.current?.arSceneNavigator
    );
    controller.onStateChange = (state) => {
      studioColocationStore.set(state, colocationStoreOwner);
      onColocationStateChangeRef.current?.(state);
    };
    controller.onRoom = (room) => onColocationRoomRef.current?.(room);
    controller.onOriginPrompt = (prompt) =>
      studioColocationStore.setOriginPrompt(prompt, colocationStoreOwner);
    colocationRef.current = controller;
  }
  useEffect(() => {
    const controller = colocationRef.current;
    studioColocationStore.setFinishScanHandler(
      () => controller?.finishScan() ?? false,
      colocationStoreOwner
    );
    return () => {
      controller?.dispose();
      studioColocationStore.reset(colocationStoreOwner);
    };
  }, [colocationStoreOwner]);
  useEffect(() => {
    studioColocationStore.setBuiltInIndicatorShown(
      colocationIndicator,
      colocationStoreOwner
    );
  }, [colocationIndicator, colocationStoreOwner]);
  useEffect(() => {
    if (!isQuest) return;
    questMenuStore.set(questMenuItems, colocationStoreOwner);
    return () => questMenuStore.clear(colocationStoreOwner);
  }, [questMenuItems, colocationStoreOwner]);
  useEffect(() => {
    colocationRef.current?.request(colocation ?? null, {
      restartFailed: false,
    });
  }, [colocation]);

  // The tap-to-place overlay would catch taps for content that is withheld
  // while a shared session is set up.
  const [colocationPending, setColocationPending] = useState(false);
  useEffect(() => {
    const controller = colocationRef.current;
    if (!controller) return;
    const update = () =>
      setColocationPending(controller.getFrame().phase === "pending");
    update();
    return controller.subscribe(update);
  }, []);

  const onSceneReadyRef = useRef(onSceneReady);
  const onErrorRef = useRef(onError);
  const onSceneChangeRef = useRef(onSceneChange);
  const onSceneLoadedRef = useRef(onSceneLoaded);
  const onPlaneDetectedRef = useRef(onPlaneDetected);
  const onPlaneSelectedRef = useRef(onPlaneSelected);
  const noAssetsMessageRef = useRef(noAssetsMessage);
  onSceneReadyRef.current = onSceneReady;
  onErrorRef.current = onError;
  onSceneChangeRef.current = onSceneChange;
  onSceneLoadedRef.current = onSceneLoaded;
  onPlaneDetectedRef.current = onPlaneDetected;
  onPlaneSelectedRef.current = onPlaneSelected;
  noAssetsMessageRef.current = noAssetsMessage;

  // VRActivity is a separate React root — its own error boundary
  // (ViroQuestEntryPoint) can't reach this component's onError prop directly,
  // so it relays crashes through VRQuestNavigatorBridge instead. Forwarding
  // here means a host's existing onError → Sentry wiring for phone-AR errors
  // picks up Quest scene crashes too, with no changes needed on the host side.
  React.useEffect(
    () => VRQuestNavigatorBridge.onQuestError((error) => onErrorRef.current?.(error)),
    []
  );

  // Stable so passProps stays referentially steady across renders. Idempotent,
  // so StrictMode's dev double-invoke of StudioARScene's onReady effect is safe.
  const handleSceneReady = useCallback(() => {
    setIsSceneReady(true);
    onSceneReadyRef.current?.();
  }, []);

  // What every scene the navigator pushes is given. The first-scene callbacks
  // reach the initial scene alone, as their props say.
  const sceneEntry = useCallback(
    (
      sceneData: StudioSceneResponse,
      initial: boolean,
      skipOnLoadFunction = false
    ) => ({
      scene: StudioARScene,
      passProps: {
        sceneData,
        ...(initial
          ? {
              onReady: handleSceneReady,
              onPlaneDetected: onPlaneDetectedRef.current,
              onPlaneSelected: onPlaneSelectedRef.current,
            }
          : {}),
        onSceneChange: onSceneChangeRef.current,
        noAssetsMessage: noAssetsMessageRef.current,
        variableStore: variableStoreRef.current,
        placementStore: placementStoreRef.current,
        placementApiRef,
        colocation: colocationRef.current,
        ...(skipOnLoadFunction ? { skipOnLoadFunction } : {}),
      },
    }),
    [handleSceneReady]
  );

  // A shared session navigates through here, on the device that ran the
  // NAVIGATE and on every device that follows it.
  useEffect(() => {
    const controller = colocationRef.current;
    controller?.setScenePusher((sceneData, { skipOnLoadFunction }) => {
      rememberPlacementNames(sceneData);
      navigatorRef.current?.arSceneNavigator?.push(
        sceneEntry(sceneData, false, skipOnLoadFunction)
      );
      onSceneChangeRef.current?.(
        sceneData.scene.id,
        sceneData.scene.name ?? sceneData.scene.id
      );
    });
    return () => controller?.setScenePusher(null);
  }, [sceneEntry, rememberPlacementNames]);

  // On Quest: holds the resolved scene entry. ViroXRSceneNavigator is not
  // rendered until this is non-null, so VRActivity always launches into content.
  const [vrSceneEntry, setVrSceneEntry] = useState<{
    scene: any;
    passProps?: any;
  } | null>(null);

  // Host config derived from the loaded scene; native setters apply post-mount,
  // so setting these after the navigator mounts is fine.
  const [occlusionMode, setOcclusionMode] =
    useState<ViroOcclusionMode>(undefined);
  const [numberOfTrackedImages, setNumberOfTrackedImages] = useState<
    number | undefined
  >(undefined);

  useImperativeHandle(
    ref,
    (): StudioSceneNavigatorHandle => ({
      takeScreenshot: (fileName, saveToCameraRoll) => {
        // On AR the handle is the ViroARSceneNavigator instance (has
        // arSceneNavigator.takeScreenshot); on Quest it's the XR navigator's
        // bridge, which forwards it to VRModuleOpenXR.
        const nav = navigatorRef.current?.arSceneNavigator;
        if (typeof nav?.takeScreenshot !== "function") {
          return Promise.resolve({ success: false });
        }
        return nav.takeScreenshot(fileName, saveToCameraRoll);
      },
      leaveColocation: () => colocationRef.current?.leave(),
      retryColocation: () => colocationRef.current?.retry() ?? false,
      getColocationRoom: () => colocationRef.current?.getRoom() ?? null,
      finishColocationScan: () => colocationRef.current?.finishScan() ?? false,
    }),
    []
  );

  const resolveSceneId = useCallback(async (): Promise<string> => {
    if (sceneId) return sceneId;

    const projectResult = await VRTStudioModule.rvGetProject();
    if (!projectResult.success) {
      throw studioApiError("rvGetProject", projectResult.error);
    }
    if (typeof projectResult.data !== "string") {
      throw new Error("rvGetProject returned no data");
    }

    const { project } = JSON.parse(
      projectResult.data
    ) as StudioProjectApiResponse;

    if (project.opening_scene?.id) {
      return project.opening_scene.id;
    }
    if (project.scenes.length > 0) {
      return project.scenes[0].id;
    }
    // Id on a field, not in the message: interpolated it would open a new
    // group per project in the host's error reporter.
    throw Object.assign(new Error("Project has no scenes"), {
      projectId: project.id,
    });
  }, [sceneId]);

  const loadScene = useCallback(
    async (isCancelled: () => boolean) => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      if (isCancelled()) return;

      const resolvedSceneId = await resolveSceneId();
      if (isCancelled()) return;

      if (loadedSceneIdRef.current === resolvedSceneId) return;

      const result = await VRTStudioModule.rvGetScene(resolvedSceneId);
      if (isCancelled()) return;
      if (!result.success) {
        throw studioApiError("rvGetScene", result.error);
      }
      if (typeof result.data !== "string") {
        throw new Error("rvGetScene returned no data");
      }

      const sceneData: StudioSceneResponse = JSON.parse(result.data);
      if (isCancelled()) return;

      loadedSceneIdRef.current = resolvedSceneId;

      // Names for the tap-to-place prompt (overlay reads this on placement).
      rememberPlacementNames(sceneData);

      const triggerImageCount = sceneData.assets.filter(
        (a) => !!a.trigger_image_url
      ).length;
      setNumberOfTrackedImages(
        triggerImageCount > 0 ? Math.min(triggerImageCount, 5) : undefined
      );
      setOcclusionMode(mapOcclusionMode(sceneData.project?.occlusion_mode));

      onSceneLoadedRef.current?.(sceneData);

      // On Quest, pre-register animations and materials before VRActivity
      // launches so the native registrations land before any Viro component
      // mounts; otherwise registerAnimations/createMaterials races the Fabric
      // commit that creates those components. visionOS is the same shape of
      // problem: the ImmersiveSpace renderer starts outside this commit.
      if (isQuest || isVisionOS) {
        registerSceneAnimations(sceneData.animations);
        registerStudioMaterialsForAssets(sceneData.assets);
      }

      const entry = sceneEntry(sceneData, true);

      if (isQuest || isVisionOS) {
        // Setting vrSceneEntry mounts ViroXRSceneNavigator with StudioARScene as
        // vrInitialScene, so VRActivity launches straight into content. visionOS reads the
        // same prop — its ImmersiveSpace cannot host a ViroARScene either — so it takes this
        // path rather than pushing onto a navigator that starts on the loading scene.
        setVrSceneEntry(entry);
      } else {
        navigatorRef.current?.arSceneNavigator?.push(entry);
      }
    },
    [resolveSceneId, sceneEntry, rememberPlacementNames]
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    loadScene(isCancelled).catch((e: unknown) => {
      if (cancelled) return;
      const err = e instanceof Error ? e : new Error(String(e));
      setLoadError(err);
      const handler = onErrorRef.current;
      if (handler) handler(err);
      else console.error("[Studio] Failed to load scene:", err);
    });

    return () => {
      cancelled = true;
    };
    // loadAttempt is the retry trigger: loadScene is stable within a mount, so
    // bumping it is what re-runs the fetch without remounting the AR session.
  }, [sceneId, loadScene, loadAttempt]);

  // Falls back to loadingView when the host passes no renderError, so callers
  // that never opted in keep exactly their previous behaviour.
  const loadErrorView = loadError ? renderError?.(loadError, retryLoad) : null;
  const overlay = isSceneReady ? null : (loadErrorView ?? loadingView ?? null);

  // Before vrSceneEntry resolves, VRActivity hasn't been launched yet (Quest)
  // or the ImmersiveSpace hasn't opened yet (visionOS), so this window has
  // nothing of its own to show — it always needs something on screen: the
  // caller's loadingView, else a built-in spinner. (Phone AR shows the live
  // camera during load, so its overlay stays opt-in.) This branch sits above
  // the error boundary, which is why it has to handle loadError itself.
  // (Quest 3/3S do have colour passthrough once the scene mounts — this branch
  // is about the pre-launch panel window, not about passthrough support.)
  //
  // visionOS needs the same treatment for a different reason: its passthrough lives in
  // the ImmersiveSpace, not in this window, so the window would otherwise sit blank
  // while the scene loads.
  if ((isQuest || isVisionOS) && !vrSceneEntry) {
    return (
      <View style={styles.loader}>
        {overlay ?? <ActivityIndicator size="large" color="#ffffff" />}
      </View>
    );
  }

  return (
    <StudioSceneErrorBoundary
      sceneId={sceneId}
      onError={onError}
      renderError={renderError}
    >
      <View style={style ?? StyleSheet.absoluteFill}>
        <ViroXRSceneNavigator
          ref={navigatorRef}
          arInitialScene={{ scene: LoadingARScene }}
          vrInitialScene={vrSceneEntry ?? { scene: LoadingVRScene }}
          worldAlignment={worldAlignment}
          autofocus={autofocus}
          numberOfTrackedImages={numberOfTrackedImages}
          occlusionMode={occlusionMode}
          // Bloom defaults on natively and the editor does not preview it, so a
          // bright material glows on the phone and nowhere else.
          //
          // HDR stays ON even though its default tone curve is the other half of
          // that problem, because PBR rides on it: VROChoreographer::isPBREnabled
          // is `_hdrEnabled && _pbrEnabled`, and the whole PBR branch of
          // VROShaderFactory goes with it, so roughness, metalness and the ambient
          // occlusion map are read by nothing and a PBR material falls back to
          // Blinn. The tone curve is switched off per scene instead, which is what
          // `toneMappingEnabled` on StudioARScene does. Passed explicitly rather
          // than left to the native default, so this cannot be switched off again
          // without meeting the reason it is on.
          //
          // Off on Quest, and only there: the HDR composite occludes the
          // passthrough layer on that OpenXR compositor, so the room disappears
          // behind the scene. PBR on Quest goes with it, which is the trade — a
          // headset that shows nothing of the room is the worse of the two.
          hdrEnabled={!isQuest}
          bloomEnabled={false}
          onExitViro={onExitViro}
          renderQuestPanel={renderQuestPanel}
          // Quest-only (no-op on phones). Quest mounts a ViroScene root rather
          // than ViroARScene outside a shared session (see StudioARScene for
          // why), and a virtual root turns none of this on by itself, so both
          // are asked for outright.
          // They reach VRActivity through the navigator bridge and do not depend
          // on which root the scene uses.
          passthroughEnabled={isQuest ? true : undefined}
          handTrackingEnabled={isQuest ? true : undefined}
          style={StyleSheet.absoluteFill}
        />
        {/* Absolutely filled so the overlay covers the navigator instead of
            taking flow space beneath it. Swapping the overlay's content, rather
            than replacing this subtree, keeps the AR session and its camera
            alive while the error shows, so a retry costs no session restart. */}
        {overlay && <View style={StyleSheet.absoluteFill}>{overlay}</View>}
        {recordingIndicator && (
          <View
            pointerEvents="box-none"
            style={[styles.recordingOverlay, { top: DEFAULT_RECORDING_TOP }]}
          >
            <StudioRecordingIndicator />
          </View>
        )}
        {!isQuest && placementStoreRef.current && !colocationPending && (
          <StudioPlacementOverlay
            store={placementStoreRef.current}
            apiRef={placementApiRef}
            getName={getPlacementName}
          />
        )}
        {placementIndicator && (
          <View
            pointerEvents="none"
            style={[styles.placementBanner, { top: PLACEMENT_BANNER_TOP }]}
          >
            <StudioPlacementIndicator />
          </View>
        )}
        {colocationIndicator && (
          <View
            pointerEvents="box-none"
            style={[
              styles.colocationOverlay,
              { bottom: COLOCATION_INDICATOR_BOTTOM },
            ]}
          >
            <StudioColocationIndicator />
          </View>
        )}
      </View>
    </StudioSceneErrorBoundary>
  );
});
