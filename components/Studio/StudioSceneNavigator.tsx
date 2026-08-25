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
import { StudioRecordingIndicator } from "./StudioRecordingIndicator";
import { StudioPlacementIndicator } from "./StudioPlacementIndicator";
import { studioPlacementBannerStore } from "./domain/placementBannerStore";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementStore } from "./domain/placementStore";
import { StudioARScene, type StudioPlacementApi } from "./StudioARScene";
import { StudioSceneErrorBoundary } from "./StudioSceneErrorBoundary";
import { StudioProjectApiResponse, StudioSceneResponse } from "./types";
import { VRTStudioModule } from "./VRTStudioModule";

function LoadingARScene() {
  return <ViroARScene />;
}
function LoadingVRScene() {
  return <ViroScene />;
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
});

const PLACEMENT_BANNER_TOP =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 12 : 64;

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
  /** Screenshots the AR renderer. Resolves `{ success: false }` (no-op) on Quest. */
  takeScreenshot: (
    fileName: string,
    saveToCameraRoll: boolean
  ) => Promise<{ success: boolean; url?: string; errorCode?: string }>;
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
  noAssetsMessage?: string;
  /**
   * Opt-in overlay shown until the scene mounts. Omit to render nothing on AR
   * during load (the camera feed); Quest falls back to a built-in spinner.
   */
  loadingView?: React.ReactNode;
  /**
   * Opt-in UI for a caught render error. The boundary always catches and calls
   * `onError`; when this is omitted it renders nothing.
   */
  renderError?: (error: Error) => React.ReactNode;
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
    onSceneLoaded,
    onPlaneDetected,
    onPlaneSelected,
    noAssetsMessage,
    loadingView,
    renderError,
    recordingIndicator = true,
    placementIndicator = true,
  },
  ref
) {
  const navigatorRef = useRef<any>(null);
  const loadedSceneIdRef = useRef<string | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

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

  // Stable so passProps stays referentially steady across renders. Idempotent,
  // so StrictMode's dev double-invoke of StudioARScene's onReady effect is safe.
  const handleSceneReady = useCallback(() => {
    setIsSceneReady(true);
    onSceneReadyRef.current?.();
  }, []);

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
        // arSceneNavigator.takeScreenshot); on Quest it's a bridge without it.
        const nav = navigatorRef.current?.arSceneNavigator;
        if (typeof nav?.takeScreenshot !== "function") {
          return Promise.resolve({ success: false });
        }
        return nav.takeScreenshot(fileName, saveToCameraRoll);
      },
    }),
    []
  );

  const resolveSceneId = useCallback(async (): Promise<string> => {
    if (sceneId) return sceneId;

    const projectResult = await VRTStudioModule.rvGetProject();
    if (!projectResult.success) {
      throw new Error(projectResult.error ?? "rvGetProject failed");
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
    throw new Error(`Project ${project.id} has no scenes`);
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
        throw new Error(result.error ?? "rvGetScene failed");
      }
      if (typeof result.data !== "string") {
        throw new Error("rvGetScene returned no data");
      }

      const sceneData: StudioSceneResponse = JSON.parse(result.data);
      if (isCancelled()) return;

      loadedSceneIdRef.current = resolvedSceneId;

      // Names for the tap-to-place prompt (overlay reads this on placement).
      placementNamesRef.current = new Map(
        sceneData.assets
          .filter((a) => a.tap_to_place)
          .map((a) => [a.id, a.name ?? ""])
      );

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

      const entry = {
        scene: StudioARScene,
        passProps: {
          sceneData,
          onReady: handleSceneReady,
          onSceneChange: onSceneChangeRef.current,
          onPlaneDetected: onPlaneDetectedRef.current,
          onPlaneSelected: onPlaneSelectedRef.current,
          noAssetsMessage: noAssetsMessageRef.current,
          variableStore: variableStoreRef.current,
          placementStore: placementStoreRef.current,
          placementApiRef,
        },
      };

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
    [resolveSceneId, handleSceneReady]
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    loadScene(isCancelled).catch((e: unknown) => {
      if (cancelled) return;
      const err = e instanceof Error ? e : new Error(String(e));
      const handler = onErrorRef.current;
      if (handler) handler(err);
      else console.error("[Studio] Failed to load scene:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [sceneId, loadScene]);

  // Quest has no camera passthrough, so during load it always needs something
  // on screen: the caller's loadingView, else a built-in spinner. (AR shows the
  // live camera, so its overlay stays opt-in.) visionOS needs it for a different
  // reason with the same effect — its passthrough is in the ImmersiveSpace, not in
  // this window, so the window would otherwise be blank while the scene loads.
  if ((isQuest || isVisionOS) && !vrSceneEntry) {
    return (
      <View style={styles.loader}>
        {loadingView ?? <ActivityIndicator size="large" color="#ffffff" />}
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
          onExitViro={onExitViro}
          style={StyleSheet.absoluteFill}
        />
        {/* Absolutely filled so the overlay covers the navigator instead of
            taking flow space beneath it. */}
        {!isSceneReady && loadingView && (
          <View style={StyleSheet.absoluteFill}>{loadingView}</View>
        )}
        {recordingIndicator && (
          <View
            pointerEvents="box-none"
            style={[styles.recordingOverlay, { top: DEFAULT_RECORDING_TOP }]}
          >
            <StudioRecordingIndicator />
          </View>
        )}
        {!isQuest && placementStoreRef.current && (
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
      </View>
    </StudioSceneErrorBoundary>
  );
});
